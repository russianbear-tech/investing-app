"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { X, Search, Loader2, Check, Wand2, Pencil } from "lucide-react";
import {
  ACCOUNT_LABELS,
  ACCOUNT_ORDER,
  AccountType,
  ASSET_KIND_LABELS,
  AssetKind,
  Currency,
  Holding,
} from "@/lib/types";
import { formatMoney } from "@/lib/format";
import FundCodeHint, { looksLikeFundCode } from "@/components/FundCodeHint";

interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange?: string;
}

const PLATFORM_SUGGESTIONS = [
  "Wealthsimple",
  "Questrade",
  "TD Direct Investing",
  "RBC Direct Investing",
  "BMO InvestorLine",
  "Scotia iTRADE",
  "CIBC Investor's Edge",
  "Interactive Brokers",
  "Robinhood",
  "Fidelity",
  "Charles Schwab",
  "Vanguard",
  "Coinbase",
  "Kraken",
  "Physical / Vault",
  "Bank account",
];

// Cash lives on the Net worth tab, not here — mixing a non-appreciating balance
// into the portfolio would drag the investment return down and misstate it.
const KIND_ORDER: AssetKind[] = ["stock", "etf", "gold", "crypto"];

/** Handy tickers people won't guess — gold especially. */
const QUICK_PICKS: Partial<Record<AssetKind, { symbol: string; label: string }[]>> = {
  gold: [
    { symbol: "GC=F", label: "Gold spot (per oz, USD)" },
    { symbol: "SI=F", label: "Silver spot (per oz, USD)" },
    { symbol: "GLD", label: "SPDR Gold ETF" },
    { symbol: "CL=F", label: "Crude oil" },
  ],
  crypto: [
    { symbol: "BTC-USD", label: "Bitcoin" },
    { symbol: "ETH-USD", label: "Ethereum" },
  ],
};

