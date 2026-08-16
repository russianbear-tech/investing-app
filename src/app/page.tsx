"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  AlertTriangle,
  TrendingUp,
  Info,
} from "lucide-react";
import AddHoldingModal from "@/components/AddHoldingModal";
import ContributionsPanel from "@/components/ContributionsPanel";
import GrowthChart from "@/components/GrowthChart";
import {
  ACCOUNT_LABELS,
  Currency,
  Holding,
  PortfolioSummary,
  ValuedHolding,
} from "@/lib/types";
import {
  formatMoney,
  formatPercent,
  formatQuantity,
  formatSignedMoney,
  toneClass,
} from "@/lib/format";

export default function PortfolioPage() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Holding | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<
    "platform" | "account" | "type" | "currency"
  >("platform");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/portfolio", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load your portfolio.");
      setSummary(data.summary);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your portfolio.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function switchCurrency(next: Currency) {
    if (!summary || summary.masterCurrency === next) return;
    // Optimistically flip the label; the reload brings converted numbers.
    setSummary({ ...summary, masterCurrency: next });
    setRefreshing(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ masterCurrency: next }),
    });
    await load(true);
  }

  async function remove(h: ValuedHolding) {
    if (!confirm(`Remove ${h.symbol || h.name} from your portfolio?`)) return;
    await fetch(`/api/holdings/${h.id}`, { method: "DELETE" });
    load(true);
  }

  if (loading) {
    return (
      <div className="space-y-3 pt-6">
        <div className="h-28 animate-pulse rounded-xl bg-zinc-900" />
        <div className="h-14 animate-pulse rounded-xl bg-zinc-900" />
        <div className="h-14 animate-pulse rounded-xl bg-zinc-900" />
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="rounded-xl border border-rose-900/50 bg-rose-950/30 p-5 text-sm text-rose-300">
        {error}
      </div>
    );
  }

  if (!summary) return null;

  const cur = summary.masterCurrency;
  const empty = summary.holdings.length === 0;

  const groups: { label: string; value: number; percent: number }[] =
    breakdown === "platform"
      ? summary.byPlatform.map((g) => ({ ...g, label: g.platform }))
      : breakdown === "account"
        ? summary.byAccount.map((g) => ({ ...g, label: g.label }))
        : breakdown === "type"
          ? summary.byKind.map((g) => ({ ...g, label: g.label }))
          : summary.byCurrency.map((g) => ({ ...g, label: g.currency }));

  return (
    <div className="space-y-5">
      {/* Headline numbers */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-zinc-500">Total value</p>
            <p className="tnum mt-1 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              {formatMoney(summary.totalValue, cur)}
            </p>
            {!empty && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className={`tnum ${toneClass(summary.totalGain)}`}>
                  {formatSignedMoney(summary.totalGain, cur)} (
                  {formatPercent(summary.totalGainPercent)}) all time
                </span>
                <span className={`tnum ${toneClass(summary.dayChange)}`}>
                  {formatSignedMoney(summary.dayChange, cur)} (
                  {formatPercent(summary.dayChangePercent)}) today
                </span>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="flex rounded-lg border border-zinc-700 p-0.5">
              {(["USD", "CAD"] as Currency[]).map((c) => (
                <button
                  key={c}
                  onClick={() => switchCurrency(c)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    cur === c
                      ? "bg-zinc-700 text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <button
              onClick={() => load(true)}
              className="rounded-lg border border-zinc-700 p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              aria-label="Refresh prices"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {!empty && (
          <p className="mt-3 border-t border-zinc-800 pt-3 text-xs text-zinc-600">
            Invested {formatMoney(summary.totalCost, cur)} · everything converted to{" "}
            {cur} at live rates
          </p>
        )}
      </section>

      {summary.errors.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-amber-900/40 bg-amber-950/20 p-4">
          {summary.errors.map((e, i) => (
            <p key={i} className="flex gap-2 text-xs leading-relaxed text-amber-200/80">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {e}
            </p>
          ))}
        </div>
      )}

      {!empty && <GrowthChart />}

      {/* Allocation */}
      {!empty && groups.length > 1 && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="mb-3 flex items-center gap-1.5">
            {(
              [
                ["platform", "By platform"],
                ["account", "By account"],
                ["type", "By type"],
                ["currency", "By currency"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setBreakdown(key)}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  breakdown === key
                    ? "bg-zinc-800 text-zinc-200"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex h-2 overflow-hidden rounded-full bg-zinc-800">
            {groups.map((g, i) => (
              <div
                key={g.label + i}
                style={{ width: `${Math.max(g.percent, 0.5)}%` }}
                className={
                  ["bg-emerald-500", "bg-sky-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-teal-500"][i % 6]
                }
                title={`${g.label}: ${g.percent.toFixed(1)}%`}
              />
            ))}
          </div>

          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
            {groups.map((g, i) => (
              <li key={g.label + i} className="flex items-center gap-2 text-xs">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    ["bg-emerald-500", "bg-sky-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-teal-500"][i % 6]
                  }`}
                />
                <span className="truncate text-zinc-400">{g.label}</span>
                <span className="tnum ml-auto shrink-0 text-zinc-500">
                  {g.percent.toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>

          {breakdown === "account" && (
            <div className="mt-3 border-t border-zinc-800 pt-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-600">
                    <th className="pb-1 text-left font-normal">Account</th>
                    <th className="pb-1 text-right font-normal">Put in</th>
                    <th className="pb-1 text-right font-normal">Worth now</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byAccount.map((a) => (
                    <tr key={a.account}>
                      <td className="py-0.5 text-zinc-400">
                        {a.label}
                        {a.limited && (
                          <span
                            className="ml-1.5 text-[10px] text-zinc-600"
                            title="This account type has a yearly contribution limit"
                          >
                            limited
                          </span>
                        )}
                      </td>
                      <td className="tnum py-0.5 text-right text-zinc-400">
                        {formatMoney(a.contributed, cur)}
                      </td>
                      <td className="tnum py-0.5 text-right text-zinc-200">
                        {formatMoney(a.value, cur)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
                &ldquo;Put in&rdquo; is what these holdings cost you, shown in {cur}.
                It tracks contributions but isn&apos;t your official CRA limit —
                withdrawals and older years aren&apos;t counted here.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Holdings */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-300">
            Holdings{" "}
            {!empty && <span className="text-zinc-600">({summary.holdings.length})</span>}
          </h2>
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500"
          >
            <Plus size={14} />
            Add holding
          </button>
        </div>

        {empty ? (
          <div className="rounded-xl border border-dashed border-zinc-800 px-6 py-14 text-center">
            <TrendingUp size={28} className="mx-auto text-zinc-700" />
            <p className="mt-3 text-sm font-medium text-zinc-300">
              Nothing here yet
            </p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-zinc-500">
              Add what you own on each platform — stocks, ETFs, gold, cash. Enter the
              price in whatever currency you paid in, and everything gets converted to{" "}
              {cur} automatically.
            </p>
            <button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="mt-5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
            >
              Add your first holding
            </button>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {summary.holdings.map((h) => {
              const isOpen = expanded === h.id;
              const fxMatters = h.purchaseCurrency !== h.nativeCurrency;
              return (
                <li
                  key={h.id}
                  className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 transition-colors hover:border-zinc-700"
                >
                  <button
                    onClick={() => setExpanded(isOpen ? null : h.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate text-sm font-medium text-zinc-100">
                          {h.symbol || h.name}
                        </span>
                        {h.account && (
                          <span className="shrink-0 rounded bg-sky-950/70 px-1.5 py-0.5 text-[10px] text-sky-300">
                            {ACCOUNT_LABELS[h.account]}
                          </span>
                        )}
                        {h.platform && (
                          <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                            {h.platform}
                          </span>
                        )}
                        {h.lots.length > 1 && (
                          <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                            {h.lots.length} buys
                          </span>
                        )}
                        {h.priceUnavailable && (
                          <span className="shrink-0 rounded bg-amber-950/60 px-1.5 py-0.5 text-[10px] text-amber-300">
                            no price
                          </span>
                        )}
                      </div>
                      <p className="tnum mt-0.5 truncate text-xs text-zinc-500">
                        {formatQuantity(h.quantity)} ×{" "}
                        {formatMoney(h.nativePrice, h.nativeCurrency)}
                        {h.nativeCurrency !== cur && (
                          <span className="text-zinc-600"> · {h.nativeCurrency}</span>
                        )}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="tnum text-sm font-medium text-zinc-100">
                        {formatMoney(h.marketValue, cur)}
                      </p>
                      <p className={`tnum text-xs ${toneClass(h.gain)}`}>
                        {formatPercent(h.gainPercent)}
                        {h.quote && (
                          <span className={`ml-2 ${toneClass(h.quote.changePercent)}`}>
                            {formatPercent(h.quote.changePercent)} today
                          </span>
                        )}
                      </p>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="fade-up border-t border-zinc-800 bg-zinc-950/40 px-4 py-3">
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs sm:grid-cols-4">
                        <div>
                          <dt className="text-zinc-500">Name</dt>
                          <dd className="mt-0.5 truncate text-zinc-300">{h.name}</dd>
                        </div>
                        <div>
                          <dt className="text-zinc-500">Cost basis</dt>
                          <dd className="tnum mt-0.5 text-zinc-300">
                            {formatMoney(h.costBasis, cur)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-zinc-500">Gain / loss</dt>
                          <dd className={`tnum mt-0.5 ${toneClass(h.gain)}`}>
                            {formatSignedMoney(h.gain, cur)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-zinc-500">
                            {h.lots.length > 1 ? "First bought" : "Bought"}
                          </dt>
                          <dd className="mt-0.5 text-zinc-300">
                            {h.firstPurchaseDate}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-zinc-500">
                            {h.lots.length > 1 ? "Average paid" : "Paid"}
                          </dt>
                          <dd className="tnum mt-0.5 text-zinc-300">
                            {formatMoney(h.averageCostPerUnit, h.purchaseCurrency)} /
                            unit
                          </dd>
                        </div>
                        {h.quote?.fiftyTwoWeekLow && h.quote.fiftyTwoWeekHigh && (
                          <div className="col-span-2">
                            <dt className="text-zinc-500">52-week range</dt>
                            <dd className="tnum mt-0.5 text-zinc-300">
                              {formatMoney(h.quote.fiftyTwoWeekLow, h.nativeCurrency)} –{" "}
                              {formatMoney(h.quote.fiftyTwoWeekHigh, h.nativeCurrency)}
                            </dd>
                          </div>
                        )}
                        {h.notes && (
                          <div className="col-span-2 sm:col-span-4">
                            <dt className="text-zinc-500">Notes</dt>
                            <dd className="mt-0.5 text-zinc-300">{h.notes}</dd>
                          </div>
                        )}
                      </dl>

                      {fxMatters && (
                        <p className="mt-3 flex gap-2 rounded-lg bg-zinc-900/70 px-3 py-2 text-xs leading-relaxed text-zinc-400">
                          <Info size={13} className="mt-0.5 shrink-0 text-zinc-500" />
                          <span>
                            You paid in {h.purchaseCurrency} but this trades in{" "}
                            {h.nativeCurrency}. The price itself moved{" "}
                            <span className={toneClass(h.nativeGainPercent)}>
                              {formatPercent(h.nativeGainPercent)}
                            </span>
                            ; your actual return in {cur} is{" "}
                            <span className={toneClass(h.gainPercent)}>
                              {formatPercent(h.gainPercent)}
                            </span>
                            . The difference is the exchange rate.
                          </span>
                        </p>
                      )}

                      {h.costBasisApproximate && (
                        <p className="mt-2 text-xs text-amber-300/70">
                          At least one purchase date had no exchange rate available,
                          so today&apos;s rate was used and this gain is approximate.
                        </p>
                      )}

                      <ContributionsPanel
                        holding={h}
                        masterCurrency={cur}
                        onChanged={() => load(true)}
                      />

                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => {
                            setEditing(h);
                            setModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          onClick={() => remove(h)}
                          className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-500 transition-colors hover:border-rose-900 hover:bg-rose-950/30 hover:text-rose-300"
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AddHoldingModal
        open={modalOpen}
        editing={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSaved={() => load(true)}
      />
    </div>
  );
}
