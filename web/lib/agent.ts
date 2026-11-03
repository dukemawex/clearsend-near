import "server-only";
import { createHash } from "crypto";
import { tool } from "ai";
import { z } from "zod";
import { searchFlights, type FlightOffer } from "./flights";
import { getMidMarketRate } from "./fx";
import { fareBreakdown } from "./pricing";
import { getEscrow, listEscrows } from "./near";
import { dryQuote, getTokens } from "./intents";
import { nearToYocto } from "./near-format";
import { CONTRACT_ID, NETWORK, VERIFIER_ID } from "./config";
import { FLIGHT_PREFIX } from "./types";

export const SYSTEM_PROMPT = `You are ClearSend Intents, a cross-border payments and travel agent that settles through a NEAR escrow smart contract (${NETWORK}, contract ${CONTRACT_ID || "not configured"}).
Rules you must follow:
1. Never invent prices, flight ids, airlines, rates or transaction hashes. Use only tool outputs.
2. Flights: call searchFlights. Offers with price null are "schedule only - fare unavailable" (OpenFlights/OpenSky/Aviationstack open data) and can NOT be booked. List up to 3 options with airline, route, times, stops, price or the schedule-only label. Then ask exactly: "Which flight would you like?" and stop.
3. When the user picks a priced flight, ask: "Would you like me to book this for you and settle it through the NEAR escrow from your wallet?" If yes, collect for every traveller: full name as on passport, date of birth, nationality, passport number, contact email. Also ask for the NEAR account of the booking agent that will issue the ticket (the escrow recipient).
4. Call priceFlightBooking and show the full breakdown: fare, 2.5% service fee, FX rate and source, USD total, NEAR/USD price and source, NEAR total.
5. Ask for explicit confirmation ("yes, create the escrow"). Only after that call prepareFlightEscrow. That tool does NOT move funds: it creates a proposal the user signs in their own NEAR wallet. Say so.
6. Escrow lifecycle: payer funds -> recipient submits the deliverable (e.g. e-ticket number) -> the AI verifier checks it against the spec and records an on-chain attestation -> only then can funds be released. Rejected or expired escrows refund the payer.
7. Cross-border payout: payoutQuote returns a real NEAR Intents 1Click dry-run quote. It is a quote only; nothing executes.
8. Never print JSON, code blocks or raw tool calls. Be concise. Never claim a payment happened unless a tool output shows a transaction hash.`;

type Ctx = { offers: Map<string, FlightOffer> };

export function collectOffers(messages: unknown[]): Map<string, FlightOffer> {
  const offers = new Map<string, FlightOffer>();
  for (const m of messages as { parts?: { type?: string; output?: { options?: FlightOffer[] } }[] }[]) {
    for (const p of m.parts ?? []) if (p.type === "tool-searchFlights") for (const o of p.output?.options ?? []) offers.set(o.id, o);
  }
  return offers;
}

const ASSETS: Record<string, { symbol: string; blockchain: string }> = {
  "usdc-near": { symbol: "USDC", blockchain: "near" }, "usdc-arb": { symbol: "USDC", blockchain: "arb" },
  "usdc-base": { symbol: "USDC", blockchain: "base" }, "usdc-eth": { symbol: "USDC", blockchain: "eth" },
  "usdc-sol": { symbol: "USDC", blockchain: "sol" }, "usdt-tron": { symbol: "USDT", blockchain: "tron" },
  "usdt-eth": { symbol: "USDT", blockchain: "eth" }, "btc": { symbol: "BTC", blockchain: "btc" },
};
export async function resolveAsset(key: string) {
  const a = ASSETS[key]; if (!a) throw new Error(`unsupported destination ${key}; use one of ${Object.keys(ASSETS).join(", ")}`);
  const t = (await getTokens()).find((x) => x.symbol === a.symbol && x.blockchain === a.blockchain);
  if (!t) throw new Error(`${key} not currently listed by 1Click`);
  return t;
}

const traveller = z.object({ fullName: z.string().min(2), dateOfBirth: z.string(), nationality: z.string(), passportNumber: z.string().min(4), email: z.string().email() });

