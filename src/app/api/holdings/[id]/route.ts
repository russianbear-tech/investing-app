import { NextRequest, NextResponse } from "next/server";
import { updateDb } from "@/lib/store";
import { ACCOUNT_ORDER, AccountType, Holding } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Fields editable directly on the holding. Lots have their own endpoints. */
const EDITABLE: (keyof Holding)[] = [
  "symbol",
  "name",
  "kind",
  "platform",
  "account",
  "purchaseCurrency",
  "manualPrice",
  "notes",
];

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    let found = false;

    const db = await updateDb((current) => ({
      ...current,
      holdings: current.holdings.map((h) => {
        if (h.id !== id) return h;
        found = true;
        const patch: Partial<Holding> = {};

        for (const key of EDITABLE) {
          if (!(key in body)) continue;
          const value = body[key];

          if (key === "manualPrice") {
            if (value === "" || value === null) patch.manualPrice = undefined;
            else if (Number.isFinite(Number(value))) patch.manualPrice = Number(value);
          } else if (key === "symbol") {
            patch.symbol = String(value).trim().toUpperCase();
          } else if (key === "account") {
            const v = String(value ?? "").trim().toLowerCase();
            patch.account = ACCOUNT_ORDER.includes(v as AccountType)
              ? (v as AccountType)
              : undefined;
          } else {
            (patch as Record<string, unknown>)[key] = value;
          }
        }

        // Editing the single-lot case from the form: keep the old shape working.
        let lots = h.lots;
        if (h.lots.length === 1) {
          const only = h.lots[0];
          const nextQty =
            body.quantity !== undefined && Number.isFinite(Number(body.quantity))
              ? Number(body.quantity)
              : only.quantity;
          const nextCost =
            body.costPerUnit !== undefined && Number.isFinite(Number(body.costPerUnit))
              ? Number(body.costPerUnit)
              : only.costPerUnit;
          const nextDate =
            typeof body.purchaseDate === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(body.purchaseDate.slice(0, 10))
              ? body.purchaseDate.slice(0, 10)
              : only.date;

          if (
            nextQty !== only.quantity ||
            nextCost !== only.costPerUnit ||
            nextDate !== only.date
          ) {
            lots = [{ ...only, quantity: nextQty, costPerUnit: nextCost, date: nextDate }];
          }
        }

        return { ...h, ...patch, lots };
      }),
    }));

    if (!found) return NextResponse.json({ error: "Holding not found." }, { status: 404 });
    return NextResponse.json({ holding: db.holdings.find((h) => h.id === id) });
  } catch (err) {
    console.error("[api/holdings PATCH]", err);
    return NextResponse.json({ error: "Could not update that holding." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    let found = false;
    await updateDb((db) => {
      found = db.holdings.some((h) => h.id === id);
      return { ...db, holdings: db.holdings.filter((h) => h.id !== id) };
    });
    if (!found) return NextResponse.json({ error: "Holding not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/holdings DELETE]", err);
    return NextResponse.json({ error: "Could not delete that holding." }, { status: 500 });
  }
}
