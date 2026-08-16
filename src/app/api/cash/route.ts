import { NextRequest, NextResponse } from "next/server";
import { readDb, updateDb, newId } from "@/lib/store";
import { CASH_KIND_ORDER, CashAccount, CashKind, Currency } from "@/lib/types";

export const dynamic = "force-dynamic";

export function parseCashBody(body: Record<string, unknown>): {
  data?: Omit<CashAccount, "id" | "createdAt" | "updatedAt" | "history">;
  error?: string;
} {
  const name = String(body.name ?? "").trim();
  if (!name) return { error: "Give the account a name." };

  const balance = Number(body.balance);
  if (!Number.isFinite(balance)) return { error: "Enter the balance as a number." };
  if (balance < 0) {
    return { error: "A cash balance can't be negative — add it as a debt instead." };
  }

  const currency = String(body.currency ?? "CAD").toUpperCase();
  if (currency !== "USD" && currency !== "CAD") {
    return { error: "Currency must be USD or CAD." };
  }

  const rawKind = String(body.kind ?? "savings").toLowerCase();
  const kind = (CASH_KIND_ORDER.includes(rawKind as CashKind)
    ? rawKind
    : "savings") as CashKind;

  return {
    data: {
      name,
      institution: String(body.institution ?? "").trim() || undefined,
      kind,
      currency: currency as Currency,
      balance,
      notes: String(body.notes ?? "").trim() || undefined,
    },
  };
}

export async function GET() {
  const db = await readDb();
  return NextResponse.json({ cashAccounts: db.cashAccounts });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const { data, error } = parseCashBody(body);
    if (error || !data) return NextResponse.json({ error }, { status: 400 });

    const now = new Date().toISOString();
    const account: CashAccount = {
      ...data,
      id: newId(),
      history: [{ date: now.slice(0, 10), balance: data.balance }],
      createdAt: now,
      updatedAt: now,
    };

    await updateDb((db) => ({ ...db, cashAccounts: [...db.cashAccounts, account] }));
    return NextResponse.json({ account }, { status: 201 });
  } catch (err) {
    console.error("[api/cash POST]", err);
    return NextResponse.json({ error: "Could not save that account." }, { status: 500 });
  }
}
