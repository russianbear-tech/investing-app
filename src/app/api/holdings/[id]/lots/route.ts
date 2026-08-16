import { NextRequest, NextResponse } from "next/server";
import { readDb, updateDb, newId } from "@/lib/store";
import { priceOnDate } from "@/lib/pricing";
import { Lot } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Adds a purchase to an existing holding.
 *
 * Two ways to call it:
 *   { date, amount }                  — "I put in $500 on March 1"; the unit
 *                                       count is worked out from that day's price
 *   { date, quantity, costPerUnit }   — exact figures from a statement
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const db = await readDb();
    const holding = db.holdings.find((h) => h.id === id);
    if (!holding) {
      return NextResponse.json({ error: "Holding not found." }, { status: 404 });
    }

    const date = String(body.date ?? "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Pick a real date." }, { status: 400 });
    }
    if (date > new Date().toISOString().slice(0, 10)) {
      return NextResponse.json(
        { error: "That date is in the future." },
        { status: 400 }
      );
    }

    let quantity: number;
    let costPerUnit: number;
    let autoPriced = false;
    const amount =
      body.amount !== undefined && body.amount !== null && body.amount !== ""
        ? Number(body.amount)
        : undefined;

    const explicitQty = Number(body.quantity);
    const explicitCost = Number(body.costPerUnit);

    if (Number.isFinite(explicitQty) && explicitQty > 0 && Number.isFinite(explicitCost)) {
      quantity = explicitQty;
      costPerUnit = explicitCost;
    } else if (amount !== undefined && Number.isFinite(amount) && amount > 0) {
      if (holding.kind === "cash" || !holding.symbol) {
        // A deposit into cash is just the amount, at a unit price of 1.
        quantity = amount;
        costPerUnit = 1;
      } else {
        const priced = await priceOnDate(
          holding.symbol,
          date,
          holding.purchaseCurrency
        );
        if (!priced) {
          return NextResponse.json(
            {
              error: `Couldn't find a price for ${holding.symbol} on ${date}. Markets may have been closed, or the data isn't available that far back — enter the units manually instead.`,
            },
            { status: 404 }
          );
        }
        costPerUnit = priced.price;
        quantity = amount / priced.price;
        autoPriced = true;
      }
    } else {
      return NextResponse.json(
        { error: "Enter either an amount, or a number of units and a price." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "That works out to zero units." }, { status: 400 });
    }

    const lot: Lot = {
      id: newId(),
      date,
      quantity,
      costPerUnit,
      amount,
      autoPriced,
      createdAt: new Date().toISOString(),
    };

    const updated = await updateDb((current) => ({
      ...current,
      holdings: current.holdings.map((h) =>
        h.id === id
          ? { ...h, lots: [...h.lots, lot].sort((a, b) => a.date.localeCompare(b.date)) }
          : h
      ),
    }));

    return NextResponse.json(
      { lot, holding: updated.holdings.find((h) => h.id === id) },
      { status: 201 }
    );
  } catch (err) {
    console.error("[api/holdings/lots POST]", err);
    return NextResponse.json(
      { error: "Could not add that contribution." },
      { status: 500 }
    );
  }
}
