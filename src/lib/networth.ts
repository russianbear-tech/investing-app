import {
  Database,
  NetWorthSummary,
  ValuedCashAccount,
  ValuedLiability,
} from "./types";
import { buildFxTable } from "./fx";
import { describeDebt } from "./debt";

/**
 * Assets minus debts, everything in the master currency.
 *
 * `investmentsValue` is passed in rather than recomputed — the caller already
 * values the portfolio, and doing it twice would repeat every price lookup.
 */
export async function computeNetWorth(
  db: Database,
  investmentsValue: number
): Promise<NetWorthSummary> {
  const master = db.settings.masterCurrency;
  const errors: string[] = [];

  const currencies = [
    ...db.cashAccounts.map((a) => a.currency),
    ...db.liabilities.map((l) => l.currency),
  ];

  // Balances are current, so today's rate is the right one — unlike a cost
  // basis, which has to use the rate from its own purchase date.
  const fx = await buildFxTable(currencies, master);
  const missing = fx.missing(currencies);
  if (missing.length > 0) {
    errors.push(
      `Could not fetch an exchange rate for ${missing.join(", ")} — those balances are shown unconverted.`
    );
  }

  const cashAccounts: ValuedCashAccount[] = db.cashAccounts
    .map((a) => ({ ...a, converted: fx.convert(a.balance, a.currency) }))
    .sort((a, b) => b.converted - a.converted);

  const liabilities: ValuedLiability[] = db.liabilities
    .map((l) => {
      const first = l.history.length > 0 ? l.history[0].balance : null;
      return {
        ...l,
        converted: fx.convert(l.balance, l.currency),
        changeSinceStart: first !== null ? l.balance - first : null,
        // Repayment figures ride along on the same request the page already
        // makes, so opening a debt needs no second round-trip.
        ...describeDebt(l),
      };
    })
    .sort((a, b) => b.converted - a.converted);

  const cash = cashAccounts.reduce((sum, a) => sum + a.converted, 0);
  const debts = liabilities.reduce((sum, l) => sum + l.converted, 0);
  const assets = investmentsValue + cash;

  return {
    currency: master,
    investments: investmentsValue,
    cash,
    assets,
    debts,
    netWorth: assets - debts,
    cashAccounts,
    liabilities,
    debtRatio: assets > 0 ? (debts / assets) * 100 : 0,
    errors,
    asOf: new Date().toISOString(),
  };
}
