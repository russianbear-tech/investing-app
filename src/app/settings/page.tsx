"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, KeyRound, ExternalLink, ShieldCheck } from "lucide-react";
import { Currency } from "@/lib/types";

export default function SettingsPage() {
  const [masterCurrency, setMasterCurrency] = useState<Currency>("USD");
  const [apiKey, setApiKey] = useState("");
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [keyFromEnv, setKeyFromEnv] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/settings", { cache: "no-store" });
      const data = await res.json();
      setMasterCurrency(data.settings?.masterCurrency ?? "USD");
      setHasStoredKey(Boolean(data.settings?.hasStoredKey));
      setKeyFromEnv(Boolean(data.keyFromEnv));
      setLoading(false);
    })();
  }, []);

  async function save(patch: Record<string, unknown>, tag: string) {
    setSaving(tag);
    setSaved(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (res.ok) {
        setHasStoredKey(Boolean(data.settings?.hasStoredKey));
        setSaved(tag);
        setTimeout(() => setSaved(null), 2200);
      }
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return <div className="h-40 animate-pulse rounded-xl bg-zinc-900" />;
  }

  const card = "rounded-xl border border-zinc-800 bg-zinc-900/40 p-5";

  return (
    <div className="max-w-2xl space-y-4">
      <section className={card}>
        <h2 className="text-sm font-medium text-zinc-200">Master currency</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
          Every total, gain, and loss in the app is shown in this currency, no matter
          which currency you actually paid in. Costs are converted using the exchange
          rate from the day you bought, so switching this never distorts your returns.
        </p>
        <div className="mt-4 flex gap-2">
          {(["USD", "CAD"] as Currency[]).map((c) => (
            <button
              key={c}
              onClick={() => {
                setMasterCurrency(c);
                save({ masterCurrency: c }, "currency");
              }}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors ${
                masterCurrency === c
                  ? "bg-emerald-600 text-white"
                  : "border border-zinc-700 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              {masterCurrency === c && <Check size={14} />}
              {c}
            </button>
          ))}
          {saving === "currency" && (
            <Loader2 size={16} className="mt-2.5 animate-spin text-zinc-600" />
          )}
        </div>
      </section>

      <section className={card}>
        <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-200">
          <KeyRound size={15} className="text-zinc-500" />
          Anthropic API key
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
          Powers the research chat, the morning briefing, and watchlist explanations.
          Without it the rest of the app works normally — those three features just
          stay switched off.
        </p>

        {keyFromEnv ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2.5 text-sm text-emerald-300">
            <ShieldCheck size={15} />
            Using the key from your <code className="text-xs">.env.local</code> file.
          </div>
        ) : (
          <>
            <div className="mt-4 flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasStoredKey ? "•••••••• (saved)" : "sk-ant-..."}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-600"
              />
              <button
                onClick={() => {
                  save({ anthropicApiKey: apiKey }, "key");
                  setApiKey("");
                }}
                disabled={!apiKey.trim() || saving === "key"}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
              >
                {saving === "key" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : saved === "key" ? (
                  <Check size={14} />
                ) : null}
                Save
              </button>
            </div>

            {hasStoredKey && (
              <button
                onClick={() => save({ anthropicApiKey: "" }, "clear")}
                className="mt-2 text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-300"
              >
                Remove saved key
              </button>
            )}

            <p className="mt-3 rounded-lg bg-zinc-900/70 px-3 py-2 text-xs leading-relaxed text-zinc-500">
              Saving here writes the key into <code>portfolio.json</code>. Putting
              it in <code>.env.local</code> instead is tidier — both files sync
              via OneDrive, but that one keeps the key out of the data file you
              might copy or back up separately.
            </p>
          </>
        )}

        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300"
        >
          Get an API key <ExternalLink size={12} />
        </a>
      </section>

      <section className={card}>
        <h2 className="text-sm font-medium text-zinc-200">Where your data lives</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
          Everything is stored in a single file — <code>data/portfolio.json</code> —
          inside this project folder. Because the project sits in OneDrive, it syncs
          to your laptop automatically. Nothing is uploaded to any server except the
          price lookups and, if you enable it, your questions to Claude.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-zinc-600">
          One caution: don&apos;t run the app on two computers at the same time.
          OneDrive would see two versions of the file and create a conflict copy.
          Close it on one machine before opening it on the other.
        </p>
      </section>
    </div>
  );
}
