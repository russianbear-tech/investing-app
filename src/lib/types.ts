/**
 * The currencies the whole app can be *displayed* in. Deliberately narrow:
 * every stored figure carries a conversion into each of these, so adding one
 * means backfilling that conversion everywhere.
 */
export type Currency = "USD" | "CAD";

export const SUPPORTED_CURRENCIES: Currency[] = ["USD", "CAD"];

/**
 * Currencies money can arrive or be spent *in*. Unlike `Currency` this is open
 * — any ISO-4217 code Yahoo quotes a rate for is accepted — so getting paid in
 * roubles doesn't require a code change. The list below is only what the
 * dropdown offers first.
 */
export const ENTRY_CURRENCIES: { code: string; name: string }[] = [
  { code: "CAD", name: "Canadian dollar" },
  { code: "USD", name: "US dollar" },
  { code: "RUB", name: "Russian rouble" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British pound" },
  { code: "AUD", name: "Australian dollar" },
  { code: "CHF", name: "Swiss franc" },
  { code: "JPY", name: "Japanese yen" },
  { code: "CNY", name: "Chinese yuan" },
  { code: "INR", name: "Indian rupee" },
  { code: "KZT", name: "Kazakhstani tenge" },
  { code: "UAH", name: "Ukrainian hryvnia" },
  { code: "TRY", name: "Turkish lira" },
  { code: "AED", name: "UAE dirham" },
  { code: "MXN", name: "Mexican peso" },
  { code: "BRL", name: "Brazilian real" },
  { code: "PHP", name: "Philippine peso" },
  { code: "PLN", name: "Polish zloty" },
  { code: "SEK", name: "Swedish krona" },
  { code: "NOK", name: "Norwegian krone" },
];

export function isCurrencyCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value.trim().toUpperCase());
}

/**
 * `cash` covers savings balances and GICs — they have no ticker, so their value
 * comes from what you type in rather than from a live quote.
 */
export type AssetKind = "stock" | "etf" | "gold" | "crypto" | "cash";

export const ASSET_KIND_LABELS: Record<AssetKind, string> = {
  stock: "Stock",
  etf: "ETF / Fund",
  gold: "Gold / Commodity",
  crypto: "Crypto",
  cash: "Cash / GIC",
};

/** Canadian registered accounts, plus escape hatches. */
export type AccountType =
  | "tfsa"
  | "rrsp"
  | "fhsa"
  | "resp"
  | "rrif"
  | "nonreg"
  | "other";

export const ACCOUNT_LABELS: Record<AccountType, string> = {
  tfsa: "TFSA",
  rrsp: "RRSP",
  fhsa: "FHSA",
  resp: "RESP",
  rrif: "RRIF",
  nonreg: "Non-registered",
  other: "Other",
};

export const ACCOUNT_ORDER: AccountType[] = [
  "tfsa",
  "rrsp",
  "fhsa",
  "resp",
  "rrif",
  "nonreg",
  "other",
];

/** Accounts with a yearly government contribution limit worth tracking. */
export const CONTRIBUTION_LIMITED: AccountType[] = ["tfsa", "rrsp", "fhsa", "resp"];

/**
 * A single purchase. A holding is a list of these, so buying the same fund
 * every month stays one row in the portfolio instead of twelve.
 */
export interface Lot {
  id: string;
  /** ISO date of this purchase. */
  date: string;
  quantity: number;
  /** Price per unit, in the holding's `purchaseCurrency`. */
  costPerUnit: number;
  /**
   * The dollar figure actually contributed, when entered that way (a $500
   * monthly deposit). Kept so the UI can show what you put in rather than
   * a derived unit count.
   */
  amount?: number;
  /** True when `quantity` was computed from a looked-up historical price. */
  autoPriced?: boolean;
  createdAt: string;
}

export interface Holding {
  id: string;
  /** Yahoo ticker, e.g. AAPL, TD.TO, GC=F, 0P0000714D.TO. Empty for cash. */
  symbol: string;
  name: string;
  kind: AssetKind;
  /** Which brokerage or app this sits in. */
  platform: string;
  /** Which registered account it's held inside. */
  account?: AccountType;
  /** The currency every lot's `costPerUnit` is expressed in. */
  purchaseCurrency: Currency;
  /** Every purchase making up this position, oldest first. */
  lots: Lot[];
  /**
   * Price per unit for things with no ticker (cash, GICs), in
   * `purchaseCurrency`. Ignored when a live quote is available.
   */
  manualPrice?: number;
  notes?: string;
  createdAt: string;
}