export default function AddHoldingModal({
  open,
  onClose,
  onSaved,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: Holding | null;
}) {
  const [kind, setKind] = useState<AssetKind>("stock");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const [quantity, setQuantity] = useState("");
  const [costPerUnit, setCostPerUnit] = useState("");
  /** Enter the first purchase as a dollar amount, like later contributions. */
  const [entryMode, setEntryMode] = useState<"amount" | "manual">("amount");
  const [amountInput, setAmountInput] = useState("");
  const [pricePreview, setPricePreview] = useState<{
    price: number;
    currency: string;
    date: string;
  } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentValue, setCurrentValue] = useState("");
  const [purchaseCurrency, setPurchaseCurrency] = useState<Currency>("CAD");
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [platform, setPlatform] = useState("");
  const [account, setAccount] = useState<AccountType | "">("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCash = kind === "cash";
  // With several purchases recorded, the single price/date fields below would
  // only describe the first one — contributions are edited in their own panel.
  const multiLot = (editing?.lots?.length ?? 0) > 1;
  // Editing an existing purchase means changing known figures, so the
  // amount-based shortcut only applies when adding something new.
  const canUseAmount = !isCash && Boolean(symbol) && !editing;
  const useAmount = canUseAmount && entryMode === "amount";

  // Load the record being edited, or reset to a blank form.
  useEffect(() => {
    if (!open) return;
    if (editing) {
      const lots = editing.lots ?? [];
      const first = lots[0];
      const totalUnits = lots.reduce((s, l) => s + l.quantity, 0);
      setKind(editing.kind);
      setSymbol(editing.symbol);
      setName(editing.name);
      setQuery(editing.symbol ? `${editing.symbol} — ${editing.name}` : editing.name);
      setQuantity(first ? String(first.quantity) : "");
      setCostPerUnit(first ? String(first.costPerUnit) : "");
      setCurrentValue(
        editing.manualPrice !== undefined && totalUnits > 0
          ? String(editing.manualPrice * totalUnits)
          : ""
      );
      setPurchaseCurrency(editing.purchaseCurrency);
      setPurchaseDate(
        first ? first.date.slice(0, 10) : new Date().toISOString().slice(0, 10)
      );
      setPlatform(editing.platform);
      setAccount(editing.account ?? "");
      setNotes(editing.notes ?? "");
    } else {
      setKind("stock");
      setSymbol("");
      setName("");
      setQuery("");
      setQuantity("");
      setCostPerUnit("");
      setCurrentValue("");
      setPurchaseCurrency("CAD");
      setPurchaseDate(new Date().toISOString().slice(0, 10));
      setPlatform("");
      setAccount("");
      setNotes("");
    }
    setError(null);
    setResults([]);
    setShowResults(false);
  }, [open, editing]);

  // Debounced ticker lookup.
  useEffect(() => {
    if (isCash || !query.trim() || query.includes(" — ")) {
      setResults([]);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, isCash]);

  const pick = (r: { symbol: string; name: string }) => {
    setSymbol(r.symbol);
    setName(r.name);
    setQuery(`${r.symbol} — ${r.name}`);
    setShowResults(false);
    setResults([]);
  };

  // Look up what one unit cost on the chosen date, so the unit count can be
  // previewed before saving.
  useEffect(() => {
    if (!open || !useAmount || !purchaseDate) {
      setPricePreview(null);
      return;
    }
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      setPreviewing(true);
      setPreviewError(null);
      try {
        const res = await fetch(
          `/api/price-on?symbol=${encodeURIComponent(symbol)}&date=${purchaseDate}&currency=${purchaseCurrency}`
        );
        const data = await res.json();
        if (!res.ok) {
          setPricePreview(null);
          setPreviewError(data.error ?? "No price for that date.");
        } else {
          setPricePreview(data);
        }
      } catch {
        setPricePreview(null);
      } finally {
        setPreviewing(false);
      }
    }, 350);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [open, useAmount, symbol, purchaseDate, purchaseCurrency]);

  const amountNum = Number(amountInput);
  const estimatedUnits =
    pricePreview && Number.isFinite(amountNum) && amountNum > 0
      ? amountNum / pricePreview.price
      : null;

  const estimatedCost = useMemo(() => {
    const q = Number(quantity);
    const c = Number(costPerUnit);
    if (!Number.isFinite(q) || !Number.isFinite(c) || q <= 0) return null;
    return q * c;
  }, [quantity, costPerUnit]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const qtyNum = Number(quantity);
    if (useAmount) {
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        setError("Enter how much you put in.");
        return;
      }
    } else if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setError(isCash ? "Enter the amount." : "Enter how many units you own.");
      return;
    }

    // Cash and GICs have no per-unit price: treat the deposit as the quantity
    // at a cost of 1, and derive a unit price from the current value.
    const payload: Record<string, unknown> = {
      kind,
      symbol: isCash ? "" : symbol.trim().toUpperCase(),
      name: isCash ? name.trim() || "Cash" : name.trim() || symbol.trim().toUpperCase(),
      platform: platform.trim(),
      account: account || undefined,
      // In amount mode the server derives units from that day's price.
      quantity: useAmount ? undefined : qtyNum,
      costPerUnit: useAmount ? undefined : isCash ? 1 : Number(costPerUnit),
      amount: useAmount ? amountNum : undefined,
      purchaseCurrency,
      purchaseDate,
      notes: notes.trim(),
      manualPrice: isCash
        ? currentValue.trim()
          ? Number(currentValue) / qtyNum
          : 1
        : undefined,
    };

    if (!isCash && !payload.symbol) {
      setError("Pick a ticker symbol from the search results.");
      return;
    }
    if (
      !isCash &&
      !useAmount &&
      (!Number.isFinite(Number(costPerUnit)) || Number(costPerUnit) < 0)
    ) {
      setError("Enter what you paid per unit.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        editing ? `/api/holdings/${editing.id}` : "/api/holdings",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const label = "mb-1.5 block text-xs font-medium text-zinc-400";
  const input =
    "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-emerald-600";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-zinc-800 bg-zinc-950 sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-100">
            {editing ? "Edit holding" : "Add a holding"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-300"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 px-5 py-5">
          <div>
            <span className={label}>What kind of investment?</span>
            <div className="flex flex-wrap gap-1.5">
              {KIND_ORDER.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                    kind === k
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  {ASSET_KIND_LABELS[k]}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-600">
              Bank balances and GICs go on the{" "}
              <Link
                href="/networth"
                className="text-zinc-400 underline underline-offset-2 hover:text-zinc-200"
              >
                Net worth
              </Link>{" "}
              tab instead.
            </p>
          </div>

          {isCash ? (
            <div>
              <label className={label} htmlFor="cash-name">
                What is it?
              </label>
              <input
                id="cash-name"
                className={input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. EQ Bank savings, 2-year GIC"
              />
            </div>
          ) : (
            <div className="relative">
              <label className={label} htmlFor="ticker">
                Search for it
              </label>
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
                />
                <input
                  id="ticker"
                  className={`${input} pl-9`}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSymbol("");
                  }}
                  onFocus={() => results.length > 0 && setShowResults(true)}
                  placeholder="Company name or ticker — e.g. Apple, TD.TO, VFV.TO"
                  autoComplete="off"
                />
                {searching && (
                  <Loader2
                    size={15}
                    className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-zinc-600"
                  />
                )}
                {symbol && !searching && (
                  <Check
                    size={15}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500"
                  />
                )}
              </div>

              {showResults && results.length > 0 && (
                <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
                  {results.map((r) => (
                    <li key={`${r.symbol}-${r.exchange ?? ""}`}>
                      <button
                        type="button"
                        onClick={() => pick(r)}
                        className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-zinc-800"
                      >
                        <span className="min-w-0">
                          <span className="text-sm font-medium text-zinc-100">
                            {r.symbol}
                          </span>
                          <span className="ml-2 truncate text-xs text-zinc-500">
                            {r.name}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] uppercase tracking-wide text-zinc-600">
                          {r.exchange ?? r.type}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {!searching &&
                results.length === 0 &&
                !symbol &&
                looksLikeFundCode(query) && <FundCodeHint query={query} />}

              {QUICK_PICKS[kind] && !symbol && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {QUICK_PICKS[kind]!.map((p) => (
                    <button
                      key={p.symbol}
                      type="button"
                      onClick={() => pick({ symbol: p.symbol, name: p.label })}
                      className="rounded-md bg-zinc-900 px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {multiLot ? (
            <div className="space-y-3">
              <p className="rounded-lg border border-sky-900/50 bg-sky-950/30 px-3 py-2.5 text-xs leading-relaxed text-sky-200/80">
                This holding is built from {editing?.lots.length} separate
                purchases. Add or remove them in the contributions list on the
                portfolio page — changing the figures here would only affect the
                first one.
              </p>
              <div>
                <label className={label} htmlFor="cur">
                  Currency you paid in
                </label>
                <select
                  id="cur"
                  className={input}
                  value={purchaseCurrency}
                  onChange={(e) => setPurchaseCurrency(e.target.value as Currency)}
                >
                  <option value="CAD">CAD</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
          ) : (
            <>
              {canUseAmount && (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEntryMode("amount")}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                      entryMode === "amount"
                        ? "bg-sky-600 text-white"
                        : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    }`}
                  >
                    <Wand2 size={12} /> I know the amount
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryMode("manual")}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                      entryMode === "manual"
                        ? "bg-zinc-700 text-white"
                        : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    }`}
                  >
                    <Pencil size={12} /> I know the units
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label} htmlFor="qty">
                    {useAmount
                      ? `How much you put in (${purchaseCurrency})`
                      : isCash
                        ? "Amount deposited"
                        : "How many units"}
                  </label>
                  <input
                    id="qty"
                    className={input}
                    value={useAmount ? amountInput : quantity}
                    onChange={(e) =>
                      useAmount
                        ? setAmountInput(e.target.value)
                        : setQuantity(e.target.value)
                    }
                    inputMode="decimal"
                    placeholder={useAmount ? "500" : isCash ? "5000" : "10"}
                  />
                </div>
                <div>
                  <label className={label} htmlFor="cur">
                    Currency you paid in
                  </label>
                  <select
                    id="cur"
                    className={input}
                    value={purchaseCurrency}
                    onChange={(e) => setPurchaseCurrency(e.target.value as Currency)}
                  >
                    <option value="CAD">CAD</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>

              {isCash ? (
                <div>
                  <label className={label} htmlFor="cv">
                    Current value{" "}
                    <span className="text-zinc-600">— leave blank if unchanged</span>
                  </label>
                  <input
                    id="cv"
                    className={input}
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    inputMode="decimal"
                    placeholder="For a GIC that's grown"
                  />
                </div>
              ) : useAmount ? null : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={label} htmlFor="cost">
                      Price paid per unit
                    </label>
                    <input
                      id="cost"
                      className={input}
                      value={costPerUnit}
                      onChange={(e) => setCostPerUnit(e.target.value)}
                      inputMode="decimal"
                      placeholder="185.40"
                    />
                  </div>
                  <div className="flex items-end pb-2">
                    {estimatedCost !== null && (
                      <p className="text-xs text-zinc-500">
                        Total cost{" "}
                        <span className="tnum text-zinc-300">
                          {formatMoney(estimatedCost, purchaseCurrency)}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className={label} htmlFor="date">
                  {isCash ? "Date opened" : "Date bought"}
                </label>
                <input
                  id="date"
                  type="date"
                  className={input}
                  value={purchaseDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>

              {useAmount && (
                <div className="rounded-lg bg-zinc-900/70 px-3 py-2.5 text-xs">
                  {previewing ? (
                    <span className="flex items-center gap-1.5 text-zinc-500">
                      <Loader2 size={12} className="animate-spin" />
                      Looking up the price on {purchaseDate}…
                    </span>
                  ) : previewError ? (
                    <span className="text-amber-300/80">
                      {previewError} Switch to &ldquo;I know the units&rdquo;.
                    </span>
                  ) : pricePreview && estimatedUnits ? (
                    <span className="tnum text-zinc-400">
                      That bought{" "}
                      <span className="text-emerald-400">
                        {estimatedUnits.toFixed(4)} units
                      </span>{" "}
                      at {formatMoney(pricePreview.price, pricePreview.currency)} on{" "}
                      {pricePreview.date}.
                    </span>
                  ) : pricePreview ? (
                    <span className="tnum text-zinc-500">
                      Price on {pricePreview.date} was{" "}
                      {formatMoney(pricePreview.price, pricePreview.currency)}.
                    </span>
                  ) : (
                    <span className="text-zinc-600">
                      Pick the date and the price will be looked up.
                    </span>
                  )}
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="plat">
                Which platform
              </label>
              <input
                id="plat"
                className={input}
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                list="platforms"
                placeholder="Wealthsimple"
              />
              <datalist id="platforms">
                {PLATFORM_SUGGESTIONS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <span className={label}>
              Account type <span className="text-zinc-600">— optional</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {ACCOUNT_ORDER.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAccount(account === a ? "" : a)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                    account === a
                      ? "bg-sky-600 text-white"
                      : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  {ACCOUNT_LABELS[a]}
                </button>
              ))}
            </div>
          </div>

          {purchaseCurrency !== "USD" && !isCash && (
            <p className="rounded-lg bg-zinc-900/60 px-3 py-2 text-xs leading-relaxed text-zinc-500">
              You paid in {purchaseCurrency}. Your cost will be converted using the
              exchange rate from the day you bought — not today&apos;s — so the gain
              stays accurate.
            </p>
          )}

          <div>
            <label className={label} htmlFor="notes">
              Notes <span className="text-zinc-600">— optional</span>
            </label>
            <input
              id="notes"
              className={input}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why you bought it"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-rose-900/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              {editing ? "Save changes" : "Add holding"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-900"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
