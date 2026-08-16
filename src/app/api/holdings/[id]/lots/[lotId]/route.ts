import { NextRequest, NextResponse } from "next/server";
import { readDb, updateDb } from "@/lib/store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; lotId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, lotId } = await params;
  try {
    const db = await readDb();
    const holding = db.holdings.find((h) => h.id === id);
    if (!holding) {
      return NextResponse.json({ error: "Holding not found." }, { status: 404 });
    }
    if (!holding.lots.some((l) => l.id === lotId)) {
      return NextResponse.json({ error: "Contribution not found." }, { status: 404 });
    }
    if (holding.lots.length === 1) {
      return NextResponse.json(
        {
          error:
            "That's the only purchase on this holding. Remove the whole holding instead.",
        },
        { status: 409 }
      );
    }

    const updated = await updateDb((current) => ({
      ...current,
      holdings: current.holdings.map((h) =>
        h.id === id ? { ...h, lots: h.lots.filter((l) => l.id !== lotId) } : h
      ),
    }));

    return NextResponse.json({ holding: updated.holdings.find((h) => h.id === id) });
  } catch (err) {
    console.error("[api/holdings/lots DELETE]", err);
    return NextResponse.json(
      { error: "Could not remove that contribution." },
      { status: 500 }
    );
  }
}
