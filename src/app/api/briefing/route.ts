import { NextResponse } from "next/server";
import { readDb } from "@/lib/store";
import { valuePortfolio } from "@/lib/portfolio";
import { computeNetWorth } from "@/lib/networth";
import {
  getClient,
  buildPortfolioContext,
  streamClaude,
  BRIEFING_SYSTEM_PROMPT,
  NO_KEY_MESSAGE,
} from "@/lib/claude";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST() {
  try {
    const db = await readDb();
    const client = getClient(db);
    if (!client) return NextResponse.json({ error: NO_KEY_MESSAGE }, { status: 428 });

    if (db.holdings.length === 0 && db.watchlist.length === 0) {
      return NextResponse.json(
        { error: "Add a holding or a watchlist stock first — there's nothing to brief on yet." },
        { status: 400 }
      );
    }

    const summary = await valuePortfolio(db);
    const netWorth = await computeNetWorth(db, summary.totalValue);
    const context = buildPortfolioContext(summary, db, netWorth);

    const today = new Date().toLocaleDateString("en-CA", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const stream = streamClaude({
      client,
      system: BRIEFING_SYSTEM_PROMPT,
      context,
      messages: [
        {
          role: "user",
          content: `Today is ${today}. Write my morning briefing. Search for what actually happened with my holdings and the wider market since yesterday's close.`,
        },
      ],
      // Briefings synthesize several searches, so give them more room and effort.
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
    console.error("[api/briefing]", err);
    return NextResponse.json({ error: "Could not generate the briefing." }, { status: 500 });
  }
}
