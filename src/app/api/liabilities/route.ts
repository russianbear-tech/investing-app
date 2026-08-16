import { NextRequest, NextResponse } from "next/server";
import { readDb, updateDb, newId } from "@/lib/store";
import { optionalNumber, parseDate } from "@/lib/entryInput";
import {
  Currency,
  Liability,
  LIABILITY_KIND_ORDER,
  LiabilityKind,
} from "@/lib/types";

export const dynamic = "force-dynamic";

function parseBody(body: Record<string, unknown>): {
  data?: Omit<Liability, "id" | "createdAt" | "updatedAt" | "history" | "payments">;
  error?: string;
} {
  const name = String(body.name ?? "").trim();
  if (!name) return { error: "Give the debt a name." };

  const balance = Number(body.balance);
  if (!Number.isFinite(balance)) return { error: "Enter the balance as a number." };
  if (balance < 0) return { error: "Enter what you owe as a positive number." };

  const currency = String(body.currency ?? "CAD").toUpperCase();
  if (currency !== "USD" && currency !== "CAD") {
    return { error: "Currency must be USD or CAD." };
  }

  const rawKind = String(body.kind ?? "student_loan").toLowerCase();
  const kind = (LIABILITY_KIND_ORDER.includes(rawKind as LiabilityKind)
    ? rawKind
    : "other") as LiabilityKind;

  const rawRate = body.interestRate;
  const interestRate =
    rawRate === undefined || rawRate === null || rawRate === ""
      ? undefined
      : Number(rawRate);
  if (
    interestRate !== undefined &&
    (!Number.isFinite(interestRate) || interestRate < 0 || interestRate > 100)
  ) {
    return { error: "Interest rate should be a percentage between 0 and 100." };
  }

  const rawDueDay = Math.trunc(Number(body.dueDay));
  const dueDay =
    Number.isFinite(rawDueDay) && rawDueDay >= 1 && rawDueDay <= 31
      ? rawDueDay
      : undefined;

  return {
    data: {
      name,
      kind,
      currency: currency as Currency,
      balance,
      interestRate,
      notes: String(body.notes ?? "").trim() || undefined,
      // Only meaningful for credit cards, harmless on anything else.
      dueDay,
      statementBalance: optionalNumber(body.statementBalance),
      minimumDue: optionalNumber(body.minimumDue),
      creditLimit: optionalNumber(body.creditLimit),
      autopay: Boolean(body.autopay) || undefined,
      // Repayment tracking.
      originalAmount: optionalNumber(body.originalAmount),
      startDate: parseDate(body.startDate),
      regularPayment: optionalNumber(body.regularPayment),
    },
  };
}

export async function GET() {
  const db = await readDb();
  return NextResponse.json({ liabilities: db.liabilities });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const { data, error } = parseBody(body);
    if (error || !data) return NextResponse.json({ error }, { status: 400 });

    const now = new Date().toISOString();
    const liability: Liability = {
      ...data,
      id: newId(),
      history: [{ date: now.slice(0, 10), balance: data.balance }],
      payments: [],
      createdAt: now,
      updatedAt: now,
    };

    await updateDb((db) => ({ ...db, liabilities: [...db.liabilities, liability] }));
    return NextResponse.json({ liability }, { status: 201 });
  } catch (err) {
    console.error("[api/liabilities POST]", err);
    return NextResponse.json({ error: "Could not save that debt." }, { status: 500 });
  }
}
