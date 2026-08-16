"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Currency } from "@/lib/types";

export interface BalanceRecord {
  id: string;
  name: string;
  kind: string;
  currency: Currency;
  balance: number;
  institution?: string;
  notes?: string;
  // Debt-only. Optional throughout: a student loan during study has no rate,
  // and someone may not know what they originally borrowed.
  interestRate?: number;
  originalAmount?: number;
  startDate?: string;
  regularPayment?: number;
}

/**
 * Shared add/edit form for cash accounts and debts — the two differ only in
 * their wording and the set of categories they offer.
 */
export default function BalanceForm({
  mode,
  kinds,
  editing,
  endpoint,
  onDone,
  onCancel,
  showInstitution,
}: {
  mode: "cash" | "debt";
  kinds: { value: string; label: string }[];
  editing: BalanceRecord | null;
  endpoint: string;
  onDone: () => void;
  onCancel: () => void;
  showInstitution?: boolean;
}) {
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [kind, setKind] = useState(kinds[0].value);
  const [currency, setCurrency] = useState<Currency>("CAD");
  const [balance, setBalance] = useState("");
  const [notes, setNotes] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [originalAmount, setOriginalAmount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [regularPayment, setRegularPayment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const num = (v: number | undefined) => (v === undefined ? "" : String(v));

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setInstitution(editing.institution ?? "");
      setKind(editing.kind);
      setCurrency(editing.currency);
      setBalance(String(editing.balance));
      setNotes(editing.notes ?? "");
      setInterestRate(num(editing.interestRate));
      setOriginalAmount(num(editing.originalAmount));
      setStartDate(editing.startDate ?? "");
      setRegularPayment(num(editing.regularPayment));
    } else {
      setName("");
      setInstitution("");
      setKind(kinds[0].value);
      setCurrency("CAD");
      setBalance("");
      setNotes("");
      setInterestRate("");
      setOriginalAmount("");
      setStartDate("");
      setRegularPayment("");
    }
    setError(null);
  }, [editing, kinds]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amount = Number(balance);
    if (!Number.isFinite(amount) || amount < 0) {
      setError(
        mode === "cash"
          ? "Enter the balance as a positive number."
          : "Enter what you still owe as a positive number."
      );
      return;
    }
    if (!name.trim()) {
      setError(mode === "cash" ? "Give the account a name." : "Give the debt a name.");
      return;
    }
    if (mode === "debt" && interestRate.trim() !== "") {
      const r = Number(interestRate);
      if (!Number.isFinite(r) || r < 0 || r > 100) {
        setError("Interest rate should be a percentage between 0 and 100.");
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch(editing ? `${endpoint}/${editing.id}` : endpoint, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          institution: showInstitution ? institution.trim() : undefined,
          kind,
          currency,
          balance: amount,
          notes: notes.trim(),
          // Sent as "" when cleared, which the API reads as "unset".
          ...(mode === "debt"
            ? {
                interestRate: interestRate.trim(),
                originalAmount: originalAmount.trim(),
                startDate: startDate.trim(),
                regularPayment: regularPayment.trim(),
              }
            : {}),
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

  const label = "mb-1 block text-[10px] text-zinc-500";
  const input =
    "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-600";

  return (
    <form
      onSubmit={submit}
      className="fade-up space-y-2.5 border-t border-zinc-800 px-4 py-3"
    >
      <div className={showInstitution ? "grid grid-cols-2 gap-2" : ""}>
        <div>
          <label className={label}>
            {mode === "cash" ? "Account name" : "What is it?"}
          </label>
          <input
            className={input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={mode === "cash" ? "Everyday chequing" : "OSAP student loan"}
            autoFocus
          />
        </div>
        {showInstitution && (
          <div>
            <label className={label}>Bank</label>
            <input
              className={input}
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="TD"
            />
          </div>
        )}
      </div>

      <div>
        <label className={label}>Type</label>
        <div className="flex flex-wrap gap-1.5">
          {kinds.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => setKind(k.value)}
              className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                kind === k.value
                  ? "bg-zinc-700 text-white"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={label}>
            {mode === "cash" ? "Balance" : "Amount still owed"}
          </label>
          <input
            className={input}
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            inputMode="decimal"
            placeholder={mode === "cash" ? "2500" : "18400"}
          />
        </div>
        <div>
          <label className={label}>Currency</label>
          <select
            className={input}
            value={currency}
            onChange={(e) => setCurrency(e.target.value as Currency)}
          >
            <option value="CAD">CAD</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      {mode === "debt" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={label}>Interest rate % — optional</label>
              <input
                className={input}
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                inputMode="decimal"
                placeholder="4.79"
              />
            </div>
            <div>
              <label className={label}>Monthly payment — optional</label>
              <input
                className={input}
                value={regularPayment}
                onChange={(e) => setRegularPayment(e.target.value)}
                inputMode="decimal"
                placeholder="1850"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={label}>Originally borrowed — optional</label>
              <input
                className={input}
                value={originalAmount}
                onChange={(e) => setOriginalAmount(e.target.value)}
                inputMode="decimal"
                placeholder="420000"
              />
            </div>
            <div>
              <label className={label}>Started on — optional</label>
              <input
                className={input}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
          </div>

          <p className="text-[10px] leading-relaxed text-zinc-600">
            Leave the rate blank if nothing accrues — Canadian student loans
            generally don&apos;t while you&apos;re enrolled full time. The
            original amount is what turns the detail view into a progress bar,
            and the monthly payment is what lets it work out a payoff date.
          </p>
        </>
      )}

      <div>
        <label className={label}>Notes — optional</label>
        <input
          className={input}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={
            mode === "cash" ? "Emergency fund" : "Interest-free while studying"
          }
        />
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving && <Loader2 size={12} className="animate-spin" />}
          {editing ? "Save changes" : "Add"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
