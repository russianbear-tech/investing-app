import { NextRequest, NextResponse } from "next/server";
import { readDb, updateDb } from "@/lib/store";
import { Currency, SUPPORTED_CURRENCIES } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await readDb();
  return NextResponse.json({
    settings: {
      ...db.settings,
      // Never send the stored key back to the browser — just whether one exists.
      anthropicApiKey: undefined,
      hasStoredKey: Boolean(db.settings.anthropicApiKey),
    },
    keyFromEnv: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
  });
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};

    if ("masterCurrency" in body) {
      const cur = String(body.masterCurrency).toUpperCase() as Currency;
      if (!SUPPORTED_CURRENCIES.includes(cur)) {
        return NextResponse.json(
          { error: "Master currency must be USD or CAD." },
          { status: 400 }
        );
      }
      patch.masterCurrency = cur;
    }

    if ("anthropicApiKey" in body) {
      const key = String(body.anthropicApiKey ?? "").trim();
      // Empty string clears the stored key.
      patch.anthropicApiKey = key || undefined;
    }

    if ("displayName" in body) {
      patch.displayName = String(body.displayName ?? "").trim() || undefined;
    }

    const db = await updateDb((current) => ({
      ...current,
      settings: { ...current.settings, ...patch },
    }));

    return NextResponse.json({
      settings: {
        ...db.settings,
        anthropicApiKey: undefined,
        hasStoredKey: Boolean(db.settings.anthropicApiKey),
      },
    });
  } catch (err) {
    console.error("[api/settings PUT]", err);
    return NextResponse.json({ error: "Could not save settings." }, { status: 500 });
  }
}
