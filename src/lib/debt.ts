import { DebtProjection, Liability } from "./types";
import { todayLocalISO } from "./format";

/** Simulated repayment stops here — past this, "never" is the honest answer. */
const MAX_MONTHS = 600;

/**
 * Interest accrued on `balance` over `days`, simple daily accrual.
 *
 * Deliberately simple rather than trying to match a lender's compounding: this
 * is used to split a payment when the statement wasn't to hand, and it's shown
 * flagged as an estimate. Pretending to more precision than we have would be
 * the mistake here, not the rounding.
 */
export function accruedInterest(
  balance: number,
  annualRatePercent: number,
  days: number
): number {
  if (balance <= 0 || annualRatePercent <= 0 || days <= 0) return 0;
  return balance * (annualRatePercent / 100) * (days / 365);
}

/** Whole days between two ISO dates, never negative. */
function daysSince(from: string, to: string): number {
  const a = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/**
 * The date interest should be counted from for a payment made on `paymentDate`
 * — the last payment, or failing that when the debt started.
 */
export function interestAccrualStart(
  liability: Liability,
  paymentDate: string
): string | null {
  const earlier = liability.payments
    .filter((p) => p.date <= paymentDate)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (earlier.length > 0) return earlier[earlier.length - 1].date;
  if (liability.startDate) return liability.startDate;
  return null;
}

function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = (y * 12 + (m - 1)) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const nd = Math.min(d, lastDay);
  return `${ny}-${String(nm).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

/**
 * How long this debt takes to clear, and what it costs to get there.
 *
 * Returns null when there's nothing to go on — no scheduled payment and no
 * payment history means any date would be invented.
 */
export function projectPayoff(liability: Liability): DebtProjection | null {
  const balance = liability.balance;
  if (balance <= 0) return null;

  const rate = liability.interestRate ?? 0;
  const monthlyRate = rate / 100 / 12;
  const monthlyInterest = balance * monthlyRate;

  let monthlyPayment: number;
  let basis: DebtProjection["basis"];

  if (liability.regularPayment && liability.regularPayment > 0) {
    monthlyPayment = liability.regularPayment;
    basis = "scheduled";
  } else {
    // Fall back to what they've actually been paying — the last three
    // payments, which tracks reality better than the whole history when
    // someone has recently changed what they pay.
    const recent = [...liability.payments]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3);
    if (recent.length === 0) return null;
    monthlyPayment = recent.reduce((s, p) => s + p.amount, 0) / recent.length;
    basis = "recent-average";
  }

  if (monthlyPayment <= 0) return null;

  // A payment that doesn't cover the interest never clears the debt — the
  // balance grows every month. Say so rather than running to the cap.
  if (rate > 0 && monthlyPayment <= monthlyInterest) {
    return {
      basis,
      monthlyPayment,
      monthsRemaining: null,
      payoffDate: null,
      interestRemaining: null,
      neverPaysOff: true,
      monthlyInterest,
    };
  }

  let remaining = balance;
  let interestRemaining = 0;
  let months = 0;

  while (remaining > 0 && months < MAX_MONTHS) {
    const interest = remaining * monthlyRate;
    interestRemaining += interest;
    remaining = remaining + interest - monthlyPayment;
    months += 1;
  }

  if (remaining > 0) {
    return {
      basis,
      monthlyPayment,
      monthsRemaining: null,
      payoffDate: null,
      interestRemaining: null,
      neverPaysOff: true,
      monthlyInterest,
    };
  }

  return {
    basis,
    monthlyPayment,
    monthsRemaining: months,
    payoffDate: addMonths(todayLocalISO(), months),
    interestRemaining,
    neverPaysOff: false,
    monthlyInterest,
  };
}

/**
 * The repayment picture for one debt: how far along it is, what's been paid,
 * what it costs to carry, and when it clears.
 */
export function describeDebt(liability: Liability) {
  const { balance, interestRate } = liability;

  // Without an explicit original amount, the biggest figure ever recorded is
  // the best available stand-in — but only if it's actually bigger than what's
  // left, otherwise "paid off" would read as zero or negative for a debt
  // that's only ever been entered once.
  const recordedPeak = Math.max(
    ...liability.history.map((h) => h.balance),
    ...liability.payments.map((p) => p.balanceBefore),
    balance
  );
  const explicit = liability.originalAmount;
  const startingBalance =
    explicit && explicit > 0 ? explicit : recordedPeak > balance ? recordedPeak : null;

  const paidOff = startingBalance !== null ? startingBalance - balance : null;
  const paidOffPercent =
    startingBalance !== null && startingBalance > 0
      ? Math.min(100, Math.max(0, (paidOff! / startingBalance) * 100))
      : null;

  const totalPaid = liability.payments.reduce((s, p) => s + p.amount, 0);
  const totalInterestPaid = liability.payments.reduce(
    (s, p) => s + p.interestPortion,
    0
  );

  const hasRate = interestRate !== undefined && interestRate > 0;
  const yearlyInterest = hasRate ? balance * (interestRate! / 100) : null;

  return {
    startingBalance,
    paidOff,
    paidOffPercent,
    totalPaid,
    totalInterestPaid,
    totalPrincipalPaid: totalPaid - totalInterestPaid,
    dailyInterest: yearlyInterest !== null ? yearlyInterest / 365 : null,
    monthlyInterest: yearlyInterest !== null ? yearlyInterest / 12 : null,
    yearlyInterest,
    projection: projectPayoff(liability),
  };
}

/**
 * Works out how a payment splits, from whatever the user actually knows.
 *
 * Three ways in, in descending order of trustworthiness:
 *  1. They gave the balance from the statement — the split is then arithmetic,
 *     not estimation.
 *  2. They gave the interest portion from the statement.
 *  3. Neither, so it's derived from the rate and flagged as an estimate.
 */
export function splitPayment(
  liability: Liability,
  input: { amount: number; date: string; balanceAfter?: number; interestPortion?: number }
): {
  interestPortion: number;
  principalPortion: number;
  balanceAfter: number;
  interestEstimated: boolean;
} {
  const before = liability.balance;
  const { amount } = input;

  if (input.balanceAfter !== undefined) {
    const after = Math.max(0, input.balanceAfter);
    const principal = before - after;
    return {
      interestPortion: Math.max(0, amount - principal),
      principalPortion: principal,
      balanceAfter: after,
      interestEstimated: false,
    };
  }

  if (input.interestPortion !== undefined) {
    const interest = Math.max(0, Math.min(input.interestPortion, amount));
    const principal = amount - interest;
    return {
      interestPortion: interest,
      principalPortion: principal,
      balanceAfter: Math.max(0, before - principal),
      interestEstimated: false,
    };
  }

  const rate = liability.interestRate ?? 0;
  const from = interestAccrualStart(liability, input.date);
  const interest =
    rate > 0 && from ? accruedInterest(before, rate, daysSince(from, input.date)) : 0;

  // Interest larger than the payment means the balance grew. That's real, and
  // capping it would hide the fact that the debt is going backwards.
  const principal = amount - interest;
  return {
    interestPortion: interest,
    principalPortion: principal,
    balanceAfter: Math.max(0, before - principal),
    interestEstimated: interest > 0,
  };
}
