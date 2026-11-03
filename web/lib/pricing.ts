import { FEE_RATE } from "./config";
import { getMidMarketRate } from "./fx";
import { nearUsdPrice } from "./intents";

/** Real price breakdown for paying a fare through the NEAR escrow. */
export async function fareBreakdown(fare: number, currency: string, travellers = 1) {
  if (!(fare > 0)) throw new Error("A real fare is required; schedule-only results cannot be priced");
  const fx = await getMidMarketRate(currency.toUpperCase(), "USD");
  const near = await nearUsdPrice();
  const subtotal = fare * travellers;
  const fee = +(subtotal * FEE_RATE).toFixed(2);
  const totalFare = +(subtotal + fee).toFixed(2);
  const totalUsd = +(totalFare * fx.rate).toFixed(2);
  const totalNear = +(totalUsd / near.price).toFixed(4);
  return {
    fare, currency: currency.toUpperCase(), travellers, subtotal: +subtotal.toFixed(2), feeRate: FEE_RATE, fee, totalFare,
    fxRateToUsd: fx.rate, fxSource: fx.source, totalUsd, nearUsd: near.price, nearPriceSource: near.source, nearPriceAt: near.updatedAt, totalNear,
  };
}
