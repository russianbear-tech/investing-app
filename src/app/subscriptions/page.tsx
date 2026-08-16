"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  AlertTriangle,
  Repeat,
  CreditCard,
  Pause,
  Play,
} from "lucide-react";
import SubscriptionForm from "@/components/SubscriptionForm";
import {
  BILLING_CYCLE_LABELS,
  Subscription,
  SubscriptionsSummary,
  ValuedSubscription,
} from "@/lib/types";
import { formatDayMonth, formatDueIn, formatMoney } from "@/lib/format";

const C_SUB = "#8b7ae8";

const card = "rounded-xl border border-zinc-800 bg-zinc-900/40";
const iconButton =
  "rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300";

export default function SubscriptionsPage() {
  const [summary, setSummary] = useState<SubscriptionsSummary | null>(null);
  const [cards, setCards] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [subsRes, debtsRes] = await Promise.all([
        fetch("/api/subscriptions", { cache: "no-store" }),
        fetch("/api/liabilities", { cache: "no-store" }),
      ]);
      const subsData = await subsRes.json();
      if (!subsRes.ok) throw new Error(subsData.error ?? "Could not load.");
      setSummary(subsData.summary);

      if (debtsRes.ok) {
        const debtsData = await debtsRes.json();
        setCards(
          (debtsData.liabilities ?? [])
            .filter((l: { kind: string }) => l.kind === "credit_card")
            .map((l: { id: string; name: string }) => ({ id: l.id, name: l.name }))
        );
      }
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

  async function remove(id: string, name: string) {
    if (!confirm(`Remove "${name}"?`)) return;
    await fetch(`/api/subscriptions/${id}`, { method: "DELETE" });
    load(true);
  }

  async function toggleActive(sub: ValuedSubscription) {
    await fetch(`/api/subscriptions/${sub.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !sub.active }),
    });
    load(true);
  }

  function close() {
    setShowForm(false);
    setEditing(null);
  }

  if (loading) {
    return (
      <div className="space-y-3 pt-2">
        <div className="h-32 animate-pulse rounded-xl bg-zinc-900" />
        <div className="h-40 animate-pulse rounded-xl bg-zinc-900" />
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
  const active = summary.subscriptions.filter((s) => s.active);
  const paused = summary.subscriptions.filter((s) => !s.active);
  const peak = Math.max(...active.map((s) => s.monthlyConverted), 1);

  return (
    <div className="space-y-4">
      <section className={`${card} p-5`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-zinc-500">Running every month</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              {formatMoney(summary.monthlyTotal, cur)}
            </p>
            <p className="mt-1.5 text-xs text-zinc-500">
              {formatMoney(summary.yearlyTotal, cur)} a year ·{" "}
              {summary.activeCount} active
              {summary.inactiveCount > 0 && ` · ${summary.inactiveCount} paused`}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => load(true)}
              className="rounded-lg border border-zinc-700 p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
              aria-label="Refresh"
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            </button>
            <button
              onClick={() => {
                setEditing(null);
                setShowForm((f) => !f);
              }}
              className="flex items-center gap-1 rounded-lg border border-zinc-700 px-2.5 py-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
            >
              <Plus size={13} /> Add
            </button>
          </div>
        </div>

        {summary.byCard.length > 0 && (
          <div className="mt-5 space-y-2 border-t border-zinc-800 pt-4">
            <p className="text-[11px] text-zinc-500">Charged to</p>
            {summary.byCard.map((c) => (
              <div
                key={c.cardId ?? "none"}
                className="flex items-center gap-3 text-xs"
              >
                <CreditCard size={12} className="shrink-0 text-zinc-600" />
                <span className="min-w-0 flex-1 truncate text-zinc-400">{c.name}</span>
                <span className="text-zinc-600">
                  {c.count} {c.count === 1 ? "sub" : "subs"}
                </span>
                <span className="tnum w-20 text-right text-zinc-200">
                  {formatMoney(c.total, cur)}
                </span>
              </div>
            ))}
          </div>
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

      {showForm && (
        <section className={card}>
          <div className="px-4 py-3">
            <h2 className="text-sm font-medium text-zinc-200">
              {editing ? "Edit subscription" : "New subscription"}
            </h2>
          </div>
          <SubscriptionForm
            editing={editing}
            cards={cards}
            master={cur}
            onDone={() => {
              close();
              load(true);
            }}
            onCancel={close}
          />
        </section>
      )}

      {summary.subscriptions.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed border-zinc-800 px-6 py-10 text-center">
          <Repeat size={26} className="mx-auto text-zinc-700" />
          <p className="mt-3 text-sm font-medium text-zinc-300">
            No subscriptions tracked
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-zinc-500">
            Add the things that bill you automatically — streaming, software,
            storage. This tab is here to show you what&apos;s running and what it
            adds up to.
          </p>
        </div>
      )}

      {active.length > 0 && (
        <section className={card}>
          <div className="px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-medium text-zinc-200">
              <Repeat size={15} style={{ color: C_SUB }} />
              Active
              <span className="tnum text-xs text-zinc-500">
                {formatMoney(summary.monthlyTotal, cur)}/mo
              </span>
            </h2>
          </div>
          <ul className="border-t border-zinc-800">
            {active.map((s) => (
              <SubRow
                key={s.id}
                sub={s}
                currency={cur}
                peak={peak}
                onEdit={() => {
                  setEditing(s);
                  setShowForm(true);
                }}
                onToggle={() => toggleActive(s)}
                onRemove={() => remove(s.id, s.name)}
              />
            ))}
          </ul>
        </section>
      )}

      {paused.length > 0 && (
        <section className={card}>
          <div className="px-4 py-3">
            <h2 className="text-sm font-medium text-zinc-400">
              Paused
              <span className="ml-2 text-xs text-zinc-600">
                not counted in the totals
              </span>
            </h2>
          </div>
          <ul className="border-t border-zinc-800">
            {paused.map((s) => (
              <SubRow
                key={s.id}
                sub={s}
                currency={cur}
                peak={peak}
                onEdit={() => {
                  setEditing(s);
                  setShowForm(true);
                }}
                onToggle={() => toggleActive(s)}
                onRemove={() => remove(s.id, s.name)}
              />
            ))}
          </ul>
        </section>
      )}

      <p className="text-[11px] leading-relaxed text-zinc-600">
        These are deliberately kept out of your spending totals on the{" "}
        <Link href="/cashflow" className="text-zinc-400 underline underline-offset-2">
          Income &amp; bills
        </Link>{" "}
        tab. A subscription is charged to a card, and paying that card off is
        already recorded as an expense — counting the subscription too would
        charge you for it twice. Costs here are converted at today&apos;s rate,
        because a subscription is a standing future cost rather than a payment
        already made.
      </p>
    </div>
  );
}

interface RowProps {
  sub: ValuedSubscription;
  currency: "USD" | "CAD";
  peak: number;
  onEdit: () => void;
  onToggle: () => void;
  onRemove: () => void;
}

function SubRow({ sub, currency, peak, onEdit, onToggle, onRemove }: RowProps) {
  const foreign = sub.currency !== currency;

  return (
    <li className="border-b border-zinc-800/60 px-4 py-2.5 last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm ${sub.active ? "text-zinc-100" : "text-zinc-500"}`}>
            {sub.name}
          </p>
          <p className="truncate text-[11px] text-zinc-500">
            {formatMoney(sub.amount, sub.currency)} ·{" "}
            {BILLING_CYCLE_LABELS[sub.cycle].toLowerCase()}
            {sub.cardName && ` · ${sub.cardName}`}
            {sub.category && ` · ${sub.category}`}
            {sub.nextCharge && (
              <>
                {" · next "}
                {formatDayMonth(sub.nextCharge)}
                {sub.daysUntilCharge !== undefined &&
                  sub.daysUntilCharge >= 0 &&
                  sub.daysUntilCharge <= 7 && (
                    <span className="text-amber-400">
                      {" "}
                      ({formatDueIn(sub.daysUntilCharge)})
                    </span>
                  )}
              </>
            )}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p
            className={`tnum text-sm ${sub.active ? "text-zinc-100" : "text-zinc-500"}`}
          >
            {formatMoney(sub.monthlyConverted, currency)}
          </p>
          <p className="text-[11px] text-zinc-600">
            {sub.cycle === "monthly" ? "per month" : "per month equiv."}
            {foreign && sub.rateMissing && (
              <span className="text-amber-400"> · no rate</span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 gap-1">
          <button
            onClick={onToggle}
            className={iconButton}
            aria-label={sub.active ? `Pause ${sub.name}` : `Resume ${sub.name}`}
          >
            {sub.active ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <button onClick={onEdit} className={iconButton} aria-label={`Edit ${sub.name}`}>
            <Pencil size={12} />
          </button>
          <button
            onClick={onRemove}
            className="rounded-md p-1.5 text-zinc-700 transition-colors hover:bg-rose-950/40 hover:text-rose-400"
            aria-label={`Remove ${sub.name}`}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Relative weight, so the expensive ones stand out at a glance. */}
      {sub.active && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.max((sub.monthlyConverted / peak) * 100, 2)}%`,
              background: C_SUB,
            }}
          />
        </div>
      )}
    </li>
  );
}
