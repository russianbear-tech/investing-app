import { NextRequest, NextResponse } from "next/server";
import { readDb, updateDb, newId } from "@/lib/store";
import { lockAmount } from "@/lib/fx";
import { parseMoneyInput, pickOption } from "@/lib/entryInput";
import { INCOME_CATEGORY_ORDER, IncomeEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await readDb();
  return NextResponse.json({ income: db.income });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const source = String(body.source ?? "").trim();
    if (!source) return NextResponse.json({ error: "Say where it came from." }, { status: 400 });

    const { data, error } = parseMoneyInput(body);
    if (error || !data) return NextResponse.json({ error }, { status: 400 });

    // The rate is fetched and frozen here, once. Nothing downstream re-converts.
    const locked = await lockAmount(data.amount, data.currency, data.date);

    const now = new Date().toISOString();
    const entry: IncomeEntry = {
      id: newId(),
      source,
      category: pickOption(body.category, INCOME_CATEGORY_ORDER, "salary"),
      date: data.date,
      locked,
      notes: String(body.notes ?? "").trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    await updateDb((db) => ({ ...db, income: [...db.income, entry] }));
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    console.error("[api/income POST]", err);
    return NextResponse.json({ error: "Could not save that income." }, { status: 500 });
  }
}
