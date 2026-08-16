import { getQuotes, getCloseOn } from "./market";
import { LockedAmount } from "./types";

const FX_TTL_MS = 5 * 60_000;
const rateCache = new Map<string, { at: number; rate: number }>();

// Past exchange rates never change, so this cache never expires.
const historicalCache = new Map<string, number>();

/** Yahoo quotes FX as e.g. USDCAD=X, whose price is "1 USD in CAD". */
function pair(from: string, to: string): string {
  return `${from}${to}=X`;
}

/** A single live rate, trying the inverse pair when the direct one is absent. */
async function liveDirect(from: string, to: string): Promise<number | null> {
  const quotes = await getQuotes([pair(from, to)]);
  const direct = quotes.get(pair(from, to));
  if (direct && direct.price > 0) return direct.price;

  const back = await getQuotes([pair(to, from)]);
  const inverse = back.get(pair(to, from));
  if (inverse && inverse.price > 0) return 1 / inverse.price;

  return null;
}

/** A single historical rate, trying the inverse pair when the direct one is absent. */
async function historicalDirect(
  from: string,
  to: string,
  day: string
): Promise<number | null> {
  const direct = await getCloseOn(pair(from, to), day);
  if (direct !== null && direct > 0) return direct;

  const inverse = await getCloseOn(pair(to, from), day);
  if (inverse !== null && inverse > 0) return 1 / inverse;

  return null;
}

/**
 * The exchange rate that applied on `date`.
 *
 * This matters for correctness, not just precision: a cost basis converted at
 * today's rate would fold currency drift into what you "paid", quietly
 * misstating every cross-currency gain. Returns null if the rate can't be
 * resolved, so callers can fall back and flag the number as approximate.
 */
export async function getHistoricalRate(
  from: string,
  to: string,
  date: string
): Promise<number | null> {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return 1;

  const day = date.slice(0, 10);
  const key = `${f}${t}:${day}`;
  const cached = historicalCache.get(key);
  if (cached !== undefined) return cached;

  let rate = await historicalDirect(f, t, day);

  // Most currencies have no direct pair against CAD — RUBCAD=X is quoteless —
  // but nearly everything is quoted against USD. Going through USD is the
  // difference between a correct conversion and no conversion at all.
  if (rate === null && f !== "USD" && t !== "USD") {
    const [toUsd, fromUsd] = await Promise.all([
      historicalDirect(f, "USD", day),
      historicalDirect("USD", t, day),
    ]);
    if (toUsd !== null && fromUsd !== null) rate = toUsd * fromUsd;
  }

  if (rate === null || !Number.isFinite(rate) || rate <= 0) return null;
  historicalCache.set(key, rate);
  return rate;
}

/** Today's rate, with the same USD triangulation fallback. */
export async function getLiveRate(from: string, to: string): Promise<number | null> {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return 1;

  let rate = await liveDirect(f, t);
  if (rate === null && f !== "USD" && t !== "USD") {
    const [toUsd, fromUsd] = await Promise.all([
      liveDirect(f, "USD"),
      liveDirect("USD", t),
    ]);
    if (toUsd !== null && fromUsd !== null) rate = toUsd * fromUsd;
  }

  return rate !== null && Number.isFinite(rate) && rate > 0 ? rate : null;
}

/**
 * Resolves the rate for `day`, preferring the rate that actually applied then
 * and falling back to the live one — which is what happens for money recorded
 * today, before the day has a closing print.
 */
async function resolveRate(
  from: string,
  to: string,
  day: string
): Promise<{ rate: number; source: "historical" | "live" } | null> {
  const historical = await getHistoricalRate(from, to, day);
  if (historical !== null) return { rate: historical, source: "historical" };

  const live = await getLiveRate(from, to);
  if (live !== null) return { rate: live, source: "live" };

  return null;
}

/**
 * Freezes what `amount` was worth on `date`, in both master currencies.
 *
 * Called once, when a payment is recorded. Everything downstream reads the
 * stored figures — see `LockedAmount` for why this is stored rather than
 * derived on the fly.
 */
