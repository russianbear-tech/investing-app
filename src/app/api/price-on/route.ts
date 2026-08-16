import { NextRequest, NextResponse } from "next/server";
import { priceOnDate } from "@/lib/pricing";

export const dynamic = "force-dynamic";

/**
 * Preview endpoint for the contribution form — lets the UI show
 * "≈ 12.07 units at $41.41" before anything is saved.
 */
export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol") ?? "";
  const date = req.nextUrl.searchParams.get("date") ?? "";
  const currency = req.nextUrl.searchParams.get("currency") ?? "CAD";

  if (!symbol || !date) {
    return NextResponse.json({ error: "Need a symbol and a date." }, { status: 400 });
  }

  const result = await priceOnDate(symbol, date, currency);
  if (!result) {
    return NextResponse.json(
      { error: `No price found for ${symbol.toUpperCase()} on ${date.slice(0, 10)}.` },
      { status: 404 }
    );
  }

  return NextResponse.json(result);
}
