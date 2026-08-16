import { NextRequest, NextResponse } from "next/server";
import { lockAmount } from "@/lib/fx";
import { parseMoneyInput } from "@/lib/entryInput";

export const dynamic = "force-dynamic";

/**
 * What an amount would lock at, without saving anything.
 *
 * Runs the same `lockAmount` the write path uses, so the figure previewed in
 * the form is by construction the figure that gets stored — a preview computed
 * a second way could quietly disagree with it.
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const { data, error } = parseMoneyInput({
    amount: params.get("amount"),
    currency: params.get("currency"),
    date: params.get("date"),
  });
  if (error || !data) return NextResponse.json({ error }, { status: 400 });

  try {
    const locked = await lockAmount(data.amount, data.currency, data.date);
    return NextResponse.json({ locked });
  } catch (err) {
    console.error("[api/fx]", err);
    return NextResponse.json({ error: "Could not fetch that rate." }, { status: 500 });
  }
}
