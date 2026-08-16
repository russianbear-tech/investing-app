import { NextRequest, NextResponse } from "next/server";
import { updateDb } from "@/lib/store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    let found = false;
    await updateDb((db) => {
      found = db.watchlist.some((w) => w.id === id);
      return { ...db, watchlist: db.watchlist.filter((w) => w.id !== id) };
    });
    if (!found) return NextResponse.json({ error: "Not on the watchlist." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/watchlist DELETE]", err);
    return NextResponse.json({ error: "Could not remove that item." }, { status: 500 });
  }
}
