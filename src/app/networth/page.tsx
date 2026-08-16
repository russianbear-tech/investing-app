"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Landmark,
  CreditCard,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import BalanceForm, { BalanceRecord } from "@/components/BalanceForm";
import DebtDetailPanel from "@/components/DebtDetailPanel";
import {
  CASH_KIND_LABELS,
  CASH_KIND_ORDER,
  LIABILITY_KIND_LABELS,
  LIABILITY_KIND_ORDER,
  NetWorthSummary,
} from "@/lib/types";
import { formatMoney, toneClass } from "@/lib/format";

// Validated together against this app's #09090b surface, all pairs:
// worst CVD ΔE 13.2, worst normal-vision ΔE 19.3 — clear of both floors.
const C_INVEST = "#3987e5";
const C_CASH = "#c98500";
const C_DEBT = "#d55181";

const CASH_KINDS = CASH_KIND_ORDER.map((k) => ({
  value: k,
  label: CASH_KIND_LABELS[k],
}));
const DEBT_KINDS = LIABILITY_KIND_ORDER.map((k) => ({
  value: k,
  label: LIABILITY_KIND_LABELS[k],
}));

export default function NetWorthPage() {
  const [summary, setSummary] = useState<NetWorthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cashForm, setCashForm] = useState(false);
  const [cashEditing, setCashEditing] = useState<BalanceRecord | null>(null);
  const [debtForm, setDebtForm] = useState(false);
  const [debtEditing, setDebtEditing] = useState<BalanceRecord | null>(null);
  const [openDebt, setOpenDebt] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/networth", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load.");
      setSummary(data.summary);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(kind: "cash" | "liabilities", id: string, name: string) {
    if (!confirm(`Remove "${name}"?`)) return;
    await fetch(`/api/${kind}/${id}`, { method: "DELETE" });
    load(true);
  }

  if (loading) {
    return (
      <div className="space-y-3 pt-2">
        <div className="h-32 animate-pulse rounded-xl bg-zinc-900" />
        <div className="h-40 animate-pulse rounded-xl bg-zinc-900" />
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

  const cur = summary.currency;
  const { investments, cash, debts, assets, netWorth } = summary;
  // Bar segments are scaled against whichever is larger so debt is comparable
  // to assets rather than to the axis.
  const scale = Math.max(assets, debts) || 1;
  const nothingTracked =
    summary.cashAccounts.length === 0 && summary.liabilities.length === 0;

  const card = "rounded-xl border border-zinc-800 bg-zinc-900/40";

  return (
    <div className="space-y-4">
      <section className={`${card} p-5`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-zinc-500">Net worth</p>
            <p
              className={`mt-1 text-3xl font-semibold tracking-tight sm:text-4xl ${
                netWorth < 0 ? "text-rose-300" : "text-zinc-50"
              }`}
            >
              {formatMoney(netWorth, cur)}
            </p>
            <p className="mt-1.5 text-xs text-zinc-500">
              Everything you own, minus everything you owe
            </p>
          </div>
          <button
            onClick={() => load(true)}
            className="shrink-0 rounded-lg border border-zinc-700 p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Refresh"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Composition — assets stacked, debt drawn against the same scale. */}
        <div className="mt-5 space-y-2">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              style={{ width: `${(investments / scale) * 100}%`, background: C_INVEST }}
              title="Investments"
            />
            <div
              style={{
                width: `${(cash / scale) * 100}%`,
                background: C_CASH,
                marginLeft: investments > 0 && cash > 0 ? 2 : 0,
              }}
              title="Cash"
            />
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              style={{ width: `${(debts / scale) * 100}%`, background: C_DEBT }}
              title="Debt"
            />
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-zinc-800 pt-4 text-xs">
          <div>
            <dt className="flex items-center gap-1.5 text-zinc-500">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: C_INVEST }}
              />
              Investments
            </dt>
            <dd className="tnum mt-1 text-sm text-zinc-100">
              {formatMoney(investments, cur)}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-zinc-500">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: C_CASH }}
              />
              Cash
            </dt>
            <dd className="tnum mt-1 text-sm text-zinc-100">{formatMoney(cash, cur)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-zinc-500">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: C_DEBT }}
              />
              Debt
            </dt>
            <dd className="tnum mt-1 text-sm text-zinc-100">
              {debts > 0 ? `−${formatMoney(debts, cur)}` : formatMoney(0, cur)}
            </dd>
          </div>
        </dl>

        {debts > 0 && (
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
            Your debt is {summary.debtRatio.toFixed(0)}% of what you own. Investment
            performance stays on the{" "}
            <Link href="/" className="text-zinc-400 underline underline-offset-2">
              Portfolio
            </Link>{" "}
            tab — cash and debt are kept out of it so they can&apos;t distort your
            return.
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

      {nothingTracked && (
        <div className="rounded-xl border border-dashed border-zinc-800 px-6 py-10 text-center">
          <TrendingUp size={26} className="mx-auto text-zinc-700" />
          <p className="mt-3 text-sm font-medium text-zinc-300">
            Only investments so far
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-zinc-500">
            Add your bank balances and your student loan below, and this number
            becomes the real picture instead of just the investing half of it.
          </p>
        </div>
      )}

      {/* Cash */}
      <section className={card}>
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-200">
            <Landmark size={15} style={{ color: C_CASH }} />
            Cash &amp; savings
            {summary.cashAccounts.length > 0 && (
              <span className="tnum text-xs text-zinc-500">
                {formatMoney(cash, cur)}
              </span>
            )}
          </h2>
          <button
            onClick={() => {
              setCashEditing(null);
              setCashForm((f) => !f);
            }}
            className="flex items-center gap-1 rounded-lg border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <Plus size={11} /> Add
          </button>
        </div>

        {summary.cashAccounts.length > 0 && (
          <ul className="border-t border-zinc-800">
            {summary.cashAccounts.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 border-b border-zinc-800/60 px-4 py-2.5 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-100">{a.name}</p>
                  <p className="truncate text-[11px] text-zinc-500">
                    {CASH_KIND_LABELS[a.kind]}
                    {a.institution && ` · ${a.institution}`}
                    {a.currency !== cur && ` · ${a.currency}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tnum text-sm text-zinc-100">
                    {formatMoney(a.converted, cur)}
                  </p>
                  {a.currency !== cur && (
                    <p className="tnum text-[11px] text-zinc-600">
                      {formatMoney(a.balance, a.currency)}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => {
                      setCashEditing(a);
                      setCashForm(true);
                    }}
                    className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                    aria-label={`Edit ${a.name}`}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => remove("cash", a.id, a.name)}
                    className="rounded-md p-1.5 text-zinc-700 transition-colors hover:bg-rose-950/40 hover:text-rose-400"
                    aria-label={`Remove ${a.name}`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {cashForm && (
          <BalanceForm
            mode="cash"
            kinds={CASH_KINDS}
            editing={cashEditing}
            endpoint="/api/cash"
            showInstitution
            onDone={() => {
              setCashForm(false);
              setCashEditing(null);
              load(true);
            }}
            onCancel={() => {
              setCashForm(false);
              setCashEditing(null);
            }}
          />
        )}
      </section>

      {/* Debts */}
      <section className={card}>
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-200">
            <CreditCard size={15} style={{ color: C_DEBT }} />
            Debts
            {summary.liabilities.length > 0 && (
              <span className="tnum text-xs text-zinc-500">
                {formatMoney(debts, cur)}
              </span>
            )}
          </h2>
          <button
            onClick={() => {
              setDebtEditing(null);
              setDebtForm((f) => !f);
            }}
            className="flex items-center gap-1 rounded-lg border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <Plus size={11} /> Add
          </button>
        </div>

        {summary.liabilities.length > 0 && (
          <ul className="border-t border-zinc-800">
            {summary.liabilities.map((l) => {
              const open = openDebt === l.id;
              return (
                <li key={l.id} className="border-b border-zinc-800/60 last:border-b-0">
                  <div
                    onClick={() => setOpenDebt(open ? null : l.id)}
                    className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors ${
                      open ? "bg-zinc-800/40" : "hover:bg-zinc-800/25"
                    }`}
                  >
                    <ChevronRight
                      size={13}
                      className={`shrink-0 text-zinc-600 transition-transform ${
                        open ? "rotate-90" : ""
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-100">{l.name}</p>
                      <p className="truncate text-[11px] text-zinc-500">
                        {LIABILITY_KIND_LABELS[l.kind]}
                        {l.interestRate !== undefined
                          ? ` · ${l.interestRate}% interest`
                          : l.kind === "student_loan"
                            ? " · no interest set"
                            : ""}
                        {/* Below 1% rounds to a meaningless "0% paid off". */}
                        {l.paidOffPercent !== null &&
                          l.paidOffPercent >= 1 &&
                          ` · ${l.paidOffPercent.toFixed(0)}% paid off`}
                        {l.currency !== cur && ` · ${l.currency}`}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tnum text-sm text-zinc-100">
                        {formatMoney(l.converted, cur)}
                      </p>
                      {l.changeSinceStart !== null && l.changeSinceStart !== 0 && (
                        <p
                          className={`tnum text-[11px] ${toneClass(-l.changeSinceStart)}`}
                        >
                          {l.changeSinceStart < 0 ? "paid down " : "up "}
                          {formatMoney(Math.abs(l.changeSinceStart), l.currency)}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDebtEditing(l);
                          setDebtForm(true);
                        }}
                        className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                        aria-label={`Edit ${l.name}`}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          remove("liabilities", l.id, l.name);
                        }}
                        className="rounded-md p-1.5 text-zinc-700 transition-colors hover:bg-rose-950/40 hover:text-rose-400"
                        aria-label={`Remove ${l.name}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {open && (
                    <DebtDetailPanel
                      debt={l}
                      master={cur}
                      onChanged={() => load(true)}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {debtForm && (
          <BalanceForm
            mode="debt"
            kinds={DEBT_KINDS}
            editing={debtEditing}
            endpoint="/api/liabilities"
            onDone={() => {
              setDebtForm(false);
              setDebtEditing(null);
              load(true);
            }}
            onCancel={() => {
              setDebtForm(false);
              setDebtEditing(null);
            }}
          />
        )}
      </section>

      <p className="text-[11px] leading-relaxed text-zinc-600">
        Balances here are whatever you last typed in — the app can&apos;t see your
        bank. Update them when you check, and the history keeps track of how far
        you&apos;ve paid a debt down.
      </p>
    </div>
  );
}