/** Pre-lots shape, still found in files written by earlier versions. */
export interface LegacyHolding extends Omit<Holding, "lots"> {
  lots?: Lot[];
  quantity?: number;
  costPerUnit?: number;
  purchaseDate?: string;
}

export interface WatchItem {
  id: string;
  symbol: string;
  name: string;
  addedAt: string;
  /** Price when you added it, in the asset's own currency. */
  priceAtAdd: number;
  currencyAtAdd: string;
  notes?: string;
}

export type CashKind = "chequing" | "savings" | "tfsa_cash" | "gic" | "other";

export const CASH_KIND_LABELS: Record<CashKind, string> = {
  chequing: "Chequing",
  savings: "Savings",
  tfsa_cash: "TFSA cash",
  gic: "GIC",
  other: "Other",
};

export const CASH_KIND_ORDER: CashKind[] = [
  "chequing",
  "savings",
  "tfsa_cash",
  "gic",
  "other",
];

export type LiabilityKind =
  | "student_loan"
  | "credit_card"
  | "line_of_credit"
  | "car_loan"
  | "mortgage"
  | "other";

export const LIABILITY_KIND_LABELS: Record<LiabilityKind, string> = {
  student_loan: "Student loan",
  credit_card: "Credit card",
  line_of_credit: "Line of credit",
  car_loan: "Car loan",
  mortgage: "Mortgage",
  other: "Other",
};

export const LIABILITY_KIND_ORDER: LiabilityKind[] = [
  "student_loan",
  "credit_card",
  "line_of_credit",
  "car_loan",
  "mortgage",
  "other",
];

/** A balance as it stood on a date — lets the app show progress over time. */
export interface BalanceSnapshot {
  date: string;
  balance: number;
}

/**
 * Money sitting in a bank account. Deliberately kept out of the portfolio:
 * cash never appreciates, so folding it into investment return would drag the
 * percentage down and misrepresent how the actual investments are doing.
 */
export interface CashAccount {
  id: string;
  name: string;
  institution?: string;
  kind: CashKind;
  currency: Currency;
  balance: number;
  notes?: string;
  history: BalanceSnapshot[];
  updatedAt: string;
  createdAt: string;
}

/**
 * One payment made against a debt.
 *
 * `balanceBefore` and `balanceAfter` are both stored rather than derived. A
 * payment's effect has to survive later edits to the debt, and keeping both
 * ends means deleting the most recent payment can put the balance back exactly
 * where it was instead of guessing.
 */
export interface DebtPayment {
  id: string;
  date: string;
  /** Total handed over, in the debt's currency. */
  amount: number;
  /**
   * How much of `amount` went to interest instead of reducing the balance.
   * Zero for a debt that doesn't accrue interest.
   */
  interestPortion: number;
  /** The rest of `amount` — what actually came off the balance. */
  principalPortion: number;
  /**
   * True when `interestPortion` was worked out by the app from the rate rather
   * than taken from a statement. Shown in the UI so an estimate never passes
   * for a fact.
   */
  interestEstimated: boolean;
  balanceBefore: number;
  balanceAfter: number;
  notes?: string;
  createdAt: string;
}

export interface Liability {
  id: string;
  name: string;
  kind: LiabilityKind;
  currency: Currency;
  /** What's still owed. Positive number; it's subtracted from net worth. */
  balance: number;
  /**
   * Annual interest rate as a percentage. Left unset for student loans during
   * study, when nothing accrues — set it once repayment starts.
   */
  interestRate?: number;
  notes?: string;
  history: BalanceSnapshot[];
  updatedAt: string;
  createdAt: string;

  // ---- Billing details, used by credit cards on the Income & bills tab ----
  // These live here rather than on a separate card record so a card is entered
  // once: the same balance that counts against net worth is the one whose bill
  // comes due.

  /** Day of the month the payment is due, 1–31. Clamped to short months. */
  dueDay?: number;
  /**
   * What this statement asks for. Distinct from `balance`: the balance is
   * everything owed right now, including charges made after the statement
   * closed, while this is the figure that has to be paid by `dueDay`.
   */
  statementBalance?: number;
  /** The smallest payment that avoids a late fee. */
  minimumDue?: number;
  /** Total credit available, used to show utilisation. */
  creditLimit?: number;
  /** True when the card is paid automatically — no action needed at due date. */
  autopay?: boolean;

