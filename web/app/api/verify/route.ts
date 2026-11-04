import { NextResponse } from "next/server";
import { agentConfigured, getEscrow, signAttestation } from "@/lib/near";
import { verifyDeliverable } from "@/lib/verifier";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 120;

// Runs the AI verifier on an on-chain escrow in Submitted state. Safe to expose:
// it only reads chain data, and the agent key can only call `attest`, once per escrow
// (the contract moves Submitted -> Verified|Rejected), within a capped gas allowance.
export async function POST(req: Request) {
  const rl = rateLimit(req, "verify", 3, 600000);
  if (!rl.ok) return NextResponse.json({ error: `Rate limited: ${rl.reason}` }, { status: 429, headers: { "retry-after": String(rl.retryAfter) } });
  const { id, sign } = await req.json().catch(() => ({}));
  if (typeof id !== "string" || !/^\d+$/.test(id)) return NextResponse.json({ error: "id must be a numeric string" }, { status: 400 });
  try {
    const e = await getEscrow(id);
    if (!e) return NextResponse.json({ error: "escrow not found" }, { status: 404 });
    const r = await verifyDeliverable(e);
    const args = { id, approved: r.verdict.approved, reason: r.verdict.reason.slice(0, 900) || "no reason", model: r.model.slice(0, 120), report_hash: r.reportHash };
    if (sign === false || !agentConfigured()) {
      return NextResponse.json({ ...r, attestArgs: args, signed: false, note: agentConfigured() ? "dry run" : "Agent key not configured on this server: the verifier must sign `attest` with these args in their wallet." });
    }
    const txHash = await signAttestation(args);
    return NextResponse.json({ ...r, attestArgs: args, signed: true, txHash });
  } catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 }); }
}
