import { NextResponse } from "next/server";
import { readDb } from "@/lib/store";
import { valuePortfolio } from "@/lib/portfolio";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await readDb();
    const summary = await valuePortfolio(db);
    return NextResponse.json({ summary, settings: db.settings });
  } catch (err) {
    console.error("[api/portfolio]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to value portfolio" },
      { status: 500 }
    );
  }
}
