import { NextRequest, NextResponse } from "next/server";
import { readDb, updateDb } from "@/lib/store";
import { lockAmount } from "@/lib/fx";
import { parseMoneyInput, pickOption } from "@/lib/entryInput";
import { INCOME_CATEGORY_ORDER, IncomeEntry, LockedAmount } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const db = await readDb();
    const existing = db.income.find((e) => e.id === id);
    if (!existing) {
      return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    }

    // Only the money itself re-locks. Renaming the source or fixing a typo in
    // the notes must leave the recorded exchange rate exactly as it was.
    const touchesMoney =
      "amount" in body || "currency" in body || "date" in body;

    let locked: LockedAmount = existing.locked;
    if (touchesMoney) {
      const { data, error } = parseMoneyInput({
        amount: body.amount ?? existing.locked.amount,
        currency: body.currency ?? existing.locked.currency,
        date: body.date ?? existing.date,
      });
      if (error || !data) return NextResponse.json({ error }, { status: 400 });

      const unchanged =
        data.amount === existing.locked.amount &&
        data.currency === existing.locked.currency &&
        data.date === existing.date;

      // A correction is a new fact about when and what was paid, so it gets a
      // fresh lock at the corrected date. An unchanged save keeps the old one.
      locked = unchanged ? existing.locked : await lockAmount(data.amount, data.currency, data.date);
    }

    const updated = await updateDb((current) => ({
      ...current,
      income: current.income.map((e) => {
        if (e.id !== id) return e;
        const next: IncomeEntry = { ...e, locked, updatedAt: new Date().toISOString() };
        if ("source" in body) next.source = String(body.source).trim() || e.source;
        if ("category" in body) {
          next.category = pickOption(body.category, INCOME_CATEGORY_ORDER, e.category);
        }
        if ("date" in body) next.date = locked.rateDate;
        if ("notes" in body) next.notes = String(body.notes ?? "").trim() || undefined;
        return next;
      }),
    }));

    return NextResponse.json({ entry: updated.income.find((e) => e.id === id) });
  } catch (err) {
    console.error("[api/income PATCH]", err);
    return NextResponse.json({ error: "Could not update that entry." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    let found = false;
    await updateDb((db) => {
      found = db.income.some((e) => e.id === id);
      return { ...db, income: db.income.filter((e) => e.id !== id) };
    });
    if (!found) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/income DELETE]", err);
    return NextResponse.json({ error: "Could not delete that entry." }, { status: 500 });
  }
}
