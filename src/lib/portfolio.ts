import {
  ACCOUNT_LABELS,
  AccountBreakdown,
  AccountType,
  ASSET_KIND_LABELS,
  AssetKind,
  CONTRIBUTION_LIMITED,
  Database,
  Holding,
  PortfolioSummary,
  Quote,
  ValuedHolding,
  ValuedLot,
} from "./types";
import { getQuotes } from "./market";
import { buildFxTable, FxTable, getHistoricalRate } from "./fx";

/** Where a holding's live price and currency come from. */
function resolveNative(
  holding: Holding,
  quote: Quote | null,
  averageCost: number
): { price: number; currency: string; unavailable: boolean } {
  if (quote && quote.price > 0) {
    return { price: quote.price, currency: quote.currency, unavailable: false };
  }
  // Cash, GICs, and anything without a working ticker price off what you typed.
  const manual = holding.manualPrice ?? averageCost;
  return {
    price: manual,
    currency: holding.purchaseCurrency,
    unavailable: Boolean(holding.symbol) && holding.kind !== "cash",
  };
}

/**
 * Prices every lot at the exchange rate from its own purchase date. A fund
 * bought monthly across a year of moving rates gets a cost basis that reflects
 * what each deposit actually cost — not what it would cost today.
 */
async function valueLots(
  holding: Holding,
  master: string,
  fx: FxTable
): Promise<ValuedLot[]> {
  return Promise.all(
    holding.lots.map(async (lot) => {
      if (holding.purchaseCurrency === master) {
        return {
          ...lot,
          costBasis: lot.quantity * lot.costPerUnit,
          fxRate: undefined,
          fxApproximate: false,
        };
      }

      const rate = await getHistoricalRate(holding.purchaseCurrency, master, lot.date);
      const effective = rate ?? fx.rateFor(holding.purchaseCurrency);
      return {
        ...lot,
        costBasis: lot.quantity * lot.costPerUnit * effective,
        fxRate: effective,
        fxApproximate: rate === null,
      };
    })
  );
}

/** Average cost restated in the asset's own currency, for the price-only return. */
async function averageCostInNative(
  holding: Holding,
  nativeCurrency: string,
  totalQuantity: number
): Promise<number | null> {
  if (totalQuantity <= 0) return null;
  if (holding.purchaseCurrency === nativeCurrency) {
    const total = holding.lots.reduce((s, l) => s + l.quantity * l.costPerUnit, 0);
    return total / totalQuantity;
  }

  let total = 0;
  for (const lot of holding.lots) {
    const rate = await getHistoricalRate(
      holding.purchaseCurrency,
      nativeCurrency,
      lot.date
    );
    if (rate === null) return null;
    total += lot.quantity * lot.costPerUnit * rate;
  }
  return total / totalQuantity;
}

