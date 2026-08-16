/**
 * Pure formatting helpers — no server-only imports, so these are safe to use
 * from client components.
 */

import type { Currency, LockedAmount } from "./types";

/**
 * Reads a locked amount back in the requested master currency.
 *
 * Note there is no conversion here — both figures were worked out and frozen
 * when the money was recorded. Switching the display currency picks a
 * different stored number; it never re-derives one from today's rate.
 */
export function convertLocked(locked: LockedAmount, master: Currency): number {
  return master === "CAD" ? locked.inCAD : locked.inUSD;
}

/**
 * Today in the machine's own timezone.
 *
 * `new Date().toISOString()` gives the UTC date, which is already tomorrow for
 * a Canadian user any evening after 8pm — enough to make a bill due today read
 * as overdue, or to reject today's date as being in the future.
 */
export function todayLocalISO(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

/** "2026-08-14" -> "2026-08" */
export function monthKey(date: string): string {
  return date.slice(0, 7);
}

/** "2026-08" -> "August 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "2026-08-14" -> "14 Aug" */
export function formatDayMonth(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-CA", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** 1 -> "1st", 22 -> "22nd" — for "due the 15th". */
export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** "in 3 days", "today", "5 days ago" — for bill due dates. */
export function formatDueIn(days: number): string {
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  if (days < 0) return `${Math.abs(days)} day${days === -1 ? "" : "s"} overdue`;
  return `in ${days} days`;
}

export function formatMoney(
  amount: number,
  currency: string,
  opts: { compact?: boolean } = {}
): string {
  if (!Number.isFinite(amount)) return "—";
  const abs = Math.abs(amount);
  const compact = Boolean(opts.compact) && abs >= 100_000;
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: currency.toUpperCase(),
      currencyDisplay: "narrowSymbol",
      notation: compact ? "compact" : "standard",
      minimumFractionDigits: compact ? 0 : 2,
      maximumFractionDigits: compact ? 1 : 2,
    }).format(amount);
  } catch {
    // Unknown currency code — fall back to a plain number with the code.
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export function formatSignedMoney(amount: number, currency: string): string {
  const sign = amount > 0 ? "+" : "";
  return `${sign}${formatMoney(amount, currency)}`;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-CA", { maximumFractionDigits: 6 }).format(value);
}

/** "3 days ago", "2 months ago" — for watchlist age. */
export function formatAge(days: number): string {
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 12) return months === 1 ? "1 month ago" : `${months} months ago`;
  const years = Math.round(days / 365);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

/** Tailwind text colour for a gain/loss number. */
export function toneClass(value: number): string {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-rose-400";
  return "text-zinc-400";
}
