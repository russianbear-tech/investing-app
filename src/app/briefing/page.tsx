"use client";

import { useEffect, useState } from "react";
import { Sunrise, RefreshCw, Loader2 } from "lucide-react";
import Link from "next/link";
import Markdown from "@/components/Markdown";
import StatusLine from "@/components/StatusLine";
import { useClaudeStream } from "@/lib/useClaudeStream";

const STORAGE_KEY = "briefing:last";

interface Cached {
  text: string;
  at: string;
}

export default function BriefingPage() {
  const stream = useClaudeStream();
  const [cached, setCached] = useState<Cached | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Keep the last briefing around so reopening the tab doesn't re-bill a
  // fresh generation.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setCached(JSON.parse(raw) as Cached);
    } catch {
      /* ignore malformed cache */
    }
    setHydrated(true);
  }, []);

  function generate() {
    stream.run("/api/briefing", {}, {
      onDone: (finalText) => {
        const entry: Cached = { text: finalText, at: new Date().toISOString() };
        setCached(entry);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
        } catch {
          /* storage full or blocked — the briefing still displays */
        }
      },
    });
  }

  const showing = stream.text || cached?.text || "";
  const isStale =
    cached && new Date(cached.at).toDateString() !== new Date().toDateString();

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-200">
              <Sunrise size={16} className="text-amber-400" />
              Morning briefing
            </h2>
            <p className="mt-1.5 max-w-lg text-xs leading-relaxed text-zinc-500">
              One read that covers what happened to everything you own overnight —
              what moved, why it moved, and anything in the wider market worth
              knowing. Claude searches the news before writing it.
            </p>
          </div>

          <button
            onClick={generate}
            disabled={stream.busy}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-amber-500 disabled:opacity-50"
          >
            {stream.busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : showing ? (
              <RefreshCw size={14} />
            ) : (
              <Sunrise size={14} />
            )}
            {stream.busy ? "Working…" : showing ? "Refresh" : "Get briefing"}
          </button>
        </div>

        {hydrated && cached && !stream.busy && (
          <p className="mt-3 border-t border-zinc-800 pt-3 text-[11px] text-zinc-600">
            {isStale ? "From " : "Generated "}
            {new Date(cached.at).toLocaleString("en-CA", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            {isStale && " — hit Refresh for today's."}
          </p>
        )}
      </section>

      {stream.error && (
        <div className="rounded-xl border border-rose-900/50 bg-rose-950/30 p-4 text-sm text-rose-300">
          {stream.error}
          {stream.error.toLowerCase().includes("api key") && (
            <Link
              href="/settings"
              className="ml-2 underline underline-offset-2 hover:text-rose-200"
            >
              Open Settings
            </Link>
          )}
        </div>
      )}

      {stream.busy && !stream.text && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <StatusLine status={stream.status} />
        </div>
      )}

      {showing && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className={stream.busy ? "streaming-caret" : ""}>
            <Markdown>{showing}</Markdown>
          </div>
          {stream.busy && (
            <div className="mt-4 border-t border-zinc-800 pt-3">
              <StatusLine status={stream.status} />
            </div>
          )}
        </section>
      )}

      {hydrated && !showing && !stream.busy && !stream.error && (
        <div className="rounded-xl border border-dashed border-zinc-800 px-6 py-14 text-center">
          <Sunrise size={28} className="mx-auto text-zinc-700" />
          <p className="mt-3 text-sm font-medium text-zinc-300">
            Nothing generated yet
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-zinc-500">
            Press the button above and you&apos;ll get a short rundown of your
            portfolio — written so it actually makes sense, not in market jargon.
          </p>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-zinc-600">
        Educational only — not financial advice. Claude can be wrong; check anything
        that would change a decision.
      </p>
    </div>
  );
}
