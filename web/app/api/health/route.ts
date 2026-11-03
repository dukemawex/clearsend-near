import { NextResponse } from "next/server";
import { CONTRACT_ID, NETWORK, RPC_URL, VERIFIER_ID } from "@/lib/config";
import { agentConfigured, provider } from "@/lib/near";
import { models } from "@/lib/ai";
export const dynamic = "force-dynamic";
export async function GET() {
  let contractOk = false, rpcError: string | null = null;
  try { if (CONTRACT_ID) { await provider.callFunction(CONTRACT_ID, "total", {}); contractOk = true; } } catch (e) { rpcError = e instanceof Error ? e.message : String(e); }
  return NextResponse.json({
    network: NETWORK, rpc: RPC_URL, contract: CONTRACT_ID || null, contractReachable: contractOk, rpcError, verifier: VERIFIER_ID || null,
    agentKeyConfigured: agentConfigured(), models: models().map((m) => m.id), rapidApi: Boolean(process.env.RAPIDAPI_KEY),
    linkSecret: Boolean(process.env.ESCROW_LINK_SECRET), intentsExecute: process.env.INTENTS_EXECUTE === "1",
  });
}