  // ---- Repayment tracking, used by the debt detail view ----

  /**
   * What was originally borrowed. Without it "35% paid off" has nothing to be
   * a percentage of, since `balance` only ever says what's left today.
   */
  originalAmount?: number;
  /** When the debt started, ISO date. */
  startDate?: string;
  /** The scheduled payment, used to project a payoff date. */
  regularPayment?: number;
  /** Every payment recorded against this debt, oldest first. */
  payments: DebtPayment[];
}

/**
 * A sum of money, recorded in the currency it actually moved in, together with
 * the conversions worked out at the moment it was recorded.
 *
 * The conversions are *stored*, never recomputed. Once you have been paid,
 * what that payment was worth is a settled fact; deriving it from today's rate
 * would silently rewrite your income history every time the currency moved —
 * a month you earned ₽80,000 would be worth a different amount every time you
 * opened the app. Both master currencies are locked so switching the display
 * toggle reads back the same settled figures rather than re-converting.
 */
export interface LockedAmount {
  /** The figure as entered, in `currency`. */
  amount: number;
  currency: string;
  /** `amount` in USD, frozen at `lockedAt`. */
  inUSD: number;
  /** `amount` in CAD, frozen at `lockedAt`. */
  inCAD: number;
  /** What one unit of `currency` was worth in USD / CAD on `rateDate`. */
  rateUSD: number;
  rateCAD: number;
  /** The date whose rate was used — the day the money actually moved. */
  rateDate: string;
  /** When the lock was taken, so an old record is self-explanatory. */
  lockedAt: string;
  /**
   * How the rate was obtained. `unavailable` means no rate could be found and
   * `inUSD`/`inCAD` are the raw amount — the UI flags those loudly rather than
   * passing an unconverted number off as converted.
   */
  rateSource: "same-currency" | "historical" | "live" | "manual" | "unavailable";
}

export type IncomeCategory =
  | "salary"
  | "freelance"
  | "business"
  | "investment"
  | "gift"
  | "refund"
  | "other";

export const INCOME_CATEGORY_LABELS: Record<IncomeCategory, string> = {
  salary: "Salary / wages",
  freelance: "Freelance",
  business: "Business",
  investment: "Investment income",
  gift: "Gift",
  refund: "Refund",
  other: "Other",
};

export const INCOME_CATEGORY_ORDER: IncomeCategory[] = [
  "salary",
  "freelance",
  "business",
  "investment",
  "gift",
  "refund",
  "other",
];

export type ExpenseCategory =
  | "rent"
  | "groceries"
  | "transport"
  | "utilities"
  | "phone_internet"
  | "insurance"
  | "health"
  | "dining"
  | "shopping"
  | "education"
  | "travel"
  | "card_payment"
  | "other";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: "Rent / mortgage",
  groceries: "Groceries",
  transport: "Transport",
  utilities: "Utilities",
  phone_internet: "Phone / internet",
  insurance: "Insurance",
  health: "Health",
  dining: "Eating out",
  shopping: "Shopping",
  education: "Education",
  travel: "Travel",
  card_payment: "Credit card payment",
  other: "Other",
};

export const EXPENSE_CATEGORY_ORDER: ExpenseCategory[] = [
  "rent",
  "groceries",
  "transport",
  "utilities",
  "phone_internet",
  "insurance",
  "health",
  "dining",
  "shopping",
  "education",
  "travel",
  "card_payment",
  "other",
];

