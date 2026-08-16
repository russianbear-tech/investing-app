import { Database, Holding } from "./types";
import { getHistory, getQuotes } from "./market";
import { getHistoricalRate } from "./fx";

export interface HistoryPoint {
  date: string;
  /** What the portfolio was worth that day, in the master currency. */
  value: number;
  /** Cumulative money put in by that day, in the master currency. */
  invested: number;
}

export interface HistorySeries {
  points: HistoryPoint[];
  masterCurrency: string;
  range: string;
  /** Holdings we couldn't get a price series for — their value is carried flat. */
  incomplete: string[];
  asOf: string;
}

export type Range = "1m" | "3m" | "6m" | "1y" | "all";

const RANGE_DAYS: Record<Exclude<Range, "all">, number> = {
  "1m": 30,
  "3m": 91,
  "6m": 183,
  "1y": 365,
};

const CACHE_TTL_MS = 5 * 60_000;
const cache = new Map<string, { at: number; series: HistorySeries }>();

type Series = { date: string; close: number }[];

/**
 * Value of a series on each requested date, carried forward from the last
 * observation. Markets close on weekends and holidays; a position still has a
 * value on those days.
 */
function forwardFill(series: Series, dates: string[]): (number | null)[] {
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const out: (number | null)[] = [];
  let i = 0;
  let last: number | null = null;

  for (const date of dates) {
    while (i < sorted.length && sorted[i].date <= date) {
      last = sorted[i].close;
      i++;
    }
    out.push(last);
  }
  return out;
}

function daysSince(iso: string): number {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(t)) return 365;
  return Math.max(1, Math.ceil((Date.now() - t) / 86_400_000));
}

function earliestLotDate(holdings: Holding[]): string {
  let earliest = new Date().toISOString().slice(0, 10);
  for (const h of holdings) {
    for (const lot of h.lots) {
      if (lot.date < earliest) earliest = lot.date;
    }
  }
  return earliest;
}

export async function buildHistory(
  db: Database,
  range: Range
): Promise<HistorySeries> {
  const master = db.settings.masterCurrency;
  const holdings = db.holdings;
  const asOf = new Date().toISOString();

  if (holdings.length === 0) {
    return { points: [], masterCurrency: master, range, incomplete: [], asOf };
  }

  const cacheKey = JSON.stringify({
    range,
    master,
    // Any edit to a holding or its lots invalidates the cached series.
    sig: holdings.map((h) => `${h.id}:${h.lots.length}:${h.symbol}`).join("|"),
  });
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.series;

  const start =
    range === "all"
      ? earliestLotDate(holdings)
      : new Date(Date.now() - RANGE_DAYS[range] * 86_400_000)
          .toISOString()
          .slice(0, 10);

  // Pad the fetch window so a position bought just before `start` still has a
  // prior close to carry forward.
  const fetchDays = daysSince(start) + 10;

  const priced = holdings.filter((h) => h.symbol && h.kind !== "cash");
  const [histories, liveQuotes] = await Promise.all([
    Promise.all(
      priced.map(async (h) => ({
        holding: h,
        series: await getHistory(h.symbol, fetchDays),
      }))
    ),
    getQuotes(priced.map((h) => h.symbol)),
  ]);

  // Native currency per holding, so we know which FX series to fetch.
  const currencyOf = new Map<string, string>();
  for (const h of holdings) {
    const q = h.symbol ? liveQuotes.get(h.symbol.toUpperCase()) : undefined;
    currencyOf.set(h.id, q?.currency ?? h.purchaseCurrency);
  }

  const fxCurrencies = [...new Set(currencyOf.values())].filter((c) => c !== master);
  const fxSeries = new Map<string, Series>();
  await Promise.all(
    fxCurrencies.map(async (cur) => {
      const series = await getHistory(`${cur}${master}=X`, fetchDays);
      if (series.length > 0) fxSeries.set(cur, series);
      else {
        const inverse = await getHistory(`${master}${cur}=X`, fetchDays);
        fxSeries.set(
          cur,
          inverse.map((p) => ({ date: p.date, close: p.close > 0 ? 1 / p.close : 0 }))
        );
      }
    })
  );

  // The x-axis is the union of every day any market reported a price.
  const dateSet = new Set<string>();
  for (const { series } of histories) {
    for (const p of series) if (p.date >= start) dateSet.add(p.date);
  }
  const today = new Date().toISOString().slice(0, 10);
  dateSet.add(today);
  const dates = [...dateSet].sort();

  if (dates.length < 2) {
    return { points: [], masterCurrency: master, range, incomplete: [], asOf };
  }

  // Each lot's cost, converted once at the rate that applied on its own date.
  const lotCosts = new Map<string, number>();
  await Promise.all(
    holdings.flatMap((h) =>
      h.lots.map(async (lot) => {
        const rate =
          h.purchaseCurrency === master
            ? 1
            : ((await getHistoricalRate(h.purchaseCurrency, master, lot.date)) ?? 1);
        lotCosts.set(lot.id, lot.quantity * lot.costPerUnit * rate);
      })
    )
  );

  const fxFilled = new Map<string, (number | null)[]>();
  for (const [cur, series] of fxSeries) fxFilled.set(cur, forwardFill(series, dates));

  const incomplete: string[] = [];
  const priceFilled = new Map<string, (number | null)[]>();
  for (const { holding, series } of histories) {
    if (series.length === 0) incomplete.push(holding.symbol);
    priceFilled.set(holding.id, forwardFill(series, dates));
  }

  const points: HistoryPoint[] = dates.map((date, i) => {
    let value = 0;
    let invested = 0;

    for (const h of holdings) {
      // Only units actually owned on this date count toward that day's value.
      let unitsHeld = 0;
      for (const lot of h.lots) {
        if (lot.date <= date) {
          unitsHeld += lot.quantity;
          invested += lotCosts.get(lot.id) ?? 0;
        }
      }
      if (unitsHeld === 0) continue;

      const nativeCurrency = currencyOf.get(h.id) ?? h.purchaseCurrency;
      let price: number | null;

      if (!h.symbol || h.kind === "cash") {
        price = h.manualPrice ?? 1;
      } else {
        price = priceFilled.get(h.id)?.[i] ?? null;
        // No history for this symbol — fall back to the live price so the
        // holding still contributes rather than vanishing from the total.
        if (price === null) {
          price = liveQuotes.get(h.symbol.toUpperCase())?.price ?? null;
        }
      }
      if (price === null) continue;

      const rate =
        nativeCurrency === master ? 1 : (fxFilled.get(nativeCurrency)?.[i] ?? null);
      if (rate === null) continue;

      value += unitsHeld * price * rate;
    }

    return { date, value, invested };
  });

  // Drop leading days where nothing was owned yet.
  const firstOwned = points.findIndex((p) => p.invested > 0);
  const trimmed = firstOwned > 0 ? points.slice(firstOwned) : points;

  const series: HistorySeries = {
    points: trimmed,
    masterCurrency: master,
    range,
    incomplete,
    asOf,
  };
  cache.set(cacheKey, { at: Date.now(), series });
  return series;
}
