"use client";

import { useState } from "react";
import { CardBill } from "@/lib/types";

interface Props {
  card: CardBill;
  onDone: () => void;
  onCancel: () => void;
}

const field =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none";
const label = "mb-1 block text-[11px] font-medium text-zinc-500";

/**
 * Edits the billing side of a credit card. The card itself — its name, balance
 * and currency — stays owned by the Net worth tab; this only fills in the
 * details that make it a bill rather than a debt.
 */
export default function CardBillForm({ card, onDone, onCancel }: Props) {
  const [dueDay, setDueDay] = useState(card.dueDay ? String(card.dueDay) : "");
  const [statementBalance, setStatementBalance] = useState(
    card.statementBalance !== undefined ? String(card.statementBalance) : ""
  );
  const [minimumDue, setMinimumDue] = useState(
    card.minimumDue !== undefined ? String(card.minimumDue) : ""
  );
  const [creditLimit, setCreditLimit] = useState(
    card.creditLimit !== undefined ? String(card.creditLimit) : ""
  );
  const [autopay, setAutopay] = useState(Boolean(card.autopay));
  const [balance, setBalance] = useState(String(card.balance));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/liabilities/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          balance: Number(balance),
          dueDay,
          statementBalance,
          minimumDue,
          creditLimit,
          autopay,
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
    <form onSubmit={submit} className="space-y-3 border-t border-zinc-800 bg-zinc-950/40 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor={`due-${card.id}`}>
            Due on the
          </label>
          <input
            id={`due-${card.id}`}
            type="number"
            min="1"
            max="31"
            inputMode="numeric"
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
            placeholder="e.g. 15"
            className={field}
          />
        </div>
        <div>
          <label className={label} htmlFor={`stmt-${card.id}`}>
            Amount due ({card.currency})
          </label>
          <input
            id={`stmt-${card.id}`}
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={statementBalance}
            onChange={(e) => setStatementBalance(e.target.value)}
            placeholder="This statement"
            className={field}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor={`min-${card.id}`}>
            Minimum payment
          </label>
          <input
            id={`min-${card.id}`}
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={minimumDue}
            onChange={(e) => setMinimumDue(e.target.value)}
            className={field}
          />
        </div>
        <div>
          <label className={label} htmlFor={`limit-${card.id}`}>
            Credit limit
          </label>
          <input
            id={`limit-${card.id}`}
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
            className={field}
          />
        </div>
      </div>

      <div>
        <label className={label} htmlFor={`bal-${card.id}`}>
          Current balance owed ({card.currency})
        </label>
        <input
          id={`bal-${card.id}`}
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          className={field}
        />
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
          This is the same balance the Net worth tab subtracts — changing it here
          changes it there, and records a snapshot so you can see the card being
          paid down.
        </p>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
        <input
          type="checkbox"
          checked={autopay}
          onChange={(e) => setAutopay(e.target.checked)}
          className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 accent-emerald-500"
        />
        Paid automatically
      </label>

      {error && (
        <p className="rounded-lg border border-rose-900/50 bg-rose-950/30 p-2.5 text-xs text-rose-300">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