/** Money received. `date` is the day it landed, which is the rate that locks. */
export interface IncomeEntry {
  id: string;
  /** Who paid it — employer, client, whoever. */
  source: string;
  category: IncomeCategory;
  date: string;
  locked: LockedAmount;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** Money spent. Locked the same way, for the same reason. */
export interface ExpenseEntry {
  id: string;
  name: string;
  category: ExpenseCategory;
  date: string;
  locked: LockedAmount;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type BillingCycle = "weekly" | "monthly" | "quarterly" | "yearly";

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

export const BILLING_CYCLE_ORDER: BillingCycle[] = [
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
];

/** How many times a cycle bills in a year — used to normalise costs. */
export const CYCLES_PER_YEAR: Record<BillingCycle, number> = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
};

/**
 * A recurring charge. Deliberately *not* an expense: subscriptions are billed
 * to a card, and the card payment is already recorded as the expense. Counting
 * both would double every subscription in the monthly totals. This exists to
 * show what is running and what it costs.
 */
export interface Subscription {
  id: string;
  name: string;
  amount: number;
  currency: string;
  cycle: BillingCycle;
  /** Liability id of the card it's charged to, when known. */
  cardId?: string;
  /** Next billing date, ISO. */
  nextCharge?: string;
  category?: string;
  /** Paused/cancelled subscriptions stay on file but stop counting. */
  active: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  masterCurrency: Currency;
  /** Optional: prefer the ANTHROPIC_API_KEY env var over storing it here. */
  anthropicApiKey?: string;
  displayName?: string;
}

export interface Database {
  version: number;
  settings: Settings;
  holdings: Holding[];
  watchlist: WatchItem[];
  cashAccounts: CashAccount[];
  liabilities: Liability[];
  income: IncomeEntry[];
  expenses: ExpenseEntry[];
  subscriptions: Subscription[];
}

export const DEFAULT_DB: Database = {
  version: 5,
  settings: { masterCurrency: "USD" },
  holdings: [],
  watchlist: [],
  cashAccounts: [],
  liabilities: [],
  income: [],
  expenses: [],
  subscriptions: [],
};

export interface Quote {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  previousClose: number;
  change: number;
  changePercent: number;
  marketState?: string;
  exchange?: string;
  dayHigh?: number;
  dayLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  marketCap?: number;
  peRatio?: number;
  stale?: boolean;
}

/** One lot with its own currency conversion resolved. */
export interface ValuedLot extends Lot {
  /** This lot's cost in the master currency. */
  costBasis: number;
  /** Exchange rate on this lot's own purchase date. */
  fxRate?: number;
  fxApproximate: boolean;
}

/** A holding with live pricing and currency conversion applied. */
export interface ValuedHolding extends Holding {
  quote: Quote | null;
  lotsValued: ValuedLot[];
  /** Sum of every lot's units. */
  quantity: number;
  /** Weighted average price paid per unit, in `purchaseCurrency`. */
  averageCostPerUnit: number;
  /** Date of the earliest lot. */
  firstPurchaseDate: string;
  /** Price per unit in the asset's native currency. */
  nativePrice: number;
  nativeCurrency: string;
  /** All of the following are in the master currency. */
  marketValue: number;
  costBasis: number;
  gain: number;
  gainPercent: number;
  dayChange: number;
  /**
   * Return from price movement alone, in the asset's own currency. Comparing
   * this against `gainPercent` shows how much of your return is really the
   * exchange rate moving rather than the asset.
   */
  nativeGainPercent: number;
  /** True when any lot fell back to today's rate instead of its own. */
  costBasisApproximate: boolean;
  priceUnavailable: boolean;
}

export interface AccountBreakdown {
  account: AccountType | "unassigned";
  label: string;
  value: number;
  /** Total put in — the number that matters against a TFSA/RRSP limit. */
  contributed: number;
  percent: number;
  limited: boolean;
}

export interface ValuedCashAccount extends CashAccount {
  /** Balance converted into the master currency at today's rate. */
  converted: number;
}

/**
 * What it takes to clear a debt at the current rate of payment.
 *
 * Null-heavy on purpose: with no payment history and no scheduled payment
 * there is nothing honest to project, and a made-up date would be worse than
 * no date.
 */
export interface DebtProjection {
  /** Where `monthlyPayment` came from, so the UI can say which. */
  basis: "scheduled" | "recent-average";
  monthlyPayment: number;
  /** Null when the payment never clears the interest. */
  monthsRemaining: number | null;
  payoffDate: string | null;
  /** Interest still to be paid before it's clear. */
  interestRemaining: number | null;
  /**
   * True when the payment is smaller than the interest accruing, so the
   * balance grows instead of shrinking. Worth saying out loud.
   */
  neverPaysOff: boolean;
  /** Interest accruing in the first month, for comparison against the payment. */
  monthlyInterest: number;
}

export interface ValuedLiability extends Liability {
  converted: number;
  /** Change since the first recorded balance — negative means paid down. */
  changeSinceStart: number | null;

  // ---- Repayment picture ----

