"use client";
import Link from "next/link";
import { useState } from "react";
import { decodeReturn, useWallet } from "./Wallet";
import { STORAGE_DEPOSIT, explorerTx } from "@/lib/config";

export type Proposal = { contract: string; network: string; recipient: string; verifier: string; spec: string; amountNear: string; amountYocto: string; timeoutSecs: number; breakdown?: Record<string, number | string> };

export function ProposalCard({ p }: { p: Proposal }) {
  const { accountId, signIn, call } = useWallet();
  const [state, setState] = useState<{ step: string; id?: string; txs: string[]; error?: string }>({ step: "idle", txs: [] });
  const [agree, setAgree] = useState(false);
  async function sign() {
    try {
      setState({ step: "creating", txs: [] });
      const o1 = await call("create_escrow", { recipient: p.recipient, verifier: p.verifier, spec: p.spec, timeout_secs: String(p.timeoutSecs) }, STORAGE_DEPOSIT);
      const id = decodeReturn(o1) as string | undefined;
      const txs = o1 && o1.transaction?.hash ? [o1.transaction.hash] : [];
      if (!id) { setState({ step: "redirected", txs }); return; }
      setState({ step: "funding", id, txs });
      const o2 = await call("fund", { id }, p.amountYocto);
      setState({ step: "done", id, txs: o2 && o2.transaction?.hash ? [...txs, o2.transaction.hash] : txs });
    } catch (e) { setState((s) => ({ ...s, step: "error", error: e instanceof Error ? e.message : String(e) })); }
  }
  const b = p.breakdown;
  return <div className="card proposal">
    <div className="kicker">Escrow proposal · not signed</div>
    {b && <table className="breakdown"><tbody>
      <tr><td>Fare</td><td>{b.subtotal} {b.currency} ({b.travellers} × {b.fare})</td></tr>
      <tr><td>Service fee 2.5%</td><td>{b.fee} {b.currency}</td></tr>
      <tr><td>Total</td><td>{b.totalFare} {b.currency}</td></tr>
      <tr><td>FX {b.currency}→USD</td><td>{Number(b.fxRateToUsd).toFixed(4)} ({b.fxSource})</td></tr>
      <tr><td>USD total</td><td>${b.totalUsd}</td></tr>
      <tr><td>NEAR/USD</td><td>${b.nearUsd} (1Click, {String(b.nearPriceAt)})</td></tr>
      <tr className="total"><td>You escrow</td><td>{b.totalNear} NEAR</td></tr></tbody></table>}
    {!b && <p><b>{p.amountNear} NEAR</b> to escrow</p>}
    <dl className="kv"><dt>Recipient</dt><dd>{p.recipient}</dd><dt>AI verifier</dt><dd>{p.verifier || "not configured"}</dd><dt>Timeout</dt><dd>{Math.round(p.timeoutSecs / 3600)} h, then you can refund</dd><dt>Contract</dt><dd>{p.contract} ({p.network})</dd></dl>
    <details><summary>On-chain spec</summary><pre className="spec">{p.spec}</pre></details>
    {state.step === "idle" && (accountId
      ? <><label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> I confirm: create this escrow and deposit {p.amountNear} NEAR from {accountId}.</label>
        <button className="btn" disabled={!agree} onClick={() => void sign()}>Sign in wallet (2 transactions)</button></>
      : <button className="btn" onClick={signIn}>Connect wallet to sign</button>)}
    {state.step === "creating" && <p className="muted">Approve create_escrow in your wallet…</p>}
    {state.step === "funding" && <p className="muted">Escrow #{state.id} created. Approve the deposit in your wallet…</p>}
    {state.step === "redirected" && <p>Wallet returned without a result (redirect wallet). Find your escrow on the <Link href="/dashboard">dashboard</Link> and fund it there.</p>}
    {state.step === "done" && <p className="ok">Escrow <Link href={`/escrow/${state.id}`}>#{state.id}</Link> funded.</p>}
    {state.error && <p className="err">{state.error}</p>}
    {state.txs.map((t) => <a key={t} className="tx" href={explorerTx(t)} target="_blank" rel="noreferrer">tx {t.slice(0, 10)}…</a>)}
  </div>;
}
