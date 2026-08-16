import { getCloseOn, getQuote } from "./market";
import { getHistoricalRate } from "./fx";

export interface PriceOnDate {
  /** Price in the currency you asked for. */
  price: number;
  currency: string;
  /** Price as the exchange quotes it, before conversion. */
  nativePrice: number;
  nativeCurrency: string;
  /** True when the price had to be converted from another currency. */
  converted: boolean;
  date: string;
}

/**
 * What one unit cost on a given day, expressed in `targetCurrency`.
 *
 * This is what turns "I put in $500 on March 1st" into a number of units: look
 * up the price that day, convert it into the currency the deposit was made in,
 * and divide.
 */
export async function priceOnDate(
  symbol: string,
  date: string,
  targetCurrency: string
): Promise<PriceOnDate | null> {
  const sym = symbol.trim().toUpperCase();
  const day = date.slice(0, 10);
  if (!sym || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;

  const close = await getCloseOn(sym, day);
  if (close === null || close <= 0) return null;

  // getCloseOn returns a bare number, so the currency comes from the live quote
  // — an exchange doesn't change what currency it quotes in.
  const quote = await getQuote(sym);
  const nativeCurrency = quote?.currency ?? targetCurrency.toUpperCase();
  const target = targetCurrency.toUpperCase();

  if (nativeCurrency === target) {
    return {
      price: close,
      currency: target,
      nativePrice: close,
      nativeCurrency,
      converted: false,
      date: day,
    };
  }

  const rate = await getHistoricalRate(nativeCurrency, target, day);
  if (rate === null) return null;

  return {
    price: close * rate,
    currency: target,
    nativePrice: close,
    nativeCurrency,
    converted: true,
    date: day,
  };
}
