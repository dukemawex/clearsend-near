"use client";
import { useCallback, useEffect, useState } from "react";
import { useWallet } from "./Wallet";
import { StatusBadge, Timeline } from "./Timeline";
import { CONTRACT_ID, explorerAccount, explorerTx } from "@/lib/config";
import { nsToDate, yoctoToNear } from "@/lib/near-format";
import type { Escrow, Role } from "@/lib/types";

const EXPLAIN: Record<Role, string> = {
  payer: "You deposited the funds. They stay locked in the contract until the AI verifier attests the deliverable meets your spec. If it is rejected, or the deadline passes without verification, you can refund.",
  recipient: "Submit the deliverable (link, ticket number or content hash). Once the AI verifier attests it meets the spec, funds can be released to you.",
  verifier: "The AI agent checks the deliverable against the spec and records its decision on-chain with a function-call key that can only call attest.",
  observer: "Read-only view. Connect a wallet that is a party to act.",
};

export function EscrowDetail({ id, role: linkRoleParam, token }: { id: string; role?: string; token?: string }) {
  const { accountId, call, signIn } = useWallet();
  const [e, setE] = useState<Escrow | null>(null);
  const [linkRole, setLinkRole] = useState<Role | null>(null);
  const [err, setErr] = useState<string>();
  const [view, setView] = useState<Role | null>(null);
  const [msg, setMsg] = useState<{ text: string; tx?: string; ok?: boolean }>();
  const [deliverable, setDeliverable] = useState("");
  const [links, setLinks] = useState<{ role: string; url: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const q = linkRoleParam && token ? `?role=${linkRoleParam}&token=${token}` : "";
    const r = await fetch(`/api/escrow/${id}${q}`); const j = await r.json();
    if (!r.ok) { setErr(j.error); return; }
    setE(j.escrow); setLinkRole(j.linkRole);
  }, [id, linkRoleParam, token]);
  useEffect(() => { void load(); }, [load]);

  if (err) return <p className="err">{err}</p>;
  if (!e) return <p className="muted">Reading escrow #{id} from NEAR…</p>;
  const walletRole: Role | null = accountId === e.payer ? "payer" : accountId === e.recipient ? "recipient" : accountId === e.verifier ? "verifier" : null;
  const role: Role = view ?? walletRole ?? linkRole ?? "observer";
  const canAct = walletRole === role;
  const expired = Date.now() > nsToDate(e.deadline_ns).getTime();

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(true); setMsg({ text: `${label}: confirm in your wallet…` });
    try { const o = (await fn()) as { transaction?: { hash?: string } } | void; setMsg({ text: `${label} sent.`, tx: o?.transaction?.hash, ok: true }); await load(); }
    catch (x) { setMsg({ text: `${label} failed: ${x instanceof Error ? x.message : String(x)}` }); }
    finally { setBusy(false); }
  }
  async function runVerifier() {
    setBusy(true); setMsg({ text: "AI verifier is reviewing the deliverable against the spec…" });
    try {
      const r = await fetch("/api/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      if (j.signed) { setMsg({ text: `${j.verdict.approved ? "Approved" : "Rejected"} by ${j.model}: ${j.verdict.reason}`, tx: j.txHash, ok: true }); await load(); }
      else if (canAct) { await act("attest (wallet)", () => call("attest", j.attestArgs)); }
      else setMsg({ text: `${j.note} Verdict: ${j.verdict.approved ? "approve" : "reject"} — ${j.verdict.reason}` });
    } catch (x) { setMsg({ text: `Verifier failed: ${x instanceof Error ? x.message : String(x)}` }); }
    finally { setBusy(false); }
  }

  return <div className="grid2"><div>
    <h1>Escrow #{e.id} <StatusBadge s={e.status} /></h1>
    <p className="big">{yoctoToNear(e.amount)} NEAR</p>
    <div className="tabs">{(["payer", "recipient", "verifier", "observer"] as Role[]).map((r) => <button key={r} className={r === role ? "active" : ""} onClick={() => setView(r)}>{r}{r === walletRole ? " (you)" : r === linkRole ? " (link)" : ""}</button>)}</div>
    <div className="card"><p>{EXPLAIN[role]}</p>
      {!accountId && role !== "observer" && <button className="btn" onClick={signIn}>Connect wallet to act as {role}</button>}
      {accountId && role !== "observer" && !canAct && <p className="muted">Connected as {accountId}, which is not the {role}. Actions are disabled.</p>}
      {canAct && role === "payer" && e.status === "Created" && <button className="btn" disabled={busy} onClick={() => { const n = prompt("Amount to deposit (NEAR)"); if (n) void act("fund", async () => call("fund", { id }, (await import("@/lib/near-format")).nearToYocto(n))); }}>Fund escrow</button>}
      {canAct && role === "recipient" && e.status === "Funded" && <div className="form"><textarea value={deliverable} onChange={(x) => setDeliverable(x.target.value)} maxLength={1800} placeholder="Deliverable: link, e-ticket / PNR, or description with evidence" /><button className="btn" disabled={busy || !deliverable.trim()} onClick={() => void act("submit", () => call("submit", { id, deliverable }))}>Submit deliverable</button></div>}
      {e.status === "Submitted" && (role === "verifier" || role === "payer") && <button className="btn" disabled={busy} onClick={() => void runVerifier()}>Run AI verifier and record attestation</button>}
      {canAct && e.status === "Verified" && <button className="btn" disabled={busy} onClick={() => void act("release", () => call("release", { id }))}>Release {yoctoToNear(e.amount)} NEAR to {e.recipient}</button>}
      {canAct && ((role === "payer" && (e.status === "Rejected" || e.status === "Created" || (expired && (e.status === "Funded" || e.status === "Submitted")))) || (role === "verifier" && e.status === "Rejected")) && <button className="btn ghost" disabled={busy} onClick={() => void act("refund", () => call("refund", { id }))}>Refund payer</button>}
      {msg && <p className={msg.ok ? "ok" : "muted"}>{msg.text} {msg.tx && <a href={explorerTx(msg.tx)} target="_blank" rel="noreferrer">view tx</a>}</p>}
    </div>
    <h3>Specification</h3><pre className="spec">{e.spec}</pre>
    <h3>Deliverable</h3>{e.deliverable ? <pre className="spec">{e.deliverable}</pre> : <p className="muted">Not submitted yet.</p>}
    <h3>AI attestation</h3>{e.attestation ? <div className={`card ${e.attestation.approved ? "okc" : "errc"}`}><b>{e.attestation.approved ? "Approved" : "Rejected"}</b> — {e.attestation.reason}<p className="muted">model {e.attestation.model} · report sha256 {e.attestation.report_hash.slice(0, 16)}… · signed by {e.attestation.attested_by} · {nsToDate(e.attestation.at_ns).toLocaleString()}</p></div> : <p className="muted">No attestation yet. Release is impossible until one exists.</p>}
  </div><aside className="side">
    <div className="card"><div className="kicker">Timeline</div><Timeline e={e} /></div>
    <div className="card"><div className="kicker">Parties</div><dl className="kv">
      <dt>Payer</dt><dd><a href={explorerAccount(e.payer)} target="_blank" rel="noreferrer">{e.payer}</a></dd>
      <dt>Recipient</dt><dd><a href={explorerAccount(e.recipient)} target="_blank" rel="noreferrer">{e.recipient}</a></dd>
      <dt>Verifier</dt><dd><a href={explorerAccount(e.verifier)} target="_blank" rel="noreferrer">{e.verifier}</a></dd>
      <dt>Deadline</dt><dd>{nsToDate(e.deadline_ns).toLocaleString()}{expired ? " (passed)" : ""}</dd>
      <dt>Contract</dt><dd><a href={explorerAccount(CONTRACT_ID)} target="_blank" rel="noreferrer">{CONTRACT_ID}</a></dd></dl></div>
    <div className="card"><div className="kicker">Share per-party links</div>
      <p className="muted">HMAC-signed links open the right view. They carry no on-chain authority; every action needs that party&apos;s wallet.</p>
      <button className="btn sm" onClick={async () => { const r = await fetch("/api/links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); const j = await r.json(); if (r.ok) setLinks(j.links); else setMsg({ text: j.error }); }}>Generate links</button>
      {links.map((l) => <p key={l.role}><b>{l.role}</b> <input readOnly value={l.url} onFocus={(x) => x.target.select()} /></p>)}</div>
  </aside></div>;
}
