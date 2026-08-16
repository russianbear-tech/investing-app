"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Loader2, Wand2, Pencil, X } from "lucide-react";
import { ValuedHolding } from "@/lib/types";
import { formatMoney, formatQuantity } from "@/lib/format";

interface Preview {
  price: number;
  currency: string;
  nativePrice: number;
  nativeCurrency: string;
  converted: boolean;
  date: string;
}

export default function ContributionsPanel({
  holding,
  masterCurrency,
  onChanged,
}: {
  holding: ValuedHolding;
  masterCurrency: string;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<"amount" | "manual">("amount");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [units, setUnits] = useState("");
  const [price, setPrice] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCash = holding.kind === "cash";
  const canAutoPrice = !isCash && Boolean(holding.symbol);

  // Look up the price on the chosen date so the unit count can be shown before
  // anything is saved.
  useEffect(() => {
    if (!adding || mode !== "amount" || !canAutoPrice || !date) {
      setPreview(null);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setPreviewing(true);
      setPreviewError(null);
      try {
        const res = await fetch(
          `/api/price-on?symbol=${encodeURIComponent(holding.symbol)}&date=${date}&currency=${holding.purchaseCurrency}`
        );
        const data = await res.json();
        if (!res.ok) {
          setPreview(null);
          setPreviewError(data.error ?? "No price for that date.");
        } else {
          setPreview(data as Preview);
        }
      } catch {
        setPreview(null);
      } finally {
        setPreviewing(false);
      }
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [adding, mode, date, holding.symbol, holding.purchaseCurrency, canAutoPrice]);

  const amountNum = Number(amount);
  const estimatedUnits =
    preview && Number.isFinite(amountNum) && amountNum > 0
      ? amountNum / preview.price
      : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const body =
      mode === "amount"
        ? { date, amount: amountNum }
        : { date, quantity: Number(units), costPerUnit: Number(price) };

    try {
      const res = await fetch(`/api/holdings/${holding.id}/lots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add that.");
      setAmount("");
      setUnits("");
      setPrice("");
      setAdding(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that.");
    } finally {
      setSaving(false);
    }
  }

  async function removeLot(lotId: string) {
    if (!confirm("Remove this contribution?")) return;
    const res = await fetch(`/api/holdings/${holding.id}/lots/${lotId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not remove it.");
      return;
    }
    onChanged();
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-600";

  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-medium text-zinc-300">
          {isCash ? "Deposits" : "Purchases"}{" "}
          <span className="text-zinc-600">({holding.lots.length})</span>
        </h4>
        <button
          onClick={() => setAdding((a) => !a)}
          className="flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          {adding ? <X size={11} /> : <Plus size={11} />}
          {adding ? "Cancel" : isCash ? "Add deposit" : "Add contribution"}
        </button>
      </div>

      <ul className="space-y-1">
        {holding.lotsValued.map((lot) => (
          <li
            key={lot.id}
            className="flex items-center gap-2 rounded-md bg-zinc-950/50 px-2.5 py-1.5 text-xs"
          >
            <span className="tnum w-20 shrink-0 text-zinc-500">{lot.date}</span>
            <span className="tnum min-w-0 flex-1 text-zinc-300">
              {isCash ? (
                formatMoney(lot.quantity, holding.purchaseCurrency)
              ) : (
                <>
                  {formatQuantity(Number(lot.quantity.toFixed(4)))} @{" "}
                  {formatMoney(lot.costPerUnit, holding.purchaseCurrency)}
                </>
              )}
              {lot.autoPriced && (
                <Wand2
                  size={10}
                  className="ml-1.5 inline text-sky-400"
                  aria-label="Units worked out from that day's price"
                />
              )}
            </span>
            <span className="tnum shrink-0 text-zinc-400">
              {formatMoney(lot.costBasis, masterCurrency)}
            </span>
            {holding.lots.length > 1 && (
              <button
                onClick={() => removeLot(lot.id)}
                className="shrink-0 rounded p-1 text-zinc-700 transition-colors hover:bg-rose-950/40 hover:text-rose-400"
                aria-label="Remove contribution"
              >
                <Trash2 size={11} />
              </button>
            )}
          </li>
        ))}
      </ul>

      {holding.lots.length > 1 && (
        <p className="tnum mt-2 border-t border-zinc-800 pt-2 text-[11px] text-zinc-500">
          {formatQuantity(Number(holding.quantity.toFixed(4)))} units total ·
          average {formatMoney(holding.averageCostPerUnit, holding.purchaseCurrency)}
          /unit · {formatMoney(holding.costBasis, masterCurrency)} invested
        </p>
      )}

      {adding && (
        <form onSubmit={submit} className="fade-up mt-3 space-y-2 border-t border-zinc-800 pt-3">
          {canAutoPrice && (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setMode("amount")}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors ${
                  mode === "amount"
                    ? "bg-sky-600 text-white"
                    : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Wand2 size={10} /> By amount
              </button>
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors ${
                  mode === "manual"
                    ? "bg-zinc-700 text-white"
                    : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Pencil size={10} /> Exact units
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] text-zinc-500">Date</label>
              <input
                type="date"
                className={inputCls}
                value={date}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            {mode === "amount" ? (
              <div>
                <label className="mb-1 block text-[10px] text-zinc-500">
                  Amount ({holding.purchaseCurrency})
                </label>
                <input
                  className={inputCls}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="500"
                />
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-[10px] text-zinc-500">Units</label>
                <input
                  className={inputCls}
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  inputMode="decimal"
                  placeholder="12.07"
                />
              </div>
            )}
          </div>

          {mode === "manual" && (
            <div>
              <label className="mb-1 block text-[10px] text-zinc-500">
                Price per unit ({holding.purchaseCurrency})
              </label>
              <input
                className={inputCls}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder="41.41"
              />
            </div>
          )}

          {mode === "amount" && canAutoPrice && (
            <div className="rounded-md bg-zinc-950/60 px-2.5 py-2 text-[11px]">
              {previewing ? (
                <span className="flex items-center gap-1.5 text-zinc-500">
                  <Loader2 size={10} className="animate-spin" />
                  Looking up the price on {date}…
                </span>
              ) : previewError ? (
                <span className="text-amber-300/80">
                  {previewError} Try “Exact units” instead.
                </span>
              ) : preview && estimatedUnits ? (
                <span className="tnum text-zinc-400">
                  Buys{" "}
                  <span className="text-emerald-400">
                    {formatQuantity(Number(estimatedUnits.toFixed(4)))} units
                  </span>{" "}
                  at {formatMoney(preview.price, preview.currency)} on {preview.date}
                  {preview.converted && (
                    <span className="text-zinc-600">
                      {" "}
                      (converted from {formatMoney(preview.nativePrice, preview.nativeCurrency)})
                    </span>
                  )}
                </span>
              ) : preview ? (
                <span className="tnum text-zinc-500">
                  Price on {preview.date} was{" "}
                  {formatMoney(preview.price, preview.currency)} — enter an amount.
                </span>
              ) : (
                <span className="text-zinc-600">Pick a date to look up the price.</span>
              )}
            </div>
          )}

          {error && <p className="text-[11px] text-rose-400">{error}</p>}

          <button
            type="submit"
            disabled={
              saving ||
              (mode === "amount" ? !(amountNum > 0) : !(Number(units) > 0))
            }
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
          >
            {saving && <Loader2 size={11} className="animate-spin" />}
            Add
          </button>
        </form>
      )}
    </div>
  );
}
