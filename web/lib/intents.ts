// NEAR Intents 1Click API. There is no testnet (HACKATHON.md Q-007), so we only
// request dry:true quotes unless INTENTS_EXECUTE=1 is set explicitly.
const BASE = process.env.ONECLICK_BASE_URL ?? "https://1click.chaindefuser.com";
export type Token = { assetId: string; decimals: number; blockchain: string; symbol: string; price: number; priceUpdatedAt: string };

let tokenCache: { at: number; data: Token[] } | null = null;
export async function getTokens(): Promise<Token[]> {
  if (tokenCache && Date.now() - tokenCache.at < 60_000) return tokenCache.data;
  const r = await fetch(`${BASE}/v0/tokens`, { cache: "no-store" });
  if (!r.ok) throw new Error(`1Click tokens HTTP ${r.status}`);
  const data = (await r.json()) as Token[];
  tokenCache = { at: Date.now(), data };
  return data;
}

export async function nearUsdPrice(): Promise<{ price: number; updatedAt: string; source: string }> {
  const t = (await getTokens()).find((x) => x.assetId === "nep141:wrap.near");
  if (!t) throw new Error("wNEAR not listed by 1Click");
  return { price: t.price, updatedAt: t.priceUpdatedAt, source: "1click.chaindefuser.com/v0/tokens" };
}

export type QuoteInput = { amountYocto: string; destinationAsset: string; recipient: string; refundTo: string; slippageBps?: number };
export async function dryQuote(q: QuoteInput) {
  const body = {
    dry: process.env.INTENTS_EXECUTE !== "1",
    swapType: "EXACT_INPUT",
    slippageTolerance: q.slippageBps ?? 100,
    originAsset: "nep141:wrap.near",
    depositType: "ORIGIN_CHAIN",
    destinationAsset: q.destinationAsset,
    amount: q.amountYocto,
    recipient: q.recipient,
    recipientType: "DESTINATION_CHAIN",
    refundTo: q.refundTo,
    refundType: "ORIGIN_CHAIN",
    deadline: new Date(Date.now() + 30 * 60_000).toISOString(),
  };
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.ONECLICK_JWT) headers.Authorization = `Bearer ${process.env.ONECLICK_JWT}`;
  const r = await fetch(`${BASE}/v0/quote`, { method: "POST", headers, body: JSON.stringify(body), cache: "no-store" });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`1Click quote failed (HTTP ${r.status}): ${(json as { message?: string }).message ?? "unknown error"}`);
  return json as { quote: Record<string, string | number>; quoteRequest: Record<string, unknown>; signature?: string; timestamp?: string };
}
