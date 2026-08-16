"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Copy,
  Lock,
  AlertTriangle,
  CreditCard,
  ChevronRight,
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
} from "lucide-react";
import MoneyEntryForm from "@/components/MoneyEntryForm";
import CardBillForm from "@/components/CardBillForm";
import MonthlyFlowChart from "@/components/MonthlyFlowChart";
import MonthBreakdown from "@/components/MonthBreakdown";
import {
  CardBill,
  CashflowSummary,
  EXPENSE_CATEGORY_LABELS,
  ExpenseEntry,
  INCOME_CATEGORY_LABELS,
  IncomeEntry,
} from "@/lib/types";
import {
  convertLocked,
  formatDayMonth,
  formatDueIn,
  formatMoney,
  ordinal,
  toneClass,
} from "@/lib/format";

const C_INCOME = "#34b27b";
const C_EXPENSE = "#d55181";

const card = "rounded-xl border border-zinc-800 bg-zinc-900/40";
const addButton =
  "flex items-center gap-1 rounded-lg border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200";
const iconButton =
  "rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300";

/** How urgent a card's due date looks. */
function dueTone(days: number | undefined): string {
  if (days === undefined) return "text-zinc-500";
  if (days < 0) return "text-rose-400";
  if (days <= 3) return "text-amber-400";
  return "text-zinc-500";
}

