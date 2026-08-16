import { NextRequest, NextResponse } from "next/server";
import { readDb, updateDb } from "@/lib/store";
import { Liability } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; paymentId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, paymentId } = await params;
  try {
    const db = await readDb();
    const liability = db.liabilities.find((l) => l.id === id);
    if (!liability) {
      return NextResponse.json({ error: "Debt not found." }, { status: 404 });
    }

    const payment = liability.payments.find((p) => p.id === paymentId);
    if (!payment) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }

    // Only the newest payment can be cleanly undone: its `balanceBefore` is
    // still the balance we'd be returning to. Removing an older one would
    // leave every payment after it describing a balance that never existed, so
    // the record goes but the balance stays and the caller is told.
    const sorted = [...liability.payments].sort((a, b) =>
      a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)
    );
    const isLatest = sorted[sorted.length - 1]?.id === paymentId;

    const now = new Date().toISOString();
    await updateDb((current) => ({
      ...current,
      liabilities: current.liabilities.map((l) => {
        if (l.id !== id) return l;
        const next: Liability = {
          ...l,
          payments: l.payments.filter((p) => p.id !== paymentId),
          updatedAt: now,
        };
        if (isLatest) {
          next.balance = payment.balanceBefore;
          next.history = l.history.filter((h) => h.date !== payment.date);
        }
        return next;
      }),
    }));

    return NextResponse.json({
      ok: true,
      balanceRestored: isLatest,
      message: isLatest
        ? undefined
        : "The payment was removed, but the balance was left as it is — undoing an older payment would misstate every payment made after it. Adjust the balance by hand if it needs correcting.",
    });
  } catch (err) {
    console.error("[api/liabilities payments DELETE]", err);
    return NextResponse.json({ error: "Could not remove that payment." }, { status: 500 });
  }
}
