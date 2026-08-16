"use client";

import { useState } from "react";
import { Plus, Trash2, TriangleAlert, Sparkle } from "lucide-react";
import DebtPaymentForm from "./DebtPaymentForm";
import { Currency, LIABILITY_KIND_LABELS, ValuedLiability } from "@/lib/types";
import { formatDayMonth, formatMoney, monthLabel } from "@/lib/format";

const C_DEBT = "#d55181";
const C_PAID = "#34b27b";

interface Props {
  debt: ValuedLiability;
  master: Currency;
  onChanged: () => void;
}

/** "18 months" -> "1 year 6 months" */
function humanMonths(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} year${y === 1 ? "" : "s"}`);
  if (m > 0) parts.push(`${m} month${m === 1 ? "" : "s"}`);
  return parts.join(" ") || "under a month";
}

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: string;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-[11px] text-zinc-500">{label}</dt>
      <dd className={`tnum mt-0.5 text-sm ${tone ?? "text-zinc-100"}`}>{value}</dd>
      {hint && <p className="mt-0.5 text-[10px] text-zinc-600">{hint}</p>}
    </div>
  );
}

/**
 * One debt, opened up: how far along it is, what it costs to carry, when it
 * clears at the current rate, and every payment made against it.
 */
export default function DebtDetailPanel({ debt, master, onChanged }: Props) {
  const [paying, setPaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const cur = debt.currency;
  const hasRate = debt.interestRate !== undefined && debt.interestRate > 0;
  const payments = [...debt.payments].sort((a, b) => b.date.localeCompare(a.date));
  const proj = debt.projection;

  async function removePayment(paymentId: string, when: string) {
    if (!confirm(`Remove the payment recorded on ${when}?`)) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/liabilities/${debt.id}/payments/${paymentId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.message) setNotice(data.message);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 border-t border-zinc-800 bg-zinc-950/40 p-4">
      {/* Progress */}
      {debt.paidOffPercent !== null && debt.startingBalance !== null ? (
        <div>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="text-zinc-400">
              {formatMoney(debt.paidOff ?? 0, cur)} paid off
            </span>
            <span className="tnum text-zinc-500">
              of {formatMoney(debt.startingBalance, cur)}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(debt.paidOffPercent, 0.5)}%`,
                background: C_PAID,
              }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-500">
            {debt.paidOffPercent.toFixed(1)}% gone ·{" "}
            {formatMoney(debt.balance, cur)} still owed
            {!debt.originalAmount && (
              <span className="text-zinc-600">
                {" "}
                · measured from the highest balance on record. Set the original
                amount below for an exact figure.
              </span>
            )}
          </p>
        </div>
      ) : (
        <p className="text-[11px] leading-relaxed text-zinc-500">
          {formatMoney(debt.balance, cur)} owed. Add what you originally
          borrowed — under Edit — and this becomes a progress bar showing how
          far you&apos;ve got.
        </p>
      )}

      {/* Numbers */}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-zinc-800 py-3 sm:grid-cols-4">
        <Stat label="Still owed" value={formatMoney(debt.balance, cur)} />
        <Stat
          label="Interest rate"
          value={hasRate ? `${debt.interestRate}%` : "None set"}
          tone={hasRate ? "text-zinc-100" : "text-zinc-500"}
          hint={
            !hasRate && debt.kind === "student_loan"
              ? "Common while studying"
              : undefined
          }
        />
        <Stat
          label="Costs you"
          value={
            debt.yearlyInterest !== null
              ? `${formatMoney(debt.yearlyInterest, cur)}/yr`
              : "—"
          }
          tone={debt.yearlyInterest ? "text-rose-300" : "text-zinc-500"}
          hint={
            debt.monthlyInterest !== null
              ? `${formatMoney(debt.monthlyInterest, cur)} a month`
              : undefined
          }
        />
        <Stat
          label="Paid so far"
          value={debt.totalPaid > 0 ? formatMoney(debt.totalPaid, cur) : "—"}
          hint={
            debt.totalInterestPaid > 0
              ? `${formatMoney(debt.totalInterestPaid, cur)} of it interest`
              : payments.length > 0
                ? "all of it off the balance"
                : undefined
          }
        />
      </dl>

      {/* Payoff projection */}
      {proj && (
        <div
          className={`rounded-lg border p-3 text-[11px] leading-relaxed ${
            proj.neverPaysOff
              ? "border-rose-900/50 bg-rose-950/25 text-rose-200/90"
              : "border-zinc-800 bg-zinc-900/60 text-zinc-400"
          }`}
        >
          {proj.neverPaysOff ? (
            <p className="flex gap-2">
              <TriangleAlert size={13} className="mt-0.5 shrink-0" />
              At {formatMoney(proj.monthlyPayment, cur)} a month this never gets
              paid off — interest alone is{" "}
              {formatMoney(proj.monthlyInterest, cur)} a month, so the balance
              grows. It needs more than that each month just to stand still.
            </p>
          ) : (
            <>
              <p className="text-zinc-300">
                Clear in{" "}
                <strong className="font-medium text-zinc-100">
                  {humanMonths(proj.monthsRemaining!)}
                </strong>
                , around {monthLabel(proj.payoffDate!.slice(0, 7))}
              </p>
              <p className="mt-1">
                At {formatMoney(proj.monthlyPayment, cur)} a month
                {proj.basis === "recent-average"
                  ? " — your recent average, since no scheduled payment is set"
                  : " — your scheduled payment"}
                .
                {proj.interestRemaining !== null && proj.interestRemaining > 0.5 && (
                  <>
                    {" "}
                    You&apos;ll pay another{" "}
                    <strong className="font-medium text-rose-300">
                      {formatMoney(proj.interestRemaining, cur)}
                    </strong>{" "}
                    in interest getting there.
                  </>
                )}
              </p>
            </>
          )}
        </div>
      )}

      {!proj && debt.balance > 0 && (
        <p className="text-[11px] leading-relaxed text-zinc-600">
          Record a payment or two — or set a scheduled monthly payment under
          Edit — and this will show when the debt clears and what the interest
          costs you between now and then.
        </p>
      )}

      {/* Payments */}
      <div>
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
            Payments {payments.length > 0 && `(${payments.length})`}
          </h4>
          <button
            onClick={() => setPaying((p) => !p)}
            className="flex items-center gap-1 rounded-lg border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
          >
            <Plus size={11} /> Record a payment
          </button>
        </div>

        {paying && (
          <div className="mt-2.5">
            <DebtPaymentForm
              debt={debt}
              onDone={() => {
                setPaying(false);
                setNotice(null);
                onChanged();
              }}
              onCancel={() => setPaying(false)}
            />
          </div>
        )}

        {notice && (
          <p className="mt-2.5 rounded-lg border border-amber-900/40 bg-amber-950/20 p-2.5 text-[11px] leading-relaxed text-amber-200/80">
            {notice}
          </p>
        )}

        {payments.length === 0 ? (
          <p className="mt-2 text-[11px] text-zinc-600">
            Nothing recorded yet. Each payment you log comes off the balance and
            builds up the history below.
          </p>
        ) : (
          <ul className="mt-2">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 border-b border-zinc-800/60 py-2 last:border-b-0"
              >
                <span className="tnum w-12 shrink-0 text-[11px] text-zinc-600">
                  {formatDayMonth(p.date)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="tnum text-sm text-zinc-200">
                    {formatMoney(p.amount, cur)}
                  </p>
                  <p className="truncate text-[10px] text-zinc-600">
                    {formatMoney(p.principalPortion, cur)} off the balance
                    {p.interestPortion > 0 && (
                      <>
                        {" · "}
                        {formatMoney(p.interestPortion, cur)} interest
                        {p.interestEstimated && (
                          <span
                            className="text-amber-500"
                            title="Worked out from the rate rather than taken from a statement"
                          >
                            {" "}
                            <Sparkle size={8} className="inline" /> estimated
                          </span>
                        )}
                      </>
                    )}
                    {p.notes && ` · ${p.notes}`}
                  </p>
                </div>
                <span className="tnum shrink-0 text-[11px] text-zinc-500">
                  → {formatMoney(p.balanceAfter, cur)}
                </span>
                <button
                  onClick={() => removePayment(p.id, formatDayMonth(p.date))}
                  disabled={busy}
                  className="shrink-0 rounded-md p-1.5 text-zinc-700 transition-colors hover:bg-rose-950/40 hover:text-rose-400 disabled:opacity-40"
                  aria-label={`Remove payment from ${p.date}`}
                >
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {debt.currency !== master && (
        <p className="text-[10px] text-zinc-600">
          Figures here are in {cur}, the currency of the debt. Net worth
          converts it to {master} at today&apos;s rate.
        </p>
      )}

      <p className="text-[10px] leading-relaxed text-zinc-600">
        {LIABILITY_KIND_LABELS[debt.kind]} · recording a payment reduces the
        balance, which is the same balance the net worth total subtracts. It
        isn&apos;t added to your spending on the Income &amp; bills tab — log it
        there too if you want it counted as money out.
      </p>
    </div>
  );
}
