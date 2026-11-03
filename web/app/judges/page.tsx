import Link from "next/link";
import { CONTRACT_ID, NETWORK, VERIFIER_ID, explorerAccount } from "@/lib/config";
export default function Judges() {
  return <><h1>For judges: verify in 5 minutes</h1>
    <p>Network <b>{NETWORK}</b> · contract <a href={explorerAccount(CONTRACT_ID)} target="_blank" rel="noreferrer">{CONTRACT_ID}</a> · verifier <a href={explorerAccount(VERIFIER_ID)} target="_blank" rel="noreferrer">{VERIFIER_ID}</a> · <a href="/api/health">/api/health</a></p>
    <ol className="steps big">
      <li>Open <Link href="/policy">Agent policy</Link>. See: the verifier account has a FunctionCall key limited to <code>attest</code> on the contract, with a NEAR allowance.</li>
      <li>On <Link href="/">Agent</Link>, click “Find flights from Lagos to London…”. See: real results; schedule-only ones are labelled and cannot be chosen; the agent asks “Which flight would you like?”.</li>
      <li>Connect a testnet wallet (MyNearWallet/Meteor/HERE). Go to <Link href="/escrow/new">New escrow</Link>, set a second testnet account as recipient, keep the default verifier, write a spec, sign 2 transactions. See: escrow appears on <Link href="/dashboard">Escrows</Link> as Funded with explorer links.</li>
      <li>Open the escrow as the recipient (switch wallet or use the recipient link) and submit a deliverable. Then click “Run AI verifier”. See: an attestation with model id and report hash recorded on-chain, and status Verified or Rejected.</li>
      <li>Try Release before verification: the contract panics with “release requires Verified state”. After Verified, Release transfers NEAR to the recipient.</li>
      <li>Open <Link href="/payout">Payout quote</Link> and request a quote to usdc-near. See: a real 1Click dry-run quote, or an honest error.</li>
    </ol></>;
}
