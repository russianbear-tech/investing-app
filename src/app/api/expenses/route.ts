import { NextRequest, NextResponse } from "next/server";
import { readDb, updateDb, newId } from "@/lib/store";
import { lockAmount } from "@/lib/fx";
import { parseMoneyInput, pickOption } from "@/lib/entryInput";
import { EXPENSE_CATEGORY_ORDER, ExpenseEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await readDb();
  return NextResponse.json({ expenses: db.expenses });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ error: "Give the expense a name." }, { status: 400 });

    const { data, error } = parseMoneyInput(body);
    if (error || !data) return NextResponse.json({ error }, { status: 400 });

    // Locked for the same reason income is: what a foreign-currency bill cost
    // you is settled the day you paid it.
    const locked = await lockAmount(data.amount, data.currency, data.date);

    const now = new Date().toISOString();
    const entry: ExpenseEntry = {
      id: newId(),
      name,
      category: pickOption(body.category, EXPENSE_CATEGORY_ORDER, "other"),
      date: data.date,
      locked,
      notes: String(body.notes ?? "").trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    await updateDb((db) => ({ ...db, expenses: [...db.expenses, entry] }));
    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    console.error("[api/expenses POST]", err);
    return NextResponse.json({ error: "Could not save that expense." }, { status: 500 });
  }
}