export async function valuePortfolio(db: Database): Promise<PortfolioSummary> {
  const master = db.settings.masterCurrency;
  const errors: string[] = [];

  const symbols = db.holdings
    .filter((h) => h.symbol && h.kind !== "cash")
    .map((h) => h.symbol);

  const quotes = symbols.length > 0 ? await getQuotes(symbols) : new Map<string, Quote>();

  const prepared = db.holdings.map((h) => {
    const quantity = h.lots.reduce((s, l) => s + l.quantity, 0);
    const grossCost = h.lots.reduce((s, l) => s + l.quantity * l.costPerUnit, 0);
    const averageCostPerUnit = quantity > 0 ? grossCost / quantity : 0;
    const quote = h.symbol ? (quotes.get(h.symbol.toUpperCase()) ?? null) : null;
    const native = resolveNative(h, quote, averageCostPerUnit);
    return { holding: h, quote, native, quantity, averageCostPerUnit };
  });

  const currencies = prepared.flatMap((p) => [
    p.native.currency,
    p.holding.purchaseCurrency,
  ]);
  const fx = await buildFxTable(currencies, master);

  const missing = fx.missing(currencies);
  if (missing.length > 0) {
    errors.push(
      `Could not fetch an exchange rate for ${missing.join(", ")} — those holdings are shown unconverted.`
    );
  }

  const holdings: ValuedHolding[] = await Promise.all(
    prepared.map(async ({ holding, quote, native, quantity, averageCostPerUnit }) => {
      const lotsValued = await valueLots(holding, master, fx);
      const costBasis = lotsValued.reduce((s, l) => s + l.costBasis, 0);
      const costBasisApproximate = lotsValued.some((l) => l.fxApproximate);

      const marketValue = fx.convert(quantity * native.price, native.currency);
      const gain = marketValue - costBasis;
      const gainPercent = costBasis !== 0 ? (gain / costBasis) * 100 : 0;
      const dayChange = quote
        ? fx.convert(quantity * quote.change, native.currency)
        : 0;

      const avgNative = await averageCostInNative(holding, native.currency, quantity);
      const nativeGainPercent =
        avgNative && avgNative > 0
          ? (native.price / avgNative - 1) * 100
          : gainPercent;

      const firstPurchaseDate =
        holding.lots.length > 0
          ? holding.lots.reduce(
              (earliest, l) => (l.date < earliest ? l.date : earliest),
              holding.lots[0].date
            )
          : holding.createdAt.slice(0, 10);

      return {
        ...holding,
        quote,
        lotsValued,
        quantity,
        averageCostPerUnit,
        firstPurchaseDate,
        nativePrice: native.price,
        nativeCurrency: native.currency,
        marketValue,
        costBasis,
        gain,
        gainPercent,
        dayChange,
        nativeGainPercent,
        costBasisApproximate,
        priceUnavailable: native.unavailable,
      };
    })
  );

  const approxCount = holdings.filter((h) => h.costBasisApproximate).length;
  if (approxCount > 0) {
    errors.push(
      `${approxCount} holding${approxCount > 1 ? "s have" : " has"} at least one purchase where the exchange rate for that date couldn't be fetched, so the gain is approximate.`
    );
  }

  const unpriced = holdings.filter((h) => h.priceUnavailable).map((h) => h.symbol);
  if (unpriced.length > 0) {
    errors.push(
      `No live price for ${unpriced.join(", ")} — showing your entered value instead.`
    );
  }

  const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.costBasis, 0);
  const totalGain = totalValue - totalCost;
  const dayChange = holdings.reduce((sum, h) => sum + h.dayChange, 0);
  const prevValue = totalValue - dayChange;

  const group = <K extends string>(keyOf: (h: ValuedHolding) => K) => {
    const map = new Map<K, number>();
    for (const h of holdings) map.set(keyOf(h), (map.get(keyOf(h)) ?? 0) + h.marketValue);
    return [...map.entries()]
      .map(([key, value]) => ({
        key,
        value,
        percent: totalValue !== 0 ? (value / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  };

  // Accounts also track what was put in, which is the figure that matters
  // against a TFSA or RRSP contribution limit.
  const accountMap = new Map<string, { value: number; contributed: number }>();
  for (const h of holdings) {
    const key = h.account ?? "unassigned";
    const entry = accountMap.get(key) ?? { value: 0, contributed: 0 };
    entry.value += h.marketValue;
    entry.contributed += h.costBasis;
    accountMap.set(key, entry);
  }

  const byAccount: AccountBreakdown[] = [...accountMap.entries()]
    .map(([key, { value, contributed }]) => ({
      account: key as AccountType | "unassigned",
      label: key === "unassigned" ? "Unassigned" : ACCOUNT_LABELS[key as AccountType],
      value,
      contributed,
      percent: totalValue !== 0 ? (value / totalValue) * 100 : 0,
      limited: CONTRIBUTION_LIMITED.includes(key as AccountType),
    }))
    .sort((a, b) => b.value - a.value);

  return {
    masterCurrency: master,
    totalValue,
    totalCost,
    totalGain,
    totalGainPercent: totalCost !== 0 ? (totalGain / totalCost) * 100 : 0,
    dayChange,
    dayChangePercent: prevValue !== 0 ? (dayChange / prevValue) * 100 : 0,
    holdings: holdings.sort((a, b) => b.marketValue - a.marketValue),
    byPlatform: group((h) => h.platform || "Unspecified").map((g) => ({
      platform: g.key,
      value: g.value,
      percent: g.percent,
    })),
    byKind: group((h) => h.kind).map((g) => ({
      kind: g.key as AssetKind,
      label: ASSET_KIND_LABELS[g.key as AssetKind] ?? g.key,
      value: g.value,
      percent: g.percent,
    })),
    byCurrency: group((h) => h.nativeCurrency).map((g) => ({
      currency: g.key,
      value: g.value,
      percent: g.percent,
    })),
    byAccount,
    errors,
    asOf: new Date().toISOString(),
  };
}
