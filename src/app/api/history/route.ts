import { NextRequest, NextResponse } from "next/server";
import { readDb } from "@/lib/store";
import { buildHistory, Range } from "@/lib/history";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const RANGES: Range[] = ["1m", "3m", "6m", "1y", "all"];

export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get("range") ?? "6m";
    const range = (RANGES.includes(raw as Range) ? raw : "6m") as Range;

    const db = await readDb();
    const series = await buildHistory(db, range);
    return NextResponse.json(series);
  } catch (err) {
    console.error("[api/history]", err);
    return NextResponse.json(
      { error: "Could not build your portfolio history." },
      { status: 500 }
    );
  }
}
