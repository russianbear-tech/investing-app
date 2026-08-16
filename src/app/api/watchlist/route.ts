import { NextRequest, NextResponse } from "next/server";
import { readDb, updateDb, newId } from "@/lib/store";
import { getQuote, getQuotes } from "@/lib/market";
import { buildFxTable } from "@/lib/fx";
import { WatchItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export interface ValuedWatchItem extends WatchItem {
  currentPrice: number | null;
  currency: string;
  /** Move since you added it — the number the watchlist exists to show. */
  changeSinceAdd: number | null;
  changeSinceAddPercent: number | null;
  dayChangePercent: number | null;
  /** Current price expressed in the app's master currency. */
  priceInMaster: number | null;
  marketState?: string;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  daysHeld: number;
}

export async function GET() {
  try {
    const db = await readDb();
    const master = db.settings.masterCurrency;

    if (db.watchlist.length === 0) {
      return NextResponse.json({ items: [], masterCurrency: master });
    }

    const quotes = await getQuotes(db.watchlist.map((w) => w.symbol));
    const currencies = db.watchlist.map(
      (w) => quotes.get(w.symbol.toUpperCase())?.currency ?? w.currencyAtAdd
    );
    const fx = await buildFxTable(currencies, master);

    const items: ValuedWatchItem[] = db.watchlist.map((w) => {
      const q = quotes.get(w.symbol.toUpperCase()) ?? null;
      const currentPrice = q?.price ?? null;
      const currency = q?.currency ?? w.currencyAtAdd;
      const changeSinceAdd =
        currentPrice !== null && w.priceAtAdd > 0 ? currentPrice - w.priceAtAdd : null;

      return {
        ...w,
        currentPrice,
        currency,
        changeSinceAdd,
        changeSinceAddPercent:
          changeSinceAdd !== null && w.priceAtAdd > 0
            ? (changeSinceAdd / w.priceAtAdd) * 100
            : null,
        dayChangePercent: q?.changePercent ?? null,
        priceInMaster: currentPrice !== null ? fx.convert(currentPrice, currency) : null,
        marketState: q?.marketState,
        fiftyTwoWeekHigh: q?.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: q?.fiftyTwoWeekLow,
        daysHeld: Math.max(
          0,
          Math.floor((Date.now() - Date.parse(w.addedAt)) / 86_400_000)
        ),
      };
    });

    return NextResponse.json({ items, masterCurrency: master });
  } catch (err) {
    console.error("[api/watchlist GET]", err);
    return NextResponse.json({ error: "Could not load the watchlist." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { symbol?: string; notes?: string };
    const symbol = String(body.symbol ?? "").trim().toUpperCase();
    if (!symbol) {
      return NextResponse.json({ error: "Enter a ticker symbol." }, { status: 400 });
    }

    const db = await readDb();
    if (db.watchlist.some((w) => w.symbol === symbol)) {
      return NextResponse.json(
        { error: `${symbol} is already on your watchlist.` },
        { status: 409 }
      );
    }

    // Snapshot the price now — this is the baseline every future "since added"
    // percentage is measured against, so it has to be captured at add time.
    const quote = await getQuote(symbol);
    if (!quote) {
      return NextResponse.json(
        { error: `Couldn't find a price for "${symbol}". Check the ticker symbol.` },
        { status: 404 }
      );
    }

    const item: WatchItem = {
      id: newId(),
      symbol: quote.symbol.toUpperCase(),
      name: quote.name,
      addedAt: new Date().toISOString(),
      priceAtAdd: quote.price,
      currencyAtAdd: quote.currency,
      notes: String(body.notes ?? "").trim() || undefined,
    };

    await updateDb((current) => ({ ...current, watchlist: [...current.watchlist, item] }));
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    console.error("[api/watchlist POST]", err);
    return NextResponse.json({ error: "Could not add that to the watchlist." }, { status: 500 });
  }
}
