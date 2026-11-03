"use client";
import { useState } from "react";
const DEST = ["usdc-near", "usdc-arb", "usdc-base", "usdc-eth", "usdc-sol", "usdt-tron", "usdt-eth", "btc"];
export default function Payout() {
  const [f, setF] = useState({ amountNear: "10", destination: "usdc-near", recipient: "", refundTo: "" });
  const [r, setR] = useState<{ error?: string; quote?: Record<string, string>; quoteRequest?: { dry?: boolean }; asset?: { assetId: string } } | null>(null);
  const [busy, setBusy] = useState(false);
  return <><h1>Cross-border payout quote</h1>
    <p className="muted">After release, a recipient can convert NEAR to a stablecoin or another chain through NEAR Intents 1Click. NEAR Intents has no testnet, so this page requests real mainnet <code>dry: true</code> quotes. Nothing executes unless the server sets <code>INTENTS_EXECUTE=1</code>.</p>
    <form className="card form" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setR(null); const res = await fetch("/api/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) }); setR(await res.json()); setBusy(false); }}>
      <label>Amount (NEAR)<input value={f.amountNear} onChange={(e) => setF({ ...f, amountNear: e.target.value })} /></label>
      <label>Receive as<select value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value })}>{DEST.map((d) => <option key={d}>{d}</option>)}</select></label>
      <label>Recipient address on the destination chain<input value={f.recipient} onChange={(e) => setF({ ...f, recipient: e.target.value.trim() })} placeholder="name.near or 0x… / base58 / T…" /></label>
      <label>Refund to (mainnet NEAR account)<input value={f.refundTo} onChange={(e) => setF({ ...f, refundTo: e.target.value.trim() })} placeholder="you.near" /></label>
      <button className="btn" disabled={busy || !f.recipient || !f.refundTo}>{busy ? "Quoting…" : "Get live quote"}</button></form>
    {r?.error && <p className="err">1Click: {r.error}</p>}
    {r?.quote && <div className="card"><div className="kicker">{r.quoteRequest?.dry ? "Dry-run quote (no deposit address issued)" : "LIVE quote"}</div>
      <table className="breakdown"><tbody>
        <tr><td>You send</td><td>{r.quote.amountInFormatted} NEAR (${Number(r.quote.amountInUsd).toFixed(2)})</td></tr>
        <tr><td>Recipient gets</td><td><b>{r.quote.amountOutFormatted}</b> (${Number(r.quote.amountOutUsd).toFixed(2)})</td></tr>
        <tr><td>Minimum out</td><td>{r.quote.minAmountOut}</td></tr><tr><td>Est. time</td><td>{r.quote.timeEstimate}s</td></tr>
        <tr><td>Asset</td><td className="clip">{r.asset?.assetId}</td></tr></tbody></table></div>}</>;
}
