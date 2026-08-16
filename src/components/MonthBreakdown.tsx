"use client";

import { X, Lock, AlertTriangle } from "lucide-react";
import {
  Currency,
  EXPENSE_CATEGORY_LABELS,
  ExpenseEntry,
  INCOME_CATEGORY_LABELS,
  IncomeEntry,
  MonthSummary,
} from "@/lib/types";
import { convertLocked, formatDayMonth, formatMoney, toneClass } from "@/lib/format";

const C_INCOME = "#34b27b";
const C_EXPENSE = "#d55181";

interface Props {
  month: MonthSummary;
  /** All entries; this component picks out the ones in `month`. */
  income: IncomeEntry[];
  expenses: ExpenseEntry[];
  currency: Currency;
  onClose: () => void;
}

interface Group {
  key: string;
  label: string;
  sub?: string;
  total: number;
  count: number;
  percent: number;
}

/** Sums `rows` into named groups, largest first, each with its share of the total. */
function group(
  rows: { key: string; label: string; sub?: string; value: number }[]
): Group[] {
  const map = new Map<string, { label: string; sub?: string; total: number; count: number }>();
  for (const r of rows) {
    const cur = map.get(r.key) ?? { label: r.label, sub: r.sub, total: 0, count: 0 };
    cur.total += r.value;
    cur.count += 1;
    // Several categories under one income stream — don't claim just the first.
    if (cur.sub && r.sub && cur.sub !== r.sub) cur.sub = undefined;
    map.set(r.key, cur);
  }
  const grand = [...map.values()].reduce((s, v) => s + v.total, 0);
  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      label: v.label,
      sub: v.sub,
      total: v.total,
      count: v.count,
      percent: grand > 0 ? (v.total / grand) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

function GroupList({
  title,
  groups,
  currency,
  colour,
  emptyText,
}: {
  title: string;
  groups: Group[];
  currency: Currency;
  colour: string;
  emptyText: string;
}) {
  return (
    <div>
      <h3 className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
        {title}
      </h3>
      {groups.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-600">{emptyText}</p>
      ) : (
        <ul className="mt-2.5 space-y-2.5">
          {groups.map((g) => (
            <li key={g.key}>
              <div className="flex items-baseline gap-3">
                <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                  {g.label}
                  {g.count > 1 && (
                    <span className="ml-1.5 text-[11px] text-zinc-600">×{g.count}</span>
                  )}
                </span>
                <span className="tnum shrink-0 text-sm text-zinc-100">
                  {formatMoney(g.total, currency)}
                </span>
                <span className="tnum w-9 shrink-0 text-right text-[11px] text-zinc-600">
                  {g.percent.toFixed(0)}%
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(g.percent, 1.5)}%`, background: colour }}
                  />
                </div>
              </div>
              {g.sub && <p className="mt-1 text-[11px] text-zinc-600">{g.sub}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One month, opened up: where the money came from, where it went, and every
 * entry behind those two totals.
 *
 * Works entirely off the entries already loaded for the page — the month totals
 * shown here are summed from the same locked figures the table adds up, so a
 * breakdown can never disagree with the row that opened it.
 */
export default function MonthBreakdown({
  month,
  income,
  expenses,
  currency,
  onClose,
}: Props) {
  const inMonth = <T extends { date: string }>(rows: T[]) =>
    rows.filter((r) => r.date.slice(0, 7) === month.month);

  const monthIncome = inMonth(income);
  const monthExpenses = inMonth(expenses);

  const incomeStreams = group(
    monthIncome.map((e) => ({
      key: e.source.trim().toLowerCase(),
      label: e.source,
      sub: INCOME_CATEGORY_LABELS[e.category],
      value: convertLocked(e.locked, currency),
    }))
  );

  const expenseCategories = group(
    monthExpenses.map((e) => ({
      key: e.category,
      label: EXPENSE_CATEGORY_LABELS[e.category],
      value: convertLocked(e.locked, currency),
    }))
  );

  // Everything that month, newest first, income and spending interleaved.
  const timeline = [
    ...monthIncome.map((e) => ({
      id: e.id,
      date: e.date,
      title: e.source,
      sub: INCOME_CATEGORY_LABELS[e.category],
      value: convertLocked(e.locked, currency),
      locked: e.locked,
      positive: true,
    })),
    ...monthExpenses.map((e) => ({
      id: e.id,
      date: e.date,
      title: e.name,
      sub: EXPENSE_CATEGORY_LABELS[e.category],
      value: -convertLocked(e.locked, currency),
      locked: e.locked,
      positive: false,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section className="rounded-xl border border-zinc-700 bg-zinc-900/70 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-zinc-500">Breakdown</p>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-zinc-50">
            {month.label}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-lg border border-zinc-700 p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Close breakdown"
        >
          <X size={14} />
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 border-y border-zinc-800 py-3 text-xs">
        <div>
          <dt className="text-zinc-500">In</dt>
          <dd className="tnum mt-1 text-sm text-zinc-100">
            {formatMoney(month.income, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Out</dt>
          <dd className="tnum mt-1 text-sm text-zinc-100">
            {formatMoney(month.expenses, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Left over</dt>
          <dd className={`tnum mt-1 text-sm ${toneClass(month.net)}`}>
            {formatMoney(month.net, currency)}
          </dd>
        </div>
      </dl>

      {timeline.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">
          Nothing was recorded in {month.label}.
        </p>
      ) : (
        <>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            <GroupList
              title="Income by stream"
              groups={incomeStreams}
              currency={currency}
              colour={C_INCOME}
              emptyText="No income recorded this month."
            />
            <GroupList
              title="Spending by category"
              groups={expenseCategories}
              currency={currency}
              colour={C_EXPENSE}
              emptyText="No spending recorded this month."
            />
          </div>

          <div className="mt-6 border-t border-zinc-800 pt-4">
            <h3 className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
              Everything in {month.label}
            </h3>
            <ul className="mt-2">
              {timeline.map((t) => {
                const foreign = t.locked.currency !== currency;
                const unavailable = t.locked.rateSource === "unavailable";
                return (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 border-b border-zinc-800/60 py-2 last:border-b-0"
                  >
                    <span className="tnum w-12 shrink-0 text-[11px] text-zinc-600">
                      {formatDayMonth(t.date)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-200">{t.title}</p>
                      <p className="truncate text-[11px] text-zinc-600">{t.sub}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className="tnum text-sm"
                        style={{ color: t.positive ? C_INCOME : C_EXPENSE }}
                      >
                        {t.positive ? "+" : "−"}
                        {formatMoney(Math.abs(t.value), currency)}
                      </p>
                      {foreign && (
                        <p
                          className={`tnum flex items-center justify-end gap-1 text-[11px] ${
                            unavailable ? "text-amber-400" : "text-zinc-600"
                          }`}
                          title={
                            unavailable
                              ? "No exchange rate was found, so this is the amount as typed."
                              : `Locked on ${t.locked.rateDate} at 1 ${t.locked.currency} = ${(
                                  currency === "CAD"
                                    ? t.locked.rateCAD
                                    : t.locked.rateUSD
                                ).toPrecision(6)} ${currency}`
                          }
                        >
                          {unavailable ? (
                            <AlertTriangle size={9} />
                          ) : (
                            <Lock size={9} />
                          )}
                          {formatMoney(t.locked.amount, t.locked.currency)}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
