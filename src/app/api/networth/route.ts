import { NextResponse } from "next/server";
import { readDb } from "@/lib/store";
import { valuePortfolio } from "@/lib/portfolio";
import { computeNetWorth } from "@/lib/networth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await readDb();
    // Skip pricing entirely when there are no holdings — a user who only
    // tracks cash and debt shouldn't wait on market data.
    const investments =
      db.holdings.length > 0 ? (await valuePortfolio(db)).totalValue : 0;
    const summary = await computeNetWorth(db, investments);
    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[api/networth]", err);
    return NextResponse.json(
      { error: "Could not work out your net worth." },
      { status: 500 }
    );
  }
}
