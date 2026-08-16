"use client";

import { useEffect, useState } from "react";
import { Lock, AlertTriangle, Loader2 } from "lucide-react";
import {
  Currency,
  ENTRY_CURRENCIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_ORDER,
  ExpenseEntry,
  INCOME_CATEGORY_LABELS,
  INCOME_CATEGORY_ORDER,
  IncomeEntry,
  LockedAmount,
} from "@/lib/types";
import { convertLocked, formatMoney, todayLocalISO } from "@/lib/format";

type Entry = IncomeEntry | ExpenseEntry;

interface Props {
  mode: "income" | "expense";
  editing: Entry | null;
  /**
   * Pre-fills a *new* entry from an existing one — the "repeat" shortcut for a
   * bill that's the same every month. The date still starts at today, because
   * the point of repeating is that this is a fresh payment needing its own rate.
   */
  template?: Entry | null;
  master: Currency;
  onDone: () => void;
  onCancel: () => void;
}

const field =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none";
const label = "mb-1 block text-[11px] font-medium text-zinc-500";

function entryName(entry: Entry | null, mode: "income" | "expense"): string {
  if (!entry) return "";
  return mode === "income" ? (entry as IncomeEntry).source : (entry as ExpenseEntry).name;
}

export default function MoneyEntryForm({
  mode,
  editing,
  template = null,
  master,
  onDone,
  onCancel,
}: Props) {
  const isIncome = mode === "income";
  const seed = editing ?? template;

  const [name, setName] = useState(entryName(seed, mode));
  const [category, setCategory] = useState(
    seed?.category ?? (isIncome ? "salary" : "other")
  );
  const [amount, setAmount] = useState(seed ? String(seed.locked.amount) : "");
  const [currency, setCurrency] = useState(seed?.locked.currency ?? master);
  const [date, setDate] = useState(editing?.date ?? todayLocalISO());
  const [notes, setNotes] = useState(seed?.notes ?? "");

  const [preview, setPreview] = useState<LockedAmount | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = isIncome ? INCOME_CATEGORY_ORDER : EXPENSE_CATEGORY_ORDER;
  const categoryLabels = isIncome ? INCOME_CATEGORY_LABELS : EXPENSE_CATEGORY_LABELS;

  // Show what the entry will lock at before it's saved. Debounced so typing an
  // amount doesn't fire a rate lookup per keystroke.
  useEffect(() => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || currency.length !== 3 || !date) {
      setPreview(null);
      return;
    }

    let cancelled = false;
    setPreviewing(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          amount: String(value),
          currency: currency.toUpperCase(),
          date,
        });
        const res = await fetch(`/api/fx?${params}`, { cache: "no-store" });
        const data = await res.json();
        if (!cancelled) setPreview(res.ok ? data.locked : null);
      } catch {
        if (!cancelled) setPreview(null);
      } finally {
        if (!cancelled) setPreviewing(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [amount, currency, date]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      [isIncome ? "source" : "name"]: name,
      category,
      amount: Number(amount),
      currency: currency.toUpperCase(),
      date,
      notes,
    };

    try {
      const base = isIncome ? "/api/income" : "/api/expenses";
      const res = await fetch(editing ? `${base}/${editing.id}` : base, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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

  const foreign = currency.toUpperCase() !== master;
  const unavailable = preview?.rateSource === "unavailable";

  return (
    <form onSubmit={submit} className="space-y-3 border-t border-zinc-800 p-4">
      <div>
        <label className={label} htmlFor="entry-name">
          {isIncome ? "Where it came from" : "What it was for"}
        </label>
        <input
          id="entry-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isIncome ? "Employer, client…" : "Rent, groceries…"}
          className={field}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="entry-amount">
            Amount
          </label>
          <input
            id="entry-amount"
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
          <label className={label} htmlFor="entry-currency">
            Currency
          </label>
          <input
            id="entry-currency"
            list="entry-currency-options"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))}
            maxLength={3}
            className={`${field} uppercase`}
            required
          />
          <datalist id="entry-currency-options">
            {ENTRY_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </datalist>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="entry-date">
            {isIncome ? "Date received" : "Date paid"}
          </label>
          <input
            id="entry-date"
            type="date"
            value={date}
            max={todayLocalISO()}
            onChange={(e) => setDate(e.target.value)}
            className={field}
            required
          />
        </div>
        <div>
          <label className={label} htmlFor="entry-category">
            Category
          </label>
          <select
            id="entry-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className={field}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {categoryLabels[c as keyof typeof categoryLabels]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* The locking rule, made visible. */}
      {foreign && (
        <div
          className={`rounded-lg border p-3 text-[11px] leading-relaxed ${
            unavailable
              ? "border-amber-900/50 bg-amber-950/20 text-amber-200/80"
              : "border-zinc-800 bg-zinc-950/60 text-zinc-400"
          }`}
        >
          {previewing && (
            <span className="flex items-center gap-2 text-zinc-500">
              <Loader2 size={12} className="animate-spin" />
              Looking up the rate for {date}…
            </span>
          )}

          {!previewing && preview && !unavailable && (
            <>
              <span className="flex items-center gap-1.5 text-zinc-300">
                <Lock size={11} className="shrink-0" />
                Locks in as{" "}
                <strong className="tnum font-medium text-zinc-100">
                  {formatMoney(convertLocked(preview, master), master)}
                </strong>
              </span>
              <p className="mt-1.5 text-zinc-500">
                Rate on {preview.rateDate}: 1 {preview.currency} ={" "}
                {(master === "CAD" ? preview.rateCAD : preview.rateUSD).toPrecision(6)}{" "}
                {master}. Saved with the entry and never recalculated — if the{" "}
                {preview.currency} moves tomorrow, this figure stays put.
              </p>
            </>
          )}

          {!previewing && unavailable && (
            <span className="flex gap-2">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              No exchange rate could be found for {currency.toUpperCase()} on {date}.
              You can still save, but the amount will be recorded unconverted and
              flagged until you edit and re-save it.
            </span>
          )}

          {!previewing && !preview && !unavailable && (
            <span className="text-zinc-500">
              Enter an amount to see what it locks in at.
            </span>
          )}
        </div>
      )}

      <div>
        <label className={label} htmlFor="entry-notes">
          Notes <span className="text-zinc-600">(optional)</span>
        </label>
        <input
          id="entry-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={field}
        />
      </div>

      {editing && foreign && (
        <p className="text-[11px] leading-relaxed text-zinc-600">
          Changing the amount, currency or date takes a fresh rate for the new
          date. Editing only the name, category or notes leaves the original
          locked figure untouched.
        </p>
      )}

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
          {saving ? "Saving…" : editing ? "Save changes" : `Add ${mode}`}
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
