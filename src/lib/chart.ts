/**
 * Drawing helpers shared by the charts. Pure functions, no React and no
 * server-only imports, so either side can use them.
 */

import { formatMoney } from "./format";

/** Ticks on round numbers (1/2/5 × 10ⁿ) rather than raw data bounds. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const first = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let t = first; t <= max + step * 0.01; t += step) ticks.push(t);
  return ticks;
}

/** Axis-sized money: "1.2M", "34k", "$18.40". */
export function compactMoney(v: number, currency: string): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(v / 1000)}k`;
  return formatMoney(v, currency, { compact: true }).replace(/\.00$/, "");
}

/** Axis date label, dropping the day once the span is too wide for it to fit. */
export function shortDate(iso: string, span: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-CA", {
    month: "short",
    ...(span <= 120 ? { day: "numeric" } : {}),
    timeZone: "UTC",
  });
}

/**
 * Axis label for a point in time, chosen by how much time the chart covers.
 * Under two days it wants a clock; over a couple of years the day is noise.
 */
export function axisTimeLabel(ms: number, spanDays: number): string {
  const d = new Date(ms);
  if (spanDays <= 2) {
    return d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
  }
  if (spanDays <= 10) {
    return d.toLocaleDateString("en-CA", { weekday: "short" });
  }
  if (spanDays <= 400) {
    return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-CA", { month: "short", year: "2-digit" });
}

/** Full label for the hover readout. */
export function pointLabel(ms: number, spanDays: number): string {
  const d = new Date(ms);
  if (spanDays <= 2) {
    return d.toLocaleString("en-CA", {
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    });
  }
  return d.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
