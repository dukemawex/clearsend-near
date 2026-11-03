import Link from "next/link";
import { Chat } from "@/components/Chat";
import { CONTRACT_ID, NETWORK, VERIFIER_ID, explorerAccount } from "@/lib/config";
export default function Home() {
  return <div className="grid2">
    <div><h1>Pay across borders. Release only when the work is verified.</h1><Chat /></div>
    <aside className="side">
      <div className="card"><div className="kicker">How money moves</div><ol className="steps">
        <li>You sign <code>create_escrow</code> + <code>fund</code> in your NEAR wallet.</li>
        <li>Recipient signs <code>submit</code> with the deliverable (e.g. e-ticket).</li>
        <li>AI verifier compares it to your spec and signs <code>attest</code> with a key that can call nothing else.</li>
        <li>Release is possible only after <b>Verified</b>. Rejected or expired → refund.</li>
        <li>Optional cross-chain payout quote via NEAR Intents 1Click.</li></ol></div>
      <div className="card"><div className="kicker">On-chain</div>
        <p>Network: <b>{NETWORK}</b></p>
        <p>Contract: {CONTRACT_ID ? <a href={explorerAccount(CONTRACT_ID)} target="_blank" rel="noreferrer">{CONTRACT_ID}</a> : <span className="err">not configured</span>}</p>
        <p>Verifier: {VERIFIER_ID ? <a href={explorerAccount(VERIFIER_ID)} target="_blank" rel="noreferrer">{VERIFIER_ID}</a> : <span className="err">not configured</span>}</p>
        <p><Link href="/policy">View the agent key policy →</Link></p></div>
    </aside></div>;
}
