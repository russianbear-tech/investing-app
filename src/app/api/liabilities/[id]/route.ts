import { NextRequest, NextResponse } from "next/server";
import { updateDb } from "@/lib/store";
import { optionalNumber, parseDate } from "@/lib/entryInput";
import { Liability, LIABILITY_KIND_ORDER, LiabilityKind } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    let found = false;

    const db = await updateDb((current) => ({
      ...current,
      liabilities: current.liabilities.map((l) => {
        if (l.id !== id) return l;
        found = true;
        const next: Liability = { ...l, updatedAt: new Date().toISOString() };

        if ("name" in body) next.name = String(body.name).trim() || l.name;
        if ("notes" in body) next.notes = String(body.notes ?? "").trim() || undefined;
        if ("currency" in body) {
          const c = String(body.currency).toUpperCase();
          if (c === "USD" || c === "CAD") next.currency = c;
        }
        if ("kind" in body) {
          const k = String(body.kind).toLowerCase();
          if (LIABILITY_KIND_ORDER.includes(k as LiabilityKind)) {
            next.kind = k as LiabilityKind;
          }
        }
        if ("interestRate" in body) {
          const raw = body.interestRate;
          if (raw === "" || raw === null) next.interestRate = undefined;
          else {
            const r = Number(raw);
            if (Number.isFinite(r) && r >= 0 && r <= 100) next.interestRate = r;
          }
        }
        if ("balance" in body) {
          const b = Number(body.balance);
          if (Number.isFinite(b) && b >= 0 && b !== l.balance) {
            next.balance = b;
            // One snapshot per day keeps the paid-down history readable.
            const today = next.updatedAt.slice(0, 10);
            const rest = l.history.filter((h) => h.date !== today);
            next.history = [...rest, { date: today, balance: b }].sort((x, y) =>
              x.date.localeCompare(y.date)
            );
          }
        }

        // Billing details, set from the Income & bills tab. Blank clears them.
        if ("dueDay" in body) {
          const d = Math.trunc(Number(body.dueDay));
          next.dueDay = Number.isFinite(d) && d >= 1 && d <= 31 ? d : undefined;
        }
        if ("statementBalance" in body) {
          next.statementBalance = optionalNumber(body.statementBalance);
        }
        if ("minimumDue" in body) next.minimumDue = optionalNumber(body.minimumDue);
        if ("creditLimit" in body) next.creditLimit = optionalNumber(body.creditLimit);
        if ("autopay" in body) next.autopay = Boolean(body.autopay) || undefined;

        // Repayment tracking.
        if ("originalAmount" in body) {
          next.originalAmount = optionalNumber(body.originalAmount);
        }
        if ("regularPayment" in body) {
          next.regularPayment = optionalNumber(body.regularPayment);
        }
        if ("startDate" in body) next.startDate = parseDate(body.startDate);

        return next;
      }),
    }));

    if (!found) return NextResponse.json({ error: "Debt not found." }, { status: 404 });
    return NextResponse.json({ liability: db.liabilities.find((l) => l.id === id) });
  } catch (err) {
    console.error("[api/liabilities PATCH]", err);
    return NextResponse.json({ error: "Could not update that debt." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    let found = false;
    await updateDb((db) => {
      found = db.liabilities.some((l) => l.id === id);
      return { ...db, liabilities: db.liabilities.filter((l) => l.id !== id) };
    });
    if (!found) return NextResponse.json({ error: "Debt not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/liabilities DELETE]", err);
    return NextResponse.json({ error: "Could not delete that debt." }, { status: 500 });
  }
}
