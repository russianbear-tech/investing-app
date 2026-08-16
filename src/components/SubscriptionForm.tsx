"use client";

import { useState } from "react";
import {
  BILLING_CYCLE_LABELS,
  BILLING_CYCLE_ORDER,
  Currency,
  ENTRY_CURRENCIES,
  Subscription,
} from "@/lib/types";

interface Props {
  editing: Subscription | null;
  /** Credit cards available to charge this to, from the Net worth debts list. */
  cards: { id: string; name: string }[];
  master: Currency;
  onDone: () => void;
  onCancel: () => void;
}

const field =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none";
const label = "mb-1 block text-[11px] font-medium text-zinc-500";

export default function SubscriptionForm({
  editing,
  cards,
  master,
  onDone,
  onCancel,
}: Props) {
  const [name, setName] = useState(editing?.name ?? "");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [currency, setCurrency] = useState(editing?.currency ?? master);
  const [cycle, setCycle] = useState(editing?.cycle ?? "monthly");
  const [cardId, setCardId] = useState(editing?.cardId ?? "");
  const [nextCharge, setNextCharge] = useState(editing?.nextCharge ?? "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [active, setActive] = useState(editing?.active ?? true);
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(
        editing ? `/api/subscriptions/${editing.id}` : "/api/subscriptions",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            amount: Number(amount),
            currency: currency.toUpperCase(),
            cycle,
            cardId,
            nextCharge,
            category,
            active,
            notes,
          }),
        }
      );
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
    <form onSubmit={submit} className="space-y-3 border-t border-zinc-800 p-4">
      <div>
        <label className={label} htmlFor="sub-name">
          Name
        </label>
        <input
          id="sub-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Netflix, Spotify, iCloud…"
          className={field}
          required
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={label} htmlFor="sub-amount">
            Cost
          </label>
          <input
            id="sub-amount"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className={field}
            required
          />
        </div>
        <div>
          <label className={label} htmlFor="sub-currency">
            Currency
          </label>
          <input
            id="sub-currency"
            list="sub-currency-options"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
            maxLength={3}
            className={`${field} uppercase`}
            required
          />
          <datalist id="sub-currency-options">
            {ENTRY_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </datalist>
        </div>
        <div>
          <label className={label} htmlFor="sub-cycle">
            Billed
          </label>
          <select
            id="sub-cycle"
            value={cycle}
            onChange={(e) => setCycle(e.target.value as typeof cycle)}
            className={field}
          >
            {BILLING_CYCLE_ORDER.map((c) => (
              <option key={c} value={c}>
                {BILLING_CYCLE_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="sub-card">
            Charged to
          </label>
          <select
            id="sub-card"
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
            className={field}
          >
            <option value="">Not linked</option>
            {cards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="sub-next">
            Next charge <span className="text-zinc-600">(optional)</span>
          </label>
          <input
            id="sub-next"
            type="date"
            value={nextCharge}
            onChange={(e) => setNextCharge(e.target.value)}
            className={field}
          />
        </div>
      </div>

      {cards.length === 0 && (
        <p className="text-[11px] leading-relaxed text-zinc-600">
          No credit cards to link to yet. Add one under Net worth → Debts and it
          will appear here.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="sub-category">
            Category <span className="text-zinc-600">(optional)</span>
          </label>
          <input
            id="sub-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Streaming, software…"
            className={field}
          />
        </div>
        <div>
          <label className={label} htmlFor="sub-notes">
            Notes <span className="text-zinc-600">(optional)</span>
          </label>
          <input
            id="sub-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={field}
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 accent-emerald-500"
        />
        Currently active
        <span className="text-zinc-600">— uncheck to keep it on file without counting it</span>
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
          {saving ? "Saving…" : editing ? "Save changes" : "Add subscription"}
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
