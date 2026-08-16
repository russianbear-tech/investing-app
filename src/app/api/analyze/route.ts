import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/store";
import { getQuote } from "@/lib/market";
import {
  getClient,
  streamClaude,
  RESEARCH_SYSTEM_PROMPT,
  NO_KEY_MESSAGE,
} from "@/lib/claude";
import { formatMoney, formatPercent } from "@/lib/fx";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * Deep-dive on a single ticker — what it is, what just happened, and the case
 * for and against. Used by the watchlist click-through.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { symbol?: string };
    const symbol = String(body.symbol ?? "").trim().toUpperCase();
    if (!symbol) {
      return NextResponse.json({ error: "No ticker symbol given." }, { status: 400 });
    }

    const db = await readDb();
    const client = getClient(db);
    if (!client) return NextResponse.json({ error: NO_KEY_MESSAGE }, { status: 428 });

    const quote = await getQuote(symbol);
    const watch = db.watchlist.find((w) => w.symbol === symbol);
    const owned = db.holdings.filter((h) => h.symbol === symbol);

    const facts: string[] = [`# Live data for ${symbol}`];
    if (quote) {
      facts.push(
        `${quote.name} — ${formatMoney(quote.price, quote.currency)}, ` +
          `${formatPercent(quote.changePercent)} today` +
          (quote.exchange ? `, trading on ${quote.exchange}` : "")
      );
      if (quote.fiftyTwoWeekLow && quote.fiftyTwoWeekHigh) {
        facts.push(
          `52-week range: ${formatMoney(quote.fiftyTwoWeekLow, quote.currency)} to ${formatMoney(quote.fiftyTwoWeekHigh, quote.currency)}`
        );
      }
      if (quote.marketCap) facts.push(`Market cap: ${formatMoney(quote.marketCap, quote.currency, { compact: true })}`);
      if (quote.peRatio) facts.push(`P/E ratio: ${quote.peRatio.toFixed(1)}`);
    } else {
      facts.push("Live price unavailable — search the web for the current price.");
    }

    if (watch) {
      const since =
        quote && watch.priceAtAdd > 0
          ? ((quote.price - watch.priceAtAdd) / watch.priceAtAdd) * 100
          : null;
      facts.push(
        `\nOn their watchlist since ${watch.addedAt.slice(0, 10)}, added at ` +
          `${formatMoney(watch.priceAtAdd, watch.currencyAtAdd)}` +
          (since !== null ? ` — ${formatPercent(since)} since then.` : ".")
      );
    }
    if (owned.length > 0) {
      // Units live on the lots, not the holding — reading h.quantity here gave
      // undefined, so this sentence used to read "they already own NaN units".
      const units = owned.reduce(
        (sum, h) => sum + h.lots.reduce((n, l) => n + l.quantity, 0),
        0
      );
      facts.push(`\nThey already own ${units} units of this across their platforms.`);
    }

    const stream = streamClaude({
      client,
      system: RESEARCH_SYSTEM_PROMPT,
      context: facts.join("\n"),
      messages: [
        {
          role: "user",
          content: `Tell me about ${symbol}. Search the web for recent news first, then cover:

1. **What this company actually does** — how it makes money, in plain terms.
2. **What's happened recently** — the last few weeks. Real news, with dates, and why it moved the price.
3. **The case for it** — what's genuinely working, and what would have to go right.
4. **The case against it** — the real risks, not generic hedging.
5. **What to watch** — the specific things that would tell me this is going well or badly.

Use the headers above. Keep it tight — this is a briefing, not an essay.`,
        },
      ],
      maxTokens: 12000,
      effort: "high",
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("[api/analyze]", err);
    return NextResponse.json({ error: "Could not analyze that stock." }, { status: 500 });
  }
}
