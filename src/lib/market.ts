import YahooFinance from "yahoo-finance2";
import { Quote } from "./types";

// v4 exports a class rather than v2's singleton.
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const QUOTE_TTL_MS = 60_000;
const quoteCache = new Map<string, { at: number; quote: Quote }>();

/**
 * Yahoo's schema drifts often and a strict-validation failure would blank out
 * the whole dashboard. We validate nothing and read fields defensively instead.
 */
const LENIENT = { validateResult: false } as const;

function toNum(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function shapeQuote(raw: Record<string, unknown>): Quote | null {
  const symbol = typeof raw.symbol === "string" ? raw.symbol : "";
  const price = toNum(raw.regularMarketPrice);
  if (!symbol || price === undefined) return null;

  const previousClose = toNum(raw.regularMarketPreviousClose) ?? price;
  const change = toNum(raw.regularMarketChange) ?? price - previousClose;
  const changePercent =
    toNum(raw.regularMarketChangePercent) ??
    (previousClose ? (change / previousClose) * 100 : 0);

  return {
    symbol,
    name:
      (typeof raw.longName === "string" && raw.longName) ||
      (typeof raw.shortName === "string" && raw.shortName) ||
      symbol,
    price,
    currency: typeof raw.currency === "string" ? raw.currency.toUpperCase() : "USD",
    previousClose,
    change,
    changePercent,
    marketState: typeof raw.marketState === "string" ? raw.marketState : undefined,
    exchange:
      typeof raw.fullExchangeName === "string" ? raw.fullExchangeName : undefined,
    dayHigh: toNum(raw.regularMarketDayHigh),
    dayLow: toNum(raw.regularMarketDayLow),
    fiftyTwoWeekHigh: toNum(raw.fiftyTwoWeekHigh),
    fiftyTwoWeekLow: toNum(raw.fiftyTwoWeekLow),
    marketCap: toNum(raw.marketCap),
    peRatio: toNum(raw.trailingPE),
  };
}

/**
 * Batched, cached quote lookup. Unknown or delisted symbols are simply absent
 * from the returned map — callers fall back to manual pricing.
 */
export async function getQuotes(symbols: string[]): Promise<Map<string, Quote>> {
  const wanted = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const out = new Map<string, Quote>();
  const now = Date.now();
  const misses: string[] = [];

  for (const sym of wanted) {
    const hit = quoteCache.get(sym);
    if (hit && now - hit.at < QUOTE_TTL_MS) out.set(sym, hit.quote);
    else misses.push(sym);
  }

  if (misses.length === 0) return out;

  try {
    const raw = (await yf.quote(misses, {}, LENIENT)) as unknown;
    const list: Record<string, unknown>[] = Array.isArray(raw)
      ? (raw as Record<string, unknown>[])
      : raw
        ? [raw as Record<string, unknown>]
        : [];

    for (const item of list) {
      const q = shapeQuote(item);
      if (!q) continue;
      quoteCache.set(q.symbol.toUpperCase(), { at: now, quote: q });
      out.set(q.symbol.toUpperCase(), q);
    }
  } catch (err) {
    console.error("[market] quote fetch failed:", err);
    // Serve stale cache rather than showing nothing during an outage.
    for (const sym of misses) {
      const stale = quoteCache.get(sym);
      if (stale) out.set(sym, { ...stale.quote, stale: true });
    }
  }

  return out;
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  const map = await getQuotes([symbol]);
  return map.get(symbol.trim().toUpperCase()) ?? null;
}

export interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange?: string;
}

export async function searchSymbols(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = (await yf.search(q, { quotesCount: 12, newsCount: 0 }, LENIENT)) as {
      quotes?: Record<string, unknown>[];
    };
    return (res?.quotes ?? [])
      .filter((r) => typeof r.symbol === "string" && r.symbol)
      .map((r) => ({
        symbol: String(r.symbol),
        name:
          (typeof r.longname === "string" && r.longname) ||
          (typeof r.shortname === "string" && r.shortname) ||
          String(r.symbol),
        type: typeof r.typeDisp === "string" ? r.typeDisp : "Equity",
        exchange: typeof r.exchDisp === "string" ? r.exchDisp : undefined,
      }))
      .filter((r) => r.type !== "Option");
  } catch (err) {
    console.error("[market] search failed:", err);
    return [];
  }
}

/**
 * Closing price on (or the last trading day before) `date`.
 * Used to price a cost basis at the exchange rate that actually applied when
 * the purchase was made.
 */
export async function getCloseOn(
  symbol: string,
  date: string
): Promise<number | null> {
  try {
    const target = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(target.getTime())) return null;

    // Look back far enough to clear weekends and holidays.
    const period1 = new Date(target.getTime() - 10 * 86_400_000);
    const period2 = new Date(
      Math.min(target.getTime() + 2 * 86_400_000, Date.now())
    );
    if (period2 <= period1) return null;

    const res = (await yf.chart(
      symbol,
      { period1, period2, interval: "1d" },
      LENIENT
    )) as { quotes?: { date?: unknown; close?: unknown }[] };

    const rows = (res?.quotes ?? [])
      .map((row) => ({
        t: row.date instanceof Date ? row.date.getTime() : Date.parse(String(row.date)),
        close: toNum(row.close),
      }))
      .filter((r) => Number.isFinite(r.t) && r.close !== undefined)
      .sort((a, b) => a.t - b.t);

    const onOrBefore = rows.filter((r) => r.t <= target.getTime() + 86_400_000);
    const pick = onOrBefore.length > 0 ? onOrBefore[onOrBefore.length - 1] : rows[0];
    return pick?.close ?? null;
  } catch (err) {
    console.error(`[market] historical close failed for ${symbol}:`, err);
    return null;
  }
}

/** Daily closes for a sparkline / performance chart. */
export async function getHistory(
  symbol: string,
  days = 90
): Promise<{ date: string; close: number }[]> {
  try {
    const period1 = new Date(Date.now() - days * 86_400_000);
    const res = (await yf.chart(
      symbol,
      { period1, interval: "1d" },
      LENIENT
    )) as { quotes?: { date?: unknown; close?: unknown }[] };

    return (res?.quotes ?? [])
      .map((row) => ({
        date:
          row.date instanceof Date
            ? row.date.toISOString().slice(0, 10)
            : String(row.date ?? ""),
        close: toNum(row.close) ?? 0,
      }))
      .filter((r) => r.close > 0 && r.date);
  } catch (err) {
    console.error("[market] history failed:", err);
    return [];
  }
}
