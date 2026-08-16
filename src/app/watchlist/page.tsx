"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus,
  Search,
  Loader2,
  Trash2,
  Star,
  Sparkles,
  X,
  RefreshCw,
} from "lucide-react";
import Markdown from "@/components/Markdown";
import StatusLine from "@/components/StatusLine";
import { useClaudeStream } from "@/lib/useClaudeStream";
import { formatAge, formatMoney, formatPercent, toneClass } from "@/lib/format";
import FundCodeHint, { looksLikeFundCode } from "@/components/FundCodeHint";

interface WatchRow {
  id: string;
  symbol: string;
  name: string;
  addedAt: string;
  priceAtAdd: number;
  currencyAtAdd: string;
  currentPrice: number | null;
  currency: string;
  changeSinceAddPercent: number | null;
  dayChangePercent: number | null;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  daysHeld: number;
  notes?: string;
}

interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange?: string;
}

export default function WatchlistPage() {
  const [items, setItems] = useState<WatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [analyzing, setAnalyzing] = useState<WatchRow | null>(null);
  const stream = useClaudeStream();

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/watchlist", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load the watchlist.");
      setItems(data.items ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the watchlist.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results ?? []);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  async function add(symbol: string) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add that.");
      setQuery("");
      setResults([]);
      setAdding(false);
      load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(item: WatchRow) {
    if (!confirm(`Remove ${item.symbol} from your watchlist?`)) return;
    await fetch(`/api/watchlist/${item.id}`, { method: "DELETE" });
    if (analyzing?.id === item.id) setAnalyzing(null);
    load(true);
  }

  function analyze(item: WatchRow) {
    setAnalyzing(item);
    stream.reset();
    stream.run("/api/analyze", { symbol: item.symbol });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-zinc-200">Watchlist</h2>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-zinc-500">
              Stocks you&apos;re thinking about but don&apos;t own. Each one tracks how
              far it&apos;s moved since the day you added it.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => load(true)}
              className="rounded-lg border border-zinc-700 p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              aria-label="Refresh"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => setAdding((a) => !a)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
            >
              <Plus size={14} />
              Add
            </button>
          </div>
        </div>

        {adding && (
          <div className="fade-up mt-4">
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
              />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a company or ticker — e.g. Nvidia, SHOP.TO"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 py-2 pl-9 pr-9 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-600"
              />
              {(searching || submitting) && (
                <Loader2
                  size={15}
                  className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-zinc-600"
                />
              )}
            </div>

            {results.length > 0 && (
              <ul className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900">
                {results.map((r) => (
                  <li key={`${r.symbol}-${r.exchange ?? ""}`}>
                    <button
                      onClick={() => add(r.symbol)}
                      disabled={submitting}
                      className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-zinc-800 disabled:opacity-50"
                    >
                      <span className="min-w-0">
                        <span className="text-sm font-medium text-zinc-100">
                          {r.symbol}
                        </span>
                        <span className="ml-2 truncate text-xs text-zinc-500">
                          {r.name}
                        </span>
                      </span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-zinc-600">
                        {r.exchange ?? r.type}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!searching && results.length === 0 && looksLikeFundCode(query) && (
              <FundCodeHint query={query} />
            )}
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-lg border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
            {error}
          </p>
        )}
      </section>

      {loading ? (
        <div className="space-y-1.5">
          <div className="h-16 animate-pulse rounded-xl bg-zinc-900" />
          <div className="h-16 animate-pulse rounded-xl bg-zinc-900" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 px-6 py-14 text-center">
          <Star size={28} className="mx-auto text-zinc-700" />
          <p className="mt-3 text-sm font-medium text-zinc-300">Nothing on the list</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-zinc-500">
            Add a stock you&apos;re curious about. You&apos;ll see how it moves from the
            moment you add it, and you can ask for a plain-English breakdown any time.
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 transition-colors hover:border-zinc-700"
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-zinc-100">
                      {item.symbol}
                    </span>
                    <span className="truncate text-xs text-zinc-500">{item.name}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-600">
                    Added {formatAge(item.daysHeld)} at{" "}
                    <span className="tnum">
                      {formatMoney(item.priceAtAdd, item.currencyAtAdd)}
                    </span>
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="tnum text-sm font-medium text-zinc-100">
                    {item.currentPrice !== null
                      ? formatMoney(item.currentPrice, item.currency)
                      : "—"}
                  </p>
                  {item.changeSinceAddPercent !== null && (
                    <p
                      className={`tnum text-xs ${toneClass(item.changeSinceAddPercent)}`}
                    >
                      {formatPercent(item.changeSinceAddPercent)} since added
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => analyze(item)}
                    className="rounded-lg border border-zinc-700 p-2 text-zinc-400 transition-colors hover:border-emerald-800 hover:bg-emerald-950/40 hover:text-emerald-300"
                    aria-label={`Explain ${item.symbol}`}
                    title="Explain this stock"
                  >
                    <Sparkles size={14} />
                  </button>
                  <button
                    onClick={() => remove(item)}
                    className="rounded-lg border border-zinc-800 p-2 text-zinc-600 transition-colors hover:border-rose-900 hover:bg-rose-950/30 hover:text-rose-300"
                    aria-label={`Remove ${item.symbol}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {item.dayChangePercent !== null && (
                <div className="flex items-center gap-3 border-t border-zinc-800/70 px-4 py-2 text-[11px] text-zinc-500">
                  <span className={`tnum ${toneClass(item.dayChangePercent)}`}>
                    {formatPercent(item.dayChangePercent)} today
                  </span>
                  {item.fiftyTwoWeekLow && item.fiftyTwoWeekHigh && (
                    <span className="tnum truncate">
                      52wk {formatMoney(item.fiftyTwoWeekLow, item.currency)} –{" "}
                      {formatMoney(item.fiftyTwoWeekHigh, item.currency)}
                    </span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Analysis drawer */}
      {analyzing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-t-2xl border border-zinc-800 bg-zinc-950 sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-zinc-100">
                  {analyzing.symbol}
                </h3>
                <p className="truncate text-xs text-zinc-500">{analyzing.name}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => analyze(analyzing)}
                  disabled={stream.busy}
                  className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-300 disabled:opacity-40"
                  aria-label="Regenerate"
                >
                  <RefreshCw size={15} />
                </button>
                <button
                  onClick={() => {
                    stream.stop();
                    setAnalyzing(null);
                  }}
                  className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-300"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {stream.error ? (
                <p className="rounded-lg border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
                  {stream.error}
                </p>
              ) : (
                <>
                  {stream.text ? (
                    <div className={stream.busy ? "streaming-caret" : ""}>
                      <Markdown>{stream.text}</Markdown>
                    </div>
                  ) : (
                    <StatusLine status={stream.status} />
                  )}
                  {stream.text && stream.busy && (
                    <div className="mt-3">
                      <StatusLine status={stream.status} />
                    </div>
                  )}
                </>
              )}
            </div>

            <p className="border-t border-zinc-800 px-5 py-3 text-[11px] leading-relaxed text-zinc-600">
              Written by Claude using live web search. Educational only — not
              financial advice.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
