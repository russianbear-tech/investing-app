import { NextResponse } from "next/server";
import { readDb } from "@/lib/store";
import { computeCashflow } from "@/lib/cashflow";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await readDb();
    const summary = await computeCashflow(db);
    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[api/cashflow]", err);
    return NextResponse.json(
      { error: "Could not work out your cash flow." },
      { status: 500 }
    );
  }
}