export default function CashflowPage() {
  const [summary, setSummary] = useState<CashflowSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [incomeForm, setIncomeForm] = useState(false);
  const [incomeEditing, setIncomeEditing] = useState<IncomeEntry | null>(null);
  const [incomeTemplate, setIncomeTemplate] = useState<IncomeEntry | null>(null);

  const [expenseForm, setExpenseForm] = useState(false);
  const [expenseEditing, setExpenseEditing] = useState<ExpenseEntry | null>(null);
  const [expenseTemplate, setExpenseTemplate] = useState<ExpenseEntry | null>(null);

  const [cardEditing, setCardEditing] = useState<CardBill | null>(null);
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const breakdownRef = useRef<HTMLDivElement | null>(null);

  /** Clicking the open month closes it, so the same control works both ways. */
  function toggleMonth(month: string) {
    setSelectedMonth((prev) => (prev === month ? null : month));
  }

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/cashflow", { cache: "no-store" });
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

  // On a phone the panel opens below the fold, so bring it into view.
  useEffect(() => {
    if (selectedMonth && breakdownRef.current) {
      breakdownRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedMonth]);

  async function remove(kind: "income" | "expenses", id: string, name: string) {
    if (!confirm(`Remove "${name}"?`)) return;
    await fetch(`/api/${kind}/${id}`, { method: "DELETE" });
    load(true);
  }

  function closeIncome() {
    setIncomeForm(false);
    setIncomeEditing(null);
    setIncomeTemplate(null);
  }

  function closeExpense() {
    setExpenseForm(false);
    setExpenseEditing(null);
    setExpenseTemplate(null);
  }

  if (loading) {
    return (
      <div className="space-y-3 pt-2">
        <div className="h-36 animate-pulse rounded-xl bg-zinc-900" />
        <div className="h-44 animate-pulse rounded-xl bg-zinc-900" />
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
  const current = summary.current;
  const net = current?.net ?? 0;
  const monthsWithActivity = summary.months.filter(
    (m) => m.incomeCount > 0 || m.expenseCount > 0
  );
  const nothingYet = summary.income.length === 0 && summary.expenses.length === 0;
  const monthRows = showAllMonths
    ? [...summary.months].reverse()
    : [...summary.months].reverse().slice(0, 6);
  // Looked up rather than stored, so a reload that drops the month closes the
  // panel instead of leaving it showing stale figures.
  const selectedMonthSummary =
    summary.months.find((m) => m.month === selectedMonth) ?? null;

  return (
    <div className="space-y-4">
      {/* This month */}
      <section className={`${card} p-5`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-zinc-500">
              {current?.label ?? "This month"} — left over
            </p>
            <p
              className={`mt-1 text-3xl font-semibold tracking-tight sm:text-4xl ${
                net < 0 ? "text-rose-300" : "text-zinc-50"
              }`}
            >
              {formatMoney(net, cur)}
            </p>
            <p className="mt-1.5 text-xs text-zinc-500">
              What came in, minus what went out
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

        <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-zinc-800 pt-4 text-xs">
          <div>
            <dt className="flex items-center gap-1.5 text-zinc-500">
              <ArrowDownRight size={13} style={{ color: C_INCOME }} />
              In this month
            </dt>
            <dd className="tnum mt-1 text-sm text-zinc-100">
              {formatMoney(current?.income ?? 0, cur)}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-zinc-500">
              <ArrowUpRight size={13} style={{ color: C_EXPENSE }} />
              Out this month
            </dt>
            <dd className="tnum mt-1 text-sm text-zinc-100">
              {formatMoney(current?.expenses ?? 0, cur)}
            </dd>
          </div>
        </dl>

        {monthsWithActivity.length > 1 && (
          <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-zinc-800 pt-4 text-xs">
            <div>
              <dt className="text-zinc-500">Total in</dt>
              <dd className="tnum mt-1 text-sm text-zinc-100">
                {formatMoney(summary.totalIncome, cur)}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Total out</dt>
              <dd className="tnum mt-1 text-sm text-zinc-100">
                {formatMoney(summary.totalExpenses, cur)}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Kept</dt>
              <dd className={`tnum mt-1 text-sm ${toneClass(summary.totalNet)}`}>
                {formatMoney(summary.totalNet, cur)}
              </dd>
            </div>
          </dl>
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

      {nothingYet && (
        <div className="rounded-xl border border-dashed border-zinc-800 px-6 py-10 text-center">
          <Wallet size={26} className="mx-auto text-zinc-700" />
          <p className="mt-3 text-sm font-medium text-zinc-300">Nothing recorded yet</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-zinc-500">
            Add what you earned and what you spent below. Paid in another
            currency? Enter it in that currency — the app converts it at the rate
            on the day it landed and keeps that figure fixed.
          </p>
        </div>
      )}

      {/* Month by month */}
      {monthsWithActivity.length > 0 && (
        <section className={`${card} p-5`}>
          <h2 className="text-sm font-medium text-zinc-200">Month by month</h2>
          <div className="mt-4">
            <MonthlyFlowChart
              months={summary.months}
              currency={cur}
              selected={selectedMonth}
              onSelect={toggleMonth}
            />
          </div>

          <div className="mt-5 overflow-x-auto border-t border-zinc-800 pt-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="pb-2 pr-3 font-medium">Month</th>
                  <th className="pb-2 pr-3 text-right font-medium">In</th>
                  <th className="pb-2 pr-3 text-right font-medium">Out</th>
                  <th className="pb-2 pr-3 text-right font-medium">Net</th>
                  <th className="pb-2 text-right font-medium">Running total</th>
                </tr>
              </thead>
              <tbody>
                {monthRows.map((m) => {
                  const isSelected = selectedMonth === m.month;
                  return (
                    <tr
                      key={m.month}
                      onClick={() => toggleMonth(m.month)}
                      className={`cursor-pointer border-t border-zinc-800/60 transition-colors ${
                        isSelected ? "bg-zinc-800/60" : "hover:bg-zinc-800/30"
                      }`}
                    >
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <span
                          className={`flex items-center gap-1 ${
                            isSelected ? "text-zinc-100" : "text-zinc-300"
                          }`}
                        >
                          <ChevronRight
                            size={12}
                            className={`shrink-0 text-zinc-600 transition-transform ${
                              isSelected ? "rotate-90" : ""
                            }`}
                          />
                          {m.label}
                        </span>
                      </td>
                      <td className="tnum py-2 pr-3 text-right text-zinc-400">
                        {m.income > 0 ? formatMoney(m.income, cur) : "—"}
                      </td>
                      <td className="tnum py-2 pr-3 text-right text-zinc-400">
                        {m.expenses > 0 ? formatMoney(m.expenses, cur) : "—"}
                      </td>
                      <td className={`tnum py-2 pr-3 text-right ${toneClass(m.net)}`}>
                        {m.income === 0 && m.expenses === 0
                          ? "—"
                          : formatMoney(m.net, cur)}
                      </td>
                      <td className={`tnum py-2 text-right ${toneClass(m.cumulativeNet)}`}>
                        {formatMoney(m.cumulativeNet, cur)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {summary.months.length > 6 && (
            <button
              onClick={() => setShowAllMonths((s) => !s)}
              className="mt-3 text-[11px] text-zinc-500 underline underline-offset-2 hover:text-zinc-300"
            >
              {showAllMonths
                ? "Show recent months only"
                : `Show all ${summary.months.length} months`}
            </button>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
            The running total is every month added together from the start, so
            you can see whether you&apos;re ahead overall and not just this month.
          </p>
        </section>
      )}

      {selectedMonthSummary && (
        <div ref={breakdownRef}>
          <MonthBreakdown
            month={selectedMonthSummary}
            income={summary.income}
            expenses={summary.expenses}
            currency={cur}
            onClose={() => setSelectedMonth(null)}
          />
        </div>
      )}

      {/* Credit cards */}
      <section className={card}>
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-200">
            <CreditCard size={15} className="text-zinc-400" />
            Credit cards
          </h2>
          <Link href="/networth" className={addButton}>
            <Plus size={11} /> Add a card
          </Link>
        </div>

        {summary.cards.length === 0 ? (
          <p className="border-t border-zinc-800 px-4 py-4 text-xs leading-relaxed text-zinc-500">
            No credit cards yet. Add one under{" "}
            <Link href="/networth" className="text-zinc-300 underline underline-offset-2">
              Net worth → Debts
            </Link>{" "}
            with the type set to Credit card, and it will show up here so you can
            fill in when it&apos;s due.
          </p>
        ) : (
          <ul className="border-t border-zinc-800">
            {summary.cards.map((c) => (
              <li key={c.id} className="border-b border-zinc-800/60 last:border-b-0">
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-100">{c.name}</p>
                    <p className="truncate text-[11px] text-zinc-500">
                      {c.dueDay ? (
                        <>
                          Due the {ordinal(c.dueDay)}
                          {c.daysUntilDue !== undefined && (
                            <span className={dueTone(c.daysUntilDue)}>
                              {" "}
                              · {formatDueIn(c.daysUntilDue)}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-zinc-600">No due date set</span>
                      )}
                      {c.autopay && " · autopay"}
                      {c.utilization !== undefined &&
                        ` · ${c.utilization.toFixed(0)}% of limit`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tnum text-sm text-zinc-100">
                      {formatMoney(
                        c.statementBalance ?? c.balance,
                        c.currency
                      )}
                    </p>
                    <p className="text-[11px] text-zinc-600">
                      {c.statementBalance !== undefined ? "due" : "owed"}
                      {c.minimumDue !== undefined &&
                        ` · min ${formatMoney(c.minimumDue, c.currency)}`}
                    </p>
                  </div>
                  <button
                    onClick={() => setCardEditing(cardEditing?.id === c.id ? null : c)}
                    className={iconButton}
                    aria-label={`Edit ${c.name} billing details`}
                  >
                    <Pencil size={12} />
                  </button>
                </div>

                {cardEditing?.id === c.id && (
                  <CardBillForm
                    card={c}
                    onDone={() => {
                      setCardEditing(null);
                      load(true);
                    }}
                    onCancel={() => setCardEditing(null)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="border-t border-zinc-800 px-4 py-3 text-[11px] leading-relaxed text-zinc-600">
          These are the same cards as your Net worth debts — one card, entered
          once. Paying one off is an expense: log it below under Credit card
          payment.
        </p>
      </section>

      {/* Income */}
      <section className={card}>
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-200">
            <ArrowDownRight size={15} style={{ color: C_INCOME }} />
            Income
            {summary.income.length > 0 && (
              <span className="tnum text-xs text-zinc-500">
                {formatMoney(summary.totalIncome, cur)} all time
              </span>
            )}
          </h2>
          <button
            onClick={() => {
              setIncomeEditing(null);
              setIncomeTemplate(null);
              setIncomeForm((f) => !f);
            }}
            className={addButton}
          >
            <Plus size={11} /> Add
          </button>
        </div>

        {summary.income.length > 0 && (
          <ul className="border-t border-zinc-800">
            {summary.income.map((e) => (
              <EntryRow
                key={e.id}
                title={e.source}
                subtitle={INCOME_CATEGORY_LABELS[e.category]}
                entry={e}
                master={cur}
                onEdit={() => {
                  setIncomeTemplate(null);
                  setIncomeEditing(e);
                  setIncomeForm(true);
                }}
                onRepeat={() => {
                  setIncomeEditing(null);
                  setIncomeTemplate(e);
                  setIncomeForm(true);
                }}
                onRemove={() => remove("income", e.id, e.source)}
              />
            ))}
          </ul>
        )}

        {incomeForm && (
          <MoneyEntryForm
            mode="income"
            editing={incomeEditing}
            template={incomeTemplate}
            master={cur}
            onDone={() => {
              closeIncome();
              load(true);
            }}
            onCancel={closeIncome}
          />
        )}
      </section>

      {/* Expenses */}
      <section className={card}>
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-200">
            <ArrowUpRight size={15} style={{ color: C_EXPENSE }} />
            Spending
            {summary.expenses.length > 0 && (
              <span className="tnum text-xs text-zinc-500">
                {formatMoney(summary.totalExpenses, cur)} all time
              </span>
            )}
          </h2>
          <button
            onClick={() => {
              setExpenseEditing(null);
              setExpenseTemplate(null);
              setExpenseForm((f) => !f);
            }}
            className={addButton}
          >
            <Plus size={11} /> Add
          </button>
        </div>

        {summary.expenses.length > 0 && (
          <ul className="border-t border-zinc-800">
            {summary.expenses.map((e) => (
              <EntryRow
                key={e.id}
                title={e.name}
                subtitle={EXPENSE_CATEGORY_LABELS[e.category]}
                entry={e}
                master={cur}
                onEdit={() => {
                  setExpenseTemplate(null);
                  setExpenseEditing(e);
                  setExpenseForm(true);
                }}
                onRepeat={() => {
                  setExpenseEditing(null);
                  setExpenseTemplate(e);
                  setExpenseForm(true);
                }}
                onRemove={() => remove("expenses", e.id, e.name)}
              />
            ))}
          </ul>
        )}

        {expenseForm && (
          <MoneyEntryForm
            mode="expense"
            editing={expenseEditing}
            template={expenseTemplate}
            master={cur}
            onDone={() => {
              closeExpense();
              load(true);
            }}
            onCancel={closeExpense}
          />
        )}
      </section>

      <p className="text-[11px] leading-relaxed text-zinc-600">
        Subscriptions live on their own tab and are deliberately left out of
        these totals — they are charged to a card, and the card payment is
        already counted here. Counting both would double them.
      </p>
    </div>
  );
}

interface RowProps {
  title: string;
  subtitle: string;
  entry: IncomeEntry | ExpenseEntry;
  master: "USD" | "CAD";
  onEdit: () => void;
  onRepeat: () => void;
  onRemove: () => void;
}

function EntryRow({
  title,
  subtitle,
  entry,
  master,
  onEdit,
  onRepeat,
  onRemove,
}: RowProps) {
  const { locked } = entry;
  const converted = convertLocked(locked, master);
  const foreign = locked.currency !== master;
  const unavailable = locked.rateSource === "unavailable";

  return (
    <li className="flex items-center gap-3 border-b border-zinc-800/60 px-4 py-2.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-zinc-100">{title}</p>
        <p className="truncate text-[11px] text-zinc-500">
          {formatDayMonth(entry.date)} · {subtitle}
          {entry.notes && ` · ${entry.notes}`}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="tnum text-sm text-zinc-100">{formatMoney(converted, master)}</p>
        {foreign && (
          <p
            className={`tnum flex items-center justify-end gap-1 text-[11px] ${
              unavailable ? "text-amber-400" : "text-zinc-600"
            }`}
            title={
              unavailable
                ? "No exchange rate was found, so this is the amount as typed."
                : `Locked on ${locked.rateDate} at 1 ${locked.currency} = ${(
                    master === "CAD" ? locked.rateCAD : locked.rateUSD
                  ).toPrecision(6)} ${master}`
            }
          >
            {unavailable ? <AlertTriangle size={9} /> : <Lock size={9} />}
            {formatMoney(locked.amount, locked.currency)}
          </p>
        )}
      </div>

      <div className="flex shrink-0 gap-1">
        <button onClick={onRepeat} className={iconButton} aria-label={`Repeat ${title}`}>
          <Copy size={12} />
        </button>
        <button onClick={onEdit} className={iconButton} aria-label={`Edit ${title}`}>
          <Pencil size={12} />
        </button>
        <button
          onClick={onRemove}
          className="rounded-md p-1.5 text-zinc-700 transition-colors hover:bg-rose-950/40 hover:text-rose-400"
          aria-label={`Remove ${title}`}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </li>
  );
}
