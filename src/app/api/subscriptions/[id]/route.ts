import { NextRequest, NextResponse } from "next/server";
import { updateDb } from "@/lib/store";
import { pickOption } from "@/lib/entryInput";
import { BILLING_CYCLE_ORDER, isCurrencyCode, Subscription } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    let found = false;

    const db = await updateDb((current) => ({
      ...current,
      subscriptions: current.subscriptions.map((s) => {
        if (s.id !== id) return s;
        found = true;
        const next: Subscription = { ...s, updatedAt: new Date().toISOString() };

        if ("name" in body) next.name = String(body.name).trim() || s.name;
        if ("amount" in body) {
          const a = Number(body.amount);
          if (Number.isFinite(a) && a > 0) next.amount = a;
        }
        if ("currency" in body) {
          const c = String(body.currency).trim().toUpperCase();
          if (isCurrencyCode(c)) next.currency = c;
        }
        if ("cycle" in body) {
          next.cycle = pickOption(body.cycle, BILLING_CYCLE_ORDER, s.cycle);
        }
        if ("cardId" in body) next.cardId = String(body.cardId ?? "").trim() || undefined;
        if ("nextCharge" in body) {
          const d = String(body.nextCharge ?? "").slice(0, 10);
          next.nextCharge = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : undefined;
        }
        if ("category" in body) next.category = String(body.category ?? "").trim() || undefined;
        if ("active" in body) next.active = Boolean(body.active);
        if ("notes" in body) next.notes = String(body.notes ?? "").trim() || undefined;
        return next;
      }),
    }));

    if (!found) {
      return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
    }
    return NextResponse.json({
      subscription: db.subscriptions.find((s) => s.id === id),
    });
  } catch (err) {
    console.error("[api/subscriptions PATCH]", err);
    return NextResponse.json(
      { error: "Could not update that subscription." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    let found = false;
    await updateDb((db) => {
      found = db.subscriptions.some((s) => s.id === id);
      return { ...db, subscriptions: db.subscriptions.filter((s) => s.id !== id) };
    });
    if (!found) {
      return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/subscriptions DELETE]", err);
    return NextResponse.json(
      { error: "Could not delete that subscription." },
      { status: 500 }
    );
  }
}
