import { NextRequest, NextResponse } from "next/server";
import { readDb, updateDb, newId } from "@/lib/store";
import { computeSubscriptions } from "@/lib/cashflow";
import { pickOption } from "@/lib/entryInput";
import { BILLING_CYCLE_ORDER, isCurrencyCode, Subscription } from "@/lib/types";

export const dynamic = "force-dynamic";

export function parseSubscriptionBody(body: Record<string, unknown>): {
  data?: Omit<Subscription, "id" | "createdAt" | "updatedAt">;
  error?: string;
} {
  const name = String(body.name ?? "").trim();
  if (!name) return { error: "Give the subscription a name." };

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter what it costs, as a number greater than zero." };
  }

  const currency = String(body.currency ?? "").trim().toUpperCase();
  if (!isCurrencyCode(currency)) {
    return { error: "Currency must be a three-letter code, like CAD, USD or RUB." };
  }

  const nextCharge = String(body.nextCharge ?? "").slice(0, 10);
  if (nextCharge && !/^\d{4}-\d{2}-\d{2}$/.test(nextCharge)) {
    return { error: "Enter the next charge date as YYYY-MM-DD." };
  }

  return {
    data: {
      name,
      amount,
      currency,
      cycle: pickOption(body.cycle, BILLING_CYCLE_ORDER, "monthly"),
      cardId: String(body.cardId ?? "").trim() || undefined,
      nextCharge: nextCharge || undefined,
      category: String(body.category ?? "").trim() || undefined,
      active: body.active === undefined ? true : Boolean(body.active),
      notes: String(body.notes ?? "").trim() || undefined,
    },
  };
}

export async function GET() {
  try {
    const db = await readDb();
    const summary = await computeSubscriptions(db);
    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[api/subscriptions GET]", err);
    return NextResponse.json(
      { error: "Could not load your subscriptions." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const { data, error } = parseSubscriptionBody(body);
    if (error || !data) return NextResponse.json({ error }, { status: 400 });

    const now = new Date().toISOString();
    const subscription: Subscription = { ...data, id: newId(), createdAt: now, updatedAt: now };

    await updateDb((db) => ({
      ...db,
      subscriptions: [...db.subscriptions, subscription],
    }));
    return NextResponse.json({ subscription }, { status: 201 });
  } catch (err) {
    console.error("[api/subscriptions POST]", err);
    return NextResponse.json(
      { error: "Could not save that subscription." },
      { status: 500 }
    );
  }
}
