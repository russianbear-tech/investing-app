import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { readDb } from "@/lib/store";
import { valuePortfolio } from "@/lib/portfolio";
import { computeNetWorth } from "@/lib/networth";
import {
  getClient,
  buildPortfolioContext,
  streamClaude,
  RESEARCH_SYSTEM_PROMPT,
  NO_KEY_MESSAGE,
} from "@/lib/claude";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_TURNS = 24;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      messages?: { role: string; content: string }[];
    };

    const incoming = (body.messages ?? [])
      .filter((m) => (m.role === "user" || m.role === "assistant") && m.content?.trim())
      .slice(-MAX_TURNS);

    if (incoming.length === 0) {
      return NextResponse.json({ error: "Send a message first." }, { status: 400 });
    }

    const db = await readDb();
    const client = getClient(db);
    if (!client) return NextResponse.json({ error: NO_KEY_MESSAGE }, { status: 428 });

    // Give the model the live portfolio so it can answer questions about
    // holdings the user actually owns, not generic examples.
    let context: string | undefined;
    try {
      const summary = await valuePortfolio(db);
      const netWorth = await computeNetWorth(db, summary.totalValue);
      context = buildPortfolioContext(summary, db, netWorth);
    } catch (err) {
      console.error("[api/chat] portfolio context unavailable:", err);
    }

    const messages: Anthropic.MessageParam[] = incoming.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const stream = streamClaude({
      client,
      system: RESEARCH_SYSTEM_PROMPT,
      context,
      messages,
      maxTokens: 8000,
      effort: "medium",
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("[api/chat]", err);
    return NextResponse.json({ error: "Chat request failed." }, { status: 500 });
  }
}
