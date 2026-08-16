import { NextRequest, NextResponse } from "next/server";
import { readDb, updateDb, newId } from "@/lib/store";
import {
  ACCOUNT_ORDER,
  AccountType,
  AssetKind,
  Currency,
  Holding,
  Lot,
} from "@/lib/types";
import { priceOnDate } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const KINDS: AssetKind[] = ["stock", "etf", "gold", "crypto", "cash"];

export function parseAccount(value: unknown): AccountType | undefined {
  const v = String(value ?? "").trim().toLowerCase();
  return ACCOUNT_ORDER.includes(v as AccountType) ? (v as AccountType) : undefined;
}

async function parseHolding(body: Record<string, unknown>): Promise<{
  holding?: Omit<Holding, "id" | "createdAt">;
  error?: string;
}> {
  const kind = String(body.kind ?? "stock") as AssetKind;
  if (!KINDS.includes(kind)) return { error: `Unknown asset type "${kind}".` };

  const purchaseCurrency = String(body.purchaseCurrency ?? "USD").toUpperCase();
  if (purchaseCurrency !== "USD" && purchaseCurrency !== "CAD") {
    return { error: "Purchase currency must be USD or CAD." };
  }

  const symbol = String(body.symbol ?? "").trim().toUpperCase();
  const name = String(body.name ?? "").trim() || symbol;
  if (!name) return { error: "Give the holding a name or a ticker symbol." };
  if (kind !== "cash" && !symbol) {
    return { error: "A ticker symbol is required for anything except cash and GICs." };
  }

  const purchaseDate = String(body.purchaseDate ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) {
    return { error: "Purchase date must be a real date." };
  }

  // The first purchase can be entered the same way as later contributions:
  // a dollar amount, with the unit count derived from that day's price.
  const amountRaw = body.amount;
  const amount =
    amountRaw === undefined || amountRaw === null || amountRaw === ""
      ? undefined
      : Number(amountRaw);

  let quantity = Number(body.quantity);
  let costPerUnit = Number(body.costPerUnit);
  let autoPriced = false;

  const haveExplicit =
    Number.isFinite(quantity) && quantity > 0 && Number.isFinite(costPerUnit);

  if (!haveExplicit && amount !== undefined && Number.isFinite(amount) && amount > 0) {
    if (kind === "cash" || !symbol) {
      quantity = amount;
      costPerUnit = 1;
    } else {
      const priced = await priceOnDate(symbol, purchaseDate, purchaseCurrency);
      if (!priced) {
        return {
          error: `Couldn't find a price for ${symbol} on ${purchaseDate}. Markets may have been closed that day — try another date, or enter the units yourself.`,
        };
      }
      costPerUnit = priced.price;
      quantity = amount / priced.price;
      autoPriced = true;
    }
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: "Enter either an amount, or how many units you bought." };
  }
  if (!Number.isFinite(costPerUnit) || costPerUnit < 0) {
    return { error: "Cost per unit must be zero or more." };
  }

  const rawManual = body.manualPrice;
  const manualPrice =
    rawManual === undefined || rawManual === null || rawManual === ""
      ? undefined
      : Number(rawManual);
  if (manualPrice !== undefined && (!Number.isFinite(manualPrice) || manualPrice < 0)) {
    return { error: "Current value must be zero or more." };
  }

  const firstLot: Lot = {
    id: newId(),
    date: purchaseDate,
    quantity,
    costPerUnit,
    amount,
    autoPriced,
    createdAt: new Date().toISOString(),
  };

  return {
    holding: {
      symbol,
      name,
      kind,
      platform: String(body.platform ?? "").trim(),
      account: parseAccount(body.account),
      purchaseCurrency: purchaseCurrency as Currency,
      lots: [firstLot],
      manualPrice,
      notes: String(body.notes ?? "").trim() || undefined,
    },
  };
}

export async function GET() {
  const db = await readDb();
  return NextResponse.json({ holdings: db.holdings });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const { holding, error } = await parseHolding(body);
    if (error || !holding) return NextResponse.json({ error }, { status: 400 });

    const record: Holding = {
      ...holding,
      id: newId(),
      createdAt: new Date().toISOString(),
    };

    await updateDb((db) => ({ ...db, holdings: [...db.holdings, record] }));
    return NextResponse.json({ holding: record }, { status: 201 });
  } catch (err) {
    console.error("[api/holdings POST]", err);
    return NextResponse.json({ error: "Could not save that holding." }, { status: 500 });
  }
}