export async function lockAmount(
  amount: number,
  currency: string,
  date: string
): Promise<LockedAmount> {
  const cur = currency.trim().toUpperCase();
  const day = date.slice(0, 10);
  const lockedAt = new Date().toISOString();

  const base: Omit<LockedAmount, "inUSD" | "inCAD" | "rateUSD" | "rateCAD" | "rateSource"> = {
    amount,
    currency: cur,
    rateDate: day,
    lockedAt,
  };

  const [usd, cad] = await Promise.all([
    cur === "USD" ? Promise.resolve({ rate: 1, source: "historical" as const }) : resolveRate(cur, "USD", day),
    cur === "CAD" ? Promise.resolve({ rate: 1, source: "historical" as const }) : resolveRate(cur, "CAD", day),
  ]);

  // One leg can resolve while the other doesn't. Rather than lose the whole
  // conversion, bridge the missing leg across the USD/CAD rate, which is
  // always available.
  let rateUSD = usd?.rate ?? null;
  let rateCAD = cad?.rate ?? null;

  if (rateUSD !== null && rateCAD === null) {
    const usdCad = await resolveRate("USD", "CAD", day);
    if (usdCad) rateCAD = rateUSD * usdCad.rate;
  } else if (rateCAD !== null && rateUSD === null) {
    const cadUsd = await resolveRate("CAD", "USD", day);
    if (cadUsd) rateUSD = rateCAD * cadUsd.rate;
  }

  if (rateUSD === null || rateCAD === null) {
    // No rate anywhere. Store the raw amount but say so, so the UI can warn
    // instead of presenting an unconverted figure as a converted one.
    return {
      ...base,
      inUSD: amount,
      inCAD: amount,
      rateUSD: 1,
      rateCAD: 1,
      rateSource: "unavailable",
    };
  }

  // "live" when the day had no closing print yet — recording today's pay, most
  // often. Worth distinguishing: that figure was locked from an intraday rate.
  const usedLive = usd?.source === "live" || cad?.source === "live";

  return {
    ...base,
    inUSD: amount * rateUSD,
    inCAD: amount * rateCAD,
    rateUSD,
    rateCAD,
    rateSource: usedLive ? "live" : "historical",
  };
}

/**
 * A conversion table built once per request so every number on a page is
 * converted with the same rates — a portfolio total that used slightly
 * different rates per row wouldn't add up.
 */
export class FxTable {
  constructor(
    private readonly rates: Map<string, number>,
    readonly target: string
  ) {}

  /** Converts `amount` from `from` into the table's target currency. */
  convert(amount: number, from: string): number {
    const f = from.toUpperCase();
    if (f === this.target) return amount;
    const rate = this.rates.get(f);
    if (rate === undefined) return amount; // unknown currency: pass through
    return amount * rate;
  }

  rateFor(from: string): number {
    const f = from.toUpperCase();
    if (f === this.target) return 1;
    return this.rates.get(f) ?? 1;
  }

  /** True when this currency converted cleanly; false means `convert` passed through. */
  has(from: string): boolean {
    const f = from.toUpperCase();
    return f === this.target || this.rates.has(f);
  }

  /** Currencies we couldn't get a rate for — surfaced as a warning in the UI. */
  missing(currencies: string[]): string[] {
    return [...new Set(currencies.map((c) => c.toUpperCase()))].filter(
      (c) => c !== this.target && !this.rates.has(c)
    );
  }
}

/**
 * Fetches every `from -> target` rate needed, in one batched call.
 */
export async function buildFxTable(
  fromCurrencies: string[],
  target: string
): Promise<FxTable> {
  const tgt = target.toUpperCase();
  const needed = [...new Set(fromCurrencies.map((c) => c.toUpperCase()))].filter(
    (c) => c && c !== tgt
  );

  const rates = new Map<string, number>();
  const now = Date.now();
  const toFetch: string[] = [];

  for (const from of needed) {
    const key = `${from}${tgt}`;
    const hit = rateCache.get(key);
    if (hit && now - hit.at < FX_TTL_MS) rates.set(from, hit.rate);
    else toFetch.push(from);
  }

  if (toFetch.length > 0) {
    const pairs = toFetch.map((from) => pair(from, tgt));
    const quotes = await getQuotes(pairs);

    for (const from of toFetch) {
      const q = quotes.get(pair(from, tgt));
      if (q && q.price > 0) {
        rates.set(from, q.price);
        rateCache.set(`${from}${tgt}`, { at: now, rate: q.price });
        continue;
      }
      // Fall back to the inverse pair, then through USD. Without the USD hop a
      // rouble balance against a CAD master currency would find no rate and be
      // passed through unconverted.
      const resolved = await getLiveRate(from, tgt);
      if (resolved !== null) {
        rates.set(from, resolved);
        rateCache.set(`${from}${tgt}`, { at: now, rate: resolved });
      }
    }
  }

  return new FxTable(rates, tgt);
}

// Formatting lives in ./format so client components can use it without
// pulling in the server-only market data client.
export { formatMoney, formatPercent } from "./format";
