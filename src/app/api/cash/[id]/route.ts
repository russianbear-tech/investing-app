import { NextRequest, NextResponse } from "next/server";
import { updateDb } from "@/lib/store";
import { CASH_KIND_ORDER, CashAccount, CashKind } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    let found = false;

    const db = await updateDb((current) => ({
      ...current,
      cashAccounts: current.cashAccounts.map((a) => {
        if (a.id !== id) return a;
        found = true;
        const next: CashAccount = { ...a, updatedAt: new Date().toISOString() };

        if ("name" in body) next.name = String(body.name).trim() || a.name;
        if ("institution" in body) {
          next.institution = String(body.institution ?? "").trim() || undefined;
        }
        if ("notes" in body) next.notes = String(body.notes ?? "").trim() || undefined;
        if ("currency" in body) {
          const c = String(body.currency).toUpperCase();
          if (c === "USD" || c === "CAD") next.currency = c;
        }
        if ("kind" in body) {
          const k = String(body.kind).toLowerCase();
          if (CASH_KIND_ORDER.includes(k as CashKind)) next.kind = k as CashKind;
        }
        if ("balance" in body) {
          const b = Number(body.balance);
          if (Number.isFinite(b) && b >= 0 && b !== a.balance) {
            next.balance = b;
            // One snapshot per day, so repeated edits don't flood the history.
            const today = next.updatedAt.slice(0, 10);
            const rest = a.history.filter((h) => h.date !== today);
            next.history = [...rest, { date: today, balance: b }].sort((x, y) =>
              x.date.localeCompare(y.date)
            );
          }
        }
        return next;
      }),
    }));

    if (!found) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    return NextResponse.json({ account: db.cashAccounts.find((a) => a.id === id) });
  } catch (err) {
    console.error("[api/cash PATCH]", err);
    return NextResponse.json({ error: "Could not update that account." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    let found = false;
    await updateDb((db) => {
      found = db.cashAccounts.some((a) => a.id === id);
      return { ...db, cashAccounts: db.cashAccounts.filter((a) => a.id !== id) };
    });
    if (!found) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/cash DELETE]", err);
    return NextResponse.json({ error: "Could not delete that account." }, { status: 500 });
  }
}
