import { isCurrencyCode } from "./types";
import { todayLocalISO } from "./cashflow";

export interface MoneyInput {
  amount: number;
  currency: string;
  date: string;
}

/**
 * Validates the parts every income and expense entry shares.
 *
 * Future dates are refused on purpose: the whole point of these records is
 * that they carry the exchange rate from the day the money moved, and there
 * is no rate yet for a day that hasn't happened.
 */
export function parseMoneyInput(body: Record<string, unknown>): {
  data?: MoneyInput;
  error?: string;
} {
  const amount = Number(body.amount);
  if (!Number.isFinite(amount)) return { error: "Enter the amount as a number." };
  if (amount <= 0) return { error: "Enter an amount greater than zero." };

  const currency = String(body.currency ?? "").trim().toUpperCase();
  if (!isCurrencyCode(currency)) {
    return { error: "Currency must be a three-letter code, like CAD, USD or RUB." };
  }

  const date = String(body.date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
    return { error: "Enter the date as YYYY-MM-DD." };
  }
  if (date > todayLocalISO()) {
    return {
      error:
        "That date is in the future. Record it once the money has actually moved — the exchange rate for a future day doesn't exist yet.",
    };
  }

  return { data: { amount, currency, date } };
}

/** Picks `value` when it's one of `allowed`, otherwise `fallback`. */
export function pickOption<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  const v = String(value ?? "").toLowerCase();
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** An optional ISO date field — undefined when blank or malformed. */
export function parseDate(value: unknown): string | undefined {
  const d = String(value ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) ? d : undefined;
}

/** Reads an optional non-negative number field, returning undefined when blank. */
export function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || String(value).trim() === "") {
    return undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}
