import { NextRequest, NextResponse } from "next/server";
import { getPriceSeries, PriceRange } from "@/lib/market";

export const dynamic = "force-dynamic";

const RANGES: PriceRange[] = ["1d", "1w", "1m", "3m", "1y", "5y", "all"];

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const symbol = (params.get("symbol") ?? "").trim();
  if (!symbol) {
    return NextResponse.json({ error: "No symbol given." }, { status: 400 });
  }

  const raw = params.get("range") ?? "3m";
  const range = (RANGES.includes(raw as PriceRange) ? raw : "3m") as PriceRange;

  try {
    const series = await getPriceSeries(symbol, range);
    if (!series) {
      return NextResponse.json(
        { error: `No price history available for ${symbol}.` },
        { status: 404 }
      );
    }
    return NextResponse.json({ series });
  } catch (err) {
    console.error("[api/symbol-history]", err);
    return NextResponse.json(
      { error: "Could not load that price history." },
      { status: 500 }
    );
  }
}
