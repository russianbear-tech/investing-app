import {
  CardBill,
  CashflowSummary,
  CategoryTotal,
  CYCLES_PER_YEAR,
  Database,
  EXPENSE_CATEGORY_LABELS,
  ExpenseEntry,
  INCOME_CATEGORY_LABELS,
  IncomeEntry,
  MonthSummary,
  SubscriptionsSummary,
  ValuedSubscription,
} from "./types";
import { buildFxTable } from "./fx";
import { convertLocked, monthLabel, todayLocalISO } from "./format";

// Re-exported so server code can reach it from here alongside the rest of the
// cash-flow helpers; it lives in ./format because client components need it too.
export { todayLocalISO };

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Whole days from `from` to `to`, both ISO dates. Negative means `to` is past. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * The next time `dueDay` comes around, from `today` onwards.
 *
 * A card due on the 31st still has to be paid in February, so the day is
 * clamped to the length of whichever month it lands in.
 */
export function nextDueDate(dueDay: number, today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const thisMonth = Math.min(dueDay, daysInMonth(y, m));
  if (d <= thisMonth) return iso(y, m, thisMonth);

  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return iso(ny, nm, Math.min(dueDay, daysInMonth(ny, nm)));
}

/** Every month from `first` to `last` inclusive, so gaps show as zero rather than closing up. */
function monthRange(first: string, last: string): string[] {
  const out: string[] = [];
  let [y, m] = first.split("-").map(Number);
  const [ly, lm] = last.split("-").map(Number);
  if (!y || !m || !ly || !lm) return out;

  // Guard against a nonsense date in the file spinning this forever.
  while ((y < ly || (y === ly && m <= lm)) && out.length < 600) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function totalsByCategory(
  rows: { category: string; value: number }[],
  labels: Record<string, string>
): CategoryTotal[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    const cur = map.get(r.category) ?? { total: 0, count: 0 };
    cur.total += r.value;
    cur.count += 1;
    map.set(r.category, cur);
  }
  const grand = [...map.values()].reduce((s, v) => s + v.total, 0);
  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      label: labels[key] ?? key,
      total: v.total,
      count: v.count,
      percent: grand > 0 ? (v.total / grand) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Income against spending, month by month.
 *
 * No exchange rates are fetched for the entries themselves — every one of them
 * carries the conversion that was locked when it was recorded. Rates are only
 * needed for card balances, which are current figures rather than history.
 */
export async function computeCashflow(db: Database): Promise<CashflowSummary> {
  const master = db.settings.masterCurrency;
  const errors: string[] = [];
  const today = todayLocalISO();

  const income = [...db.income].sort((a, b) => b.date.localeCompare(a.date));
  const expenses = [...db.expenses].sort((a, b) => b.date.localeCompare(a.date));

  const valueOf = (e: IncomeEntry | ExpenseEntry) => convertLocked(e.locked, master);

  const unconvertedCount = [...income, ...expenses].filter(
    (e) => e.locked.rateSource === "unavailable"
  ).length;
  if (unconvertedCount > 0) {
    errors.push(
      `${unconvertedCount} ${unconvertedCount === 1 ? "entry has" : "entries have"} no exchange rate, so ${unconvertedCount === 1 ? "its" : "their"} amount is shown as typed rather than converted. Edit and re-save once a rate is available.`
    );
  }

  // Month buckets.
  const bucket = new Map<string, { income: number; expenses: number; ic: number; ec: number }>();
  const touch = (month: string) => {
    const existing = bucket.get(month);
    if (existing) return existing;
    const fresh = { income: 0, expenses: 0, ic: 0, ec: 0 };
    bucket.set(month, fresh);
    return fresh;
  };

  for (const e of income) {
    const b = touch(e.date.slice(0, 7));
    b.income += valueOf(e);
    b.ic += 1;
  }
  for (const e of expenses) {
    const b = touch(e.date.slice(0, 7));
    b.expenses += valueOf(e);
    b.ec += 1;
  }

  const currentMonth = today.slice(0, 7);
  const keys = [...bucket.keys()].sort();
  const first = keys[0] ?? currentMonth;
  // Always run through to the current month so the month you're in is present
  // even before anything has been recorded in it.
  const last = keys.length > 0 && keys[keys.length - 1] > currentMonth
    ? keys[keys.length - 1]
    : currentMonth;

  let runIncome = 0;
  let runExpenses = 0;
  const months: MonthSummary[] = monthRange(first, last).map((month) => {
    const b = bucket.get(month) ?? { income: 0, expenses: 0, ic: 0, ec: 0 };
    runIncome += b.income;
    runExpenses += b.expenses;
    return {
      month,
      label: monthLabel(month),
      income: b.income,
      expenses: b.expenses,
      net: b.income - b.expenses,
      cumulativeIncome: runIncome,
      cumulativeExpenses: runExpenses,
      cumulativeNet: runIncome - runExpenses,
      incomeCount: b.ic,
      expenseCount: b.ec,
    };
  });

  // Averages over months that actually saw activity — including empty months
  // would drag a average down for no reason other than the range being long.
  const active = months.filter((m) => m.incomeCount > 0 || m.expenseCount > 0);
  const activeCount = active.length || 1;

  // Card balances are current, so today's rate is the right one here.
  const cards = db.liabilities.filter((l) => l.kind === "credit_card");
  const fx = await buildFxTable(
    cards.map((c) => c.currency),
    master
  );
  const missing = fx.missing(cards.map((c) => c.currency));
  if (missing.length > 0) {
    errors.push(
      `Could not fetch an exchange rate for ${missing.join(", ")} — those card balances are shown unconverted.`
    );
  }

  const cardBills: CardBill[] = cards
    .map((c) => {
      const nextDue = c.dueDay ? nextDueDate(c.dueDay, today) : undefined;
      return {
        id: c.id,
        name: c.name,
        currency: c.currency,
        balance: c.balance,
        balanceConverted: fx.convert(c.balance, c.currency),
        statementBalance: c.statementBalance,
        minimumDue: c.minimumDue,
        creditLimit: c.creditLimit,
        interestRate: c.interestRate,
        autopay: c.autopay,
        dueDay: c.dueDay,
        nextDue,
        daysUntilDue: nextDue ? daysBetween(today, nextDue) : undefined,
        utilization:
          c.creditLimit && c.creditLimit > 0
            ? (c.balance / c.creditLimit) * 100
            : undefined,
        notes: c.notes,
      };
    })
    // Soonest due first; cards with no due date sit at the end.
    .sort((a, b) => (a.daysUntilDue ?? 9999) - (b.daysUntilDue ?? 9999));

  const totalIncome = runIncome;
  const totalExpenses = runExpenses;

  return {
    masterCurrency: master,
    months,
    current: months.find((m) => m.month === currentMonth) ?? null,
    totalIncome,
    totalExpenses,
    totalNet: totalIncome - totalExpenses,
    averageIncome: totalIncome / activeCount,
    averageExpenses: totalExpenses / activeCount,
    incomeByCategory: totalsByCategory(
      income.map((e) => ({ category: e.category, value: valueOf(e) })),
      INCOME_CATEGORY_LABELS
    ),
    expensesByCategory: totalsByCategory(
      expenses.map((e) => ({ category: e.category, value: valueOf(e) })),
      EXPENSE_CATEGORY_LABELS
    ),
    cards: cardBills,
    income,
    expenses,
    unconvertedCount,
    errors,
    asOf: new Date().toISOString(),
  };
}

/**
 * What's running and what it costs.
 *
 * Unlike income and expenses these are converted at today's rate, not a locked
 * one: a subscription is a standing future cost, so what matters is what it
 * would cost you now — there is no past payment here whose value is settled.
 */
export async function computeSubscriptions(
  db: Database
): Promise<SubscriptionsSummary> {
  const master = db.settings.masterCurrency;
  const errors: string[] = [];
  const today = todayLocalISO();

  const fx = await buildFxTable(
    db.subscriptions.map((s) => s.currency),
    master
  );
  const missing = fx.missing(db.subscriptions.map((s) => s.currency));
  if (missing.length > 0) {
    errors.push(
      `Could not fetch an exchange rate for ${missing.join(", ")} — those costs are shown unconverted.`
    );
  }

  const cardNames = new Map(db.liabilities.map((l) => [l.id, l.name]));

  const subscriptions: ValuedSubscription[] = db.subscriptions
    .map((s) => {
      const yearly = fx.convert(s.amount * CYCLES_PER_YEAR[s.cycle], s.currency);
      return {
        ...s,
        monthlyConverted: yearly / 12,
        yearlyConverted: yearly,
        cardName: s.cardId ? cardNames.get(s.cardId) : undefined,
        daysUntilCharge: s.nextCharge ? daysBetween(today, s.nextCharge) : undefined,
        rateMissing: !fx.has(s.currency),
      };
    })
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      return b.monthlyConverted - a.monthlyConverted;
    });

  const activeSubs = subscriptions.filter((s) => s.active);

  const byCardMap = new Map<string, { name: string; total: number; count: number }>();
  for (const s of activeSubs) {
    const key = s.cardId ?? "__none__";
    const name = s.cardName ?? "Not linked to a card";
    const cur = byCardMap.get(key) ?? { name, total: 0, count: 0 };
    cur.total += s.monthlyConverted;
    cur.count += 1;
    byCardMap.set(key, cur);
  }

  return {
    masterCurrency: master,
    subscriptions,
    monthlyTotal: activeSubs.reduce((s, x) => s + x.monthlyConverted, 0),
    yearlyTotal: activeSubs.reduce((s, x) => s + x.yearlyConverted, 0),
    activeCount: activeSubs.length,
    inactiveCount: subscriptions.length - activeSubs.length,
    byCard: [...byCardMap.entries()]
      .map(([cardId, v]) => ({
        cardId: cardId === "__none__" ? null : cardId,
        name: v.name,
        total: v.total,
        count: v.count,
      }))
      .sort((a, b) => b.total - a.total),
    errors,
    asOf: new Date().toISOString(),
  };
}