  /** `originalAmount` when set, otherwise the largest balance ever recorded. */
  startingBalance: number | null;
  /** How much of `startingBalance` is gone. */
  paidOff: number | null;
  paidOffPercent: number | null;
  /** Sums across every recorded payment. */
  totalPaid: number;
  totalInterestPaid: number;
  totalPrincipalPaid: number;
  /** What the current balance costs to carry, at `interestRate`. */
  dailyInterest: number | null;
  monthlyInterest: number | null;
  yearlyInterest: number | null;
  projection: DebtProjection | null;
}

export interface NetWorthSummary {
  currency: Currency;
  /** Market value of the portfolio. */
  investments: number;
  cash: number;
  assets: number;
  debts: number;
  netWorth: number;
  cashAccounts: ValuedCashAccount[];
  liabilities: ValuedLiability[];
  /** How much of total assets is debt-funded, as a percentage. */
  debtRatio: number;
  errors: string[];
  asOf: string;
}

export interface PortfolioSummary {
  masterCurrency: Currency;
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPercent: number;
  dayChange: number;
  dayChangePercent: number;
  holdings: ValuedHolding[];
  byPlatform: { platform: string; value: number; percent: number }[];
  byKind: { kind: AssetKind; label: string; value: number; percent: number }[];
  byCurrency: { currency: string; value: number; percent: number }[];
  byAccount: AccountBreakdown[];
  errors: string[];
  asOf: string;
}

/** One calendar month of cash flow, everything already in the master currency. */
export interface MonthSummary {
  /** "2026-08" */
  month: string;
  /** "August 2026" */
  label: string;
  income: number;
  expenses: number;
  /** income − expenses for this month alone. */
  net: number;
  /** Totals from the first recorded month up to and including this one. */
  cumulativeIncome: number;
  cumulativeExpenses: number;
  cumulativeNet: number;
  incomeCount: number;
  expenseCount: number;
}

export interface CategoryTotal {
  key: string;
  label: string;
  total: number;
  percent: number;
  count: number;
}

/** A credit card seen as a bill rather than as a debt. */
export interface CardBill {
  /** The liability id — same record the Net worth tab shows. */
  id: string;
  name: string;
  currency: string;
  /** Everything owed, converted at today's rate. */
  balance: number;
  balanceConverted: number;
  statementBalance?: number;
  minimumDue?: number;
  creditLimit?: number;
  interestRate?: number;
  autopay?: boolean;
  dueDay?: number;
  /** Next occurrence of `dueDay`, ISO date. */
  nextDue?: string;
  /** Days from today until `nextDue`; 0 means today. */
  daysUntilDue?: number;
  /** Balance as a percentage of `creditLimit`. */
  utilization?: number;
  notes?: string;
}

export interface CashflowSummary {
  masterCurrency: Currency;
  months: MonthSummary[];
  /** The month we're in now, or null when nothing has been recorded. */
  current: MonthSummary | null;
  totalIncome: number;
  totalExpenses: number;
  totalNet: number;
  /** Mean monthly figures across every month that has any activity. */
  averageIncome: number;
  averageExpenses: number;
  incomeByCategory: CategoryTotal[];
  expensesByCategory: CategoryTotal[];
  cards: CardBill[];
  income: IncomeEntry[];
  expenses: ExpenseEntry[];
  /**
   * Entries whose exchange rate could not be resolved, so their converted
   * figure is not trustworthy. Surfaced rather than hidden.
   */
  unconvertedCount: number;
  errors: string[];
  asOf: string;
}

export interface ValuedSubscription extends Subscription {
  /** Cost per month in the master currency, at today's rate. */
  monthlyConverted: number;
  /** Cost per year in the master currency, at today's rate. */
  yearlyConverted: number;
  /** Name of the card it's charged to, when linked. */
  cardName?: string;
  daysUntilCharge?: number;
  /** True when no rate could be found for `currency`. */
  rateMissing: boolean;
}

export interface SubscriptionsSummary {
  masterCurrency: Currency;
  subscriptions: ValuedSubscription[];
  /** Active-only totals. */
  monthlyTotal: number;
  yearlyTotal: number;
  activeCount: number;
  inactiveCount: number;
  /** Active subscription cost grouped by the card it hits. */
  byCard: { cardId: string | null; name: string; total: number; count: number }[];
  errors: string[];
  asOf: string;
}
