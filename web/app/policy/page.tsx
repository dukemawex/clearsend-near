"use client";
import { useEffect, useState } from "react";
import { CONTRACT_ID, VERIFIER_ID, explorerAccount } from "@/lib/config";
import { yoctoToNear } from "@/lib/near-format";
type K = { publicKey: string; nonce: string; permission: "FullAccess" | { FunctionCall: { allowance: string | null; receiver_id: string; method_names: string[] } } };
export default function Policy() {
  const [d, setD] = useState<{ keys?: K[]; error?: string } | null>(null);
  useEffect(() => { fetch("/api/policy").then((r) => r.json()).then(setD).catch((e) => setD({ error: String(e) })); }, []);
  return <><h1>Agent spending policy</h1>
    <p>The AI verifier never holds a full-access key. It signs with a NEAR <b>function-call access key</b> on <a href={explorerAccount(VERIFIER_ID)} target="_blank" rel="noreferrer">{VERIFIER_ID || "(verifier not configured)"}</a> that the chain itself restricts:</p>
    <ul><li>Receiver: only the escrow contract <code>{CONTRACT_ID}</code></li><li>Methods: only <code>attest</code> (cannot call release, refund, fund, or transfer)</li><li>Cannot attach any deposit (protocol rule for function-call keys)</li><li>Gas allowance cap: once spent, the key stops working</li><li>The contract only accepts <code>attest</code> from the escrow&apos;s named verifier, once, in Submitted state</li></ul>
    <p>Add or revoke: <code>scripts/agent-key.sh add|revoke|list</code>. Revocation is a single <code>DeleteKey</code> action by the verifier&apos;s owner.</p>
    <h3>Live keys on the verifier account (from NEAR RPC)</h3>
    {!d && <p className="muted">Loading…</p>}{d?.error && <p className="err">{d.error}</p>}
    <table className="list"><tbody>{d?.keys?.map((k) => <tr key={k.publicKey}><td className="clip">{k.publicKey}</td>
      {k.permission === "FullAccess" ? <td><span className="badge s-rejected">FullAccess (owner, not on server)</span></td>
        : <td><span className="badge s-verified">FunctionCall</span> {k.permission.FunctionCall.receiver_id} · [{k.permission.FunctionCall.method_names.join(", ")}] · allowance {k.permission.FunctionCall.allowance ? `${yoctoToNear(k.permission.FunctionCall.allowance)} NEAR left` : "unlimited"}</td>}
      <td className="muted">nonce {k.nonce}</td></tr>)}</tbody></table></>;
}
