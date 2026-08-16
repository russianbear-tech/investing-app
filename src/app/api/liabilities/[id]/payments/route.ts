import { NextRequest, NextResponse } from "next/server";
import { readDb, updateDb, newId } from "@/lib/store";
import { splitPayment } from "@/lib/debt";
import { optionalNumber } from "@/lib/entryInput";
import { todayLocalISO } from "@/lib/format";
import { DebtPayment, Liability } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = (await req.json()) as Record<string, unknown>;

    const db = await readDb();
    const liability = db.liabilities.find((l) => l.id === id);
    if (!liability) {
      return NextResponse.json({ error: "Debt not found." }, { status: 404 });
    }

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Enter what you paid as a number greater than zero." },
        { status: 400 }
      );
    }

    const date = String(body.date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
      return NextResponse.json({ error: "Enter the date as YYYY-MM-DD." }, { status: 400 });
    }
    if (date > todayLocalISO()) {
      return NextResponse.json(
        { error: "That date is in the future — record the payment once it's made." },
        { status: 400 }
      );
    }

    const split = splitPayment(liability, {
      amount,
      date,
      balanceAfter: optionalNumber(body.balanceAfter),
      interestPortion: optionalNumber(body.interestPortion),
    });

    const now = new Date().toISOString();
    const payment: DebtPayment = {
      id: newId(),
      date,
      amount,
      ...split,
      balanceBefore: liability.balance,
      notes: String(body.notes ?? "").trim() || undefined,
      createdAt: now,
    };

    const updated = await updateDb((current) => ({
      ...current,
      liabilities: current.liabilities.map((l) => {
        if (l.id !== id) return l;
        const next: Liability = {
          ...l,
          balance: payment.balanceAfter,
          payments: [...l.payments, payment].sort((a, b) => a.date.localeCompare(b.date)),
          updatedAt: now,
        };
        // Keep the balance history in step, one snapshot per day as elsewhere.
        const rest = l.history.filter((h) => h.date !== date);
        next.history = [...rest, { date, balance: payment.balanceAfter }].sort((x, y) =>
          x.date.localeCompare(y.date)
        );
        return next;
      }),
    }));

    return NextResponse.json(
      { payment, liability: updated.liabilities.find((l) => l.id === id) },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/liabilities payments POST]", err);
    return NextResponse.json({ error: "Could not record that payment." }, { status: 500 });
  }
}