export function buildTools(ctx: Ctx) {
  const findOffer = (id: string) => {
    const o = ctx.offers.get(id);
    if (!o) throw new Error(`offer ${id} was not returned by searchFlights in this conversation`);
    if (o.price == null || o.scheduleOnly) throw new Error("schedule-only result: no fare available, cannot be booked");
    return o;
  };
  return {
    searchFlights: tool({
      description: "Search real flights. Sky-Scrapper (priced, needs RAPIDAPI_KEY) then open data (OpenSky, OpenFlights; schedule only, price null).",
      inputSchema: z.object({ origin: z.string(), destination: z.string(), date: z.string().optional().describe("YYYY-MM-DD") }),
      execute: async (i) => { const r = await searchFlights(i); return { ...r, options: r.options.slice(0, 8) }; },
    }),
    fxRate: tool({
      description: "Mid-market FX rate (open.er-api.com, frankfurter fallback).",
      inputSchema: z.object({ from: z.string().length(3), to: z.string().length(3) }),
      execute: async ({ from, to }) => getMidMarketRate(from.toUpperCase(), to.toUpperCase()),
    }),
    priceFlightBooking: tool({
      description: "Price breakdown for a priced offer id from searchFlights: fare, 2.5% fee, real FX, NEAR total.",
      inputSchema: z.object({ offerId: z.string(), travellers: z.number().int().min(1).max(9) }),
      execute: async ({ offerId, travellers }) => {
        const o = findOffer(offerId);
        return { offer: o, breakdown: await fareBreakdown(o.price as number, o.currency, travellers) };
      },
    }),
    prepareFlightEscrow: tool({
      description: "After explicit user confirmation, prepare a flight escrow proposal for the user to sign in their NEAR wallet. Moves no funds.",
      inputSchema: z.object({ offerId: z.string(), travellers: z.array(traveller).min(1).max(9), recipient: z.string().describe("booking agent NEAR account"), userConfirmed: z.literal(true) }),
      execute: async ({ offerId, travellers, recipient }) => {
        const o = findOffer(offerId);
        const b = await fareBreakdown(o.price as number, o.currency, travellers.length);
        // Traveller PII never goes on-chain: only a salted hash binds the ticket to the travellers.
        const salt = createHash("sha256").update(`${Date.now()}:${Math.random()}`).digest("hex").slice(0, 16);
        const travellerHash = createHash("sha256").update(salt + JSON.stringify(travellers)).digest("hex");
        const spec = `${FLIGHT_PREFIX}${o.airline}|${o.origin}-${o.destination}|${o.depart}|pax=${travellers.length}|fare=${o.price} ${o.currency}|travellers_sha256=${travellerHash}
Deliverable must be: a confirmed e-ticket/PNR for ${travellers.length} traveller(s) on ${o.airline} ${o.origin}->${o.destination} departing ${o.depart}, names matching the traveller hash, total not above ${b.totalFare} ${b.currency}.`;
        return { kind: "escrow-proposal", contract: CONTRACT_ID, network: NETWORK, recipient, verifier: VERIFIER_ID, spec, amountNear: String(b.totalNear), amountYocto: nearToYocto(b.totalNear.toFixed(4)), timeoutSecs: 7 * 24 * 3600, breakdown: b, travellerSalt: salt, note: "Not signed. The user signs create_escrow and fund in their own wallet." };
      },
    }),
    prepareEscrow: tool({
      description: "Prepare a general escrow proposal (freelance work, goods, services). User signs in wallet. Moves no funds.",
      inputSchema: z.object({ recipient: z.string(), spec: z.string().min(10).max(1800), amountNear: z.string(), timeoutHours: z.number().min(1).max(8760), userConfirmed: z.literal(true) }),
      execute: async ({ recipient, spec, amountNear, timeoutHours }) => ({ kind: "escrow-proposal", contract: CONTRACT_ID, network: NETWORK, recipient, verifier: VERIFIER_ID, spec, amountNear, amountYocto: nearToYocto(amountNear), timeoutSecs: Math.round(timeoutHours * 3600), note: "Not signed. The user signs in their own wallet." }),
    }),
    getEscrow: tool({ description: "Read one escrow from the NEAR contract.", inputSchema: z.object({ id: z.string() }), execute: async ({ id }) => (await getEscrow(id)) ?? { error: `escrow ${id} not found` } }),
    listEscrows: tool({ description: "List escrows from the NEAR contract.", inputSchema: z.object({}), execute: async () => listEscrows(0, 20) }),
    payoutQuote: tool({
      description: "Real NEAR Intents 1Click dry-run quote to pay out NEAR to another chain/stablecoin. Quote only.",
      inputSchema: z.object({ amountNear: z.string(), destination: z.enum(Object.keys(ASSETS) as [string, ...string[]]), recipient: z.string(), refundTo: z.string() }),
      execute: async ({ amountNear, destination, recipient, refundTo }) => {
        const t = await resolveAsset(destination);
        const q = await dryQuote({ amountYocto: nearToYocto(amountNear), destinationAsset: t.assetId, recipient, refundTo });
        return { kind: "intents-quote", destination, asset: t.assetId, dry: q.quoteRequest?.dry, quote: q.quote };
      },
    }),
  };
}
