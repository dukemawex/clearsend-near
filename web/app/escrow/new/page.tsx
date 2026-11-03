"use client";
import { useState } from "react";
import { ProposalCard } from "@/components/ProposalCard";
import { CONTRACT_ID, NETWORK, VERIFIER_ID } from "@/lib/config";
import { nearToYocto } from "@/lib/near-format";
export default function NewEscrow() {
  const [f, setF] = useState({ recipient: "", verifier: VERIFIER_ID, spec: "", amount: "1", hours: "72" });
  const [ready, setReady] = useState(false);
  let yocto = ""; try { yocto = nearToYocto(f.amount); } catch {}
  const valid = f.recipient && f.verifier && f.spec.length >= 10 && yocto && Number(f.hours) >= 1;
  return <><h1>New escrow</h1>
    {!ready ? <form className="card form" onSubmit={(e) => { e.preventDefault(); if (valid) setReady(true); }}>
      <label>Recipient NEAR account<input value={f.recipient} onChange={(e) => setF({ ...f, recipient: e.target.value.trim() })} placeholder="freelancer.testnet" /></label>
      <label>Verifier account (AI agent)<input value={f.verifier} onChange={(e) => setF({ ...f, verifier: e.target.value.trim() })} /></label>
      <label>Specification the deliverable must meet<textarea value={f.spec} onChange={(e) => setF({ ...f, spec: e.target.value })} maxLength={1800} placeholder="Concrete, checkable requirements" /></label>
      <label>Amount (NEAR)<input value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
      <label>Timeout (hours) before you may refund<input value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></label>
      <button className="btn" disabled={!valid}>Review</button>
    </form> : <ProposalCard p={{ contract: CONTRACT_ID, network: NETWORK, recipient: f.recipient, verifier: f.verifier, spec: f.spec, amountNear: f.amount, amountYocto: yocto, timeoutSecs: Math.round(Number(f.hours) * 3600) }} />}</>;
}
