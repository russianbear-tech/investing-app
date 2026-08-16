"use client";

import { useState } from "react";
import { Loader2, Info } from "lucide-react";
import { ValuedLiability } from "@/lib/types";
import { formatMoney, todayLocalISO } from "@/lib/format";

interface Props {
  debt: ValuedLiability;
  onDone: () => void;
  onCancel: () => void;
}

const field =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none";
const label = "mb-1 block text-[11px] font-medium text-zinc-500";

export default function DebtPaymentForm({ debt, onDone, onCancel }: Props) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayLocalISO());
  const [balanceAfter, setBalanceAfter] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasRate = debt.interestRate !== undefined && debt.interestRate > 0;

  // Mirrors what the server will do, so the split is visible before saving.
  const paid = Number(amount);
  const after = balanceAfter.trim() === "" ? null : Number(balanceAfter);
  let previewInterest: number | null = null;
  let previewPrincipal: number | null = null;
  let estimated = false;

  if (Number.isFinite(paid) && paid > 0) {
    if (after !== null && Number.isFinite(after)) {
      previewPrincipal = debt.balance - after;
      previewInterest = Math.max(0, paid - previewPrincipal);
    } else if (!hasRate) {
      previewInterest = 0;
      previewPrincipal = paid;
    } else {
      estimated = true;
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/liabilities/${debt.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          date,
          balanceAfter: balanceAfter.trim() === "" ? undefined : Number(balanceAfter),
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg bg-zinc-950/50 p-3.5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor={`pay-amt-${debt.id}`}>
            You paid ({debt.currency})
          </label>
          <input
            id={`pay-amt-${debt.id}`}
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className={field}
            required
            autoFocus
          />
        </div>
        <div>
          <label className={label} htmlFor={`pay-date-${debt.id}`}>
            Date
          </label>
          <input
            id={`pay-date-${debt.id}`}
            type="date"
            value={date}
            max={todayLocalISO()}
            onChange={(e) => setDate(e.target.value)}
            className={field}
            required
          />
        </div>
      </div>

      <div>
        <label className={label} htmlFor={`pay-after-${debt.id}`}>
          Balance after, from your statement{" "}
          <span className="text-zinc-600">(optional)</span>
        </label>
        <input
          id={`pay-after-${debt.id}`}
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={balanceAfter}
          onChange={(e) => setBalanceAfter(e.target.value)}
          placeholder={formatMoney(debt.balance, debt.currency).replace(/[^0-9.]/g, "")}
          className={field}
        />
      </div>

      {/* What the split will be, and how confident it is. */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-[11px] leading-relaxed">
        {previewInterest !== null && previewPrincipal !== null ? (
          <>
            <p className="text-zinc-300">
              <strong className="font-medium">
                {formatMoney(previewPrincipal, debt.currency)}
              </strong>{" "}
              off the balance
              {previewInterest > 0 && (
                <>
                  ,{" "}
                  <strong className="font-medium">
                    {formatMoney(previewInterest, debt.currency)}
                  </strong>{" "}
                  to interest
                </>
              )}
            </p>
            {previewPrincipal < 0 && (
              <p className="mt-1 text-amber-400">
                That balance is higher than the current one, so this payment
                didn&apos;t cover the interest and the debt grew.
              </p>
            )}
            <p className="mt-1 text-zinc-600">
              {after !== null
                ? "Worked out from the balance you gave — exact, not estimated."
                : "This debt has no interest rate set, so all of it comes off the balance."}
            </p>
          </>
        ) : estimated ? (
          <p className="flex gap-2 text-zinc-400">
            <Info size={13} className="mt-0.5 shrink-0" />
            Leave the balance blank and the app will work out the interest from
            the {debt.interestRate}% rate and the time since your last payment.
            That&apos;s an estimate and will be labelled as one — enter the
            balance from your statement to record it exactly.
          </p>
        ) : (
          <p className="text-zinc-600">Enter what you paid to see how it splits.</p>
        )}
      </div>

      <div>
        <label className={label} htmlFor={`pay-notes-${debt.id}`}>
          Notes <span className="text-zinc-600">(optional)</span>
        </label>
        <input
          id={`pay-notes-${debt.id}`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={field}
        />
      </div>

      {error && (
        <p className="rounded-lg border border-rose-900/50 bg-rose-950/30 p-2.5 text-xs text-rose-300">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          Record payment
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
