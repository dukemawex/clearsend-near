"use client";
import { useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ProposalCard, type Proposal } from "./ProposalCard";

type Offer = { id: string; provider: string; airline: string; origin: string; destination: string; depart: string; arrive: string; stops: number; duration?: string; price: number | null; currency: string; scheduleOnly?: boolean; isCheapest?: boolean };
type Part = { type: string; text?: string; state?: string; output?: Record<string, unknown>; errorText?: string };

const starters = [
  "Find flights from Lagos to London on 2026-12-15",
  "Create an escrow: 2 NEAR to a translator for a 1-page English→French contract",
  "Quote paying out 10 NEAR as USDC on Arbitrum",
  "Show my escrows",
];

function ToolPart({ p, send }: { p: Part; send: (t: string) => void }) {
  const name = p.type.replace(/^tool-/, "");
  if (p.state === "output-error") return <div className="tool err">{name}: {p.errorText}</div>;
  if (p.state !== "output-available") return <div className="tool muted">running {name}…</div>;
  const o = p.output ?? {};
  if (name === "searchFlights") {
    const opts = (o.options as Offer[]) ?? [];
    if (!opts.length) return <div className="tool">No flights found ({String(o.message ?? "all providers empty")}).</div>;
    return <div className="tool flights"><div className="kicker">{String(o.provider)} · {String(o.origin)}→{String(o.destination)} · {String(o.dateUsed ?? "")}</div>
      {opts.slice(0, 6).map((f) => <div key={f.id} className="flight">
        <div><b>{f.airline}</b> <span className="muted">{f.origin}→{f.destination} · {f.depart?.slice(0, 16).replace("T", " ")} · {f.stops} stop(s){f.duration ? ` · ${f.duration}` : ""}</span></div>
        {f.price == null || f.scheduleOnly ? <span className="pill muted">schedule only · fare unavailable · {f.provider}</span>
          : <button className="btn sm" onClick={() => send(`I choose offer ${f.id} (${f.airline}, ${f.price} ${f.currency}).`)}>{f.price} {f.currency} · choose</button>}
      </div>)}</div>;
  }
  if (name === "prepareFlightEscrow" || name === "prepareEscrow") return <ProposalCard p={o as unknown as Proposal} />;
  if (name === "priceFlightBooking") { const b = o.breakdown as Record<string, number | string>; return <div className="tool">Price: {b.totalFare} {b.currency} incl. 2.5% fee ≈ ${b.totalUsd} ≈ <b>{b.totalNear} NEAR</b> <span className="muted">(FX {b.fxSource}, NEAR price 1Click)</span></div>; }
  if (name === "payoutQuote") { const q = o.quote as Record<string, string>; return <div className="tool">1Click {o.dry ? "dry-run " : ""}quote: {q.amountInFormatted} NEAR → <b>{q.amountOutFormatted}</b> {String(o.destination)} (≈${Number(q.amountOutUsd).toFixed(2)}, ~{q.timeEstimate}s)</div>; }
  return <div className="tool muted">{name} ✓</div>;
}

export function Chat() {
  const [modelIndex, setModelIndex] = useState(0);
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/agent", headers: { "x-model-index": String(modelIndex) } }), [modelIndex]);
  const { messages, sendMessage, status, error, regenerate } = useChat({ transport });
  const [input, setInput] = useState("");
  const busy = status === "submitted" || status === "streaming";
  const send = (t: string) => { if (!busy && t.trim()) void sendMessage({ text: t }); };
  return <section className="chat">
    {messages.length === 0 && <div className="empty"><h2>Tell the agent what you need to pay for.</h2><p>Flights are searched on real data. Money only moves when you sign in your NEAR wallet, and escrow release requires an on-chain AI attestation.</p>
      <div className="chips">{starters.map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}</div></div>}
    {messages.map((m) => <div key={m.id} className={`msg ${m.role}`}>
      {(m.parts as Part[]).map((p, i) => p.type === "text" ? <p key={i} style={{ whiteSpace: "pre-wrap" }}>{p.text}</p> : p.type.startsWith("tool-") ? <ToolPart key={i} p={p} send={send} /> : null)}
    </div>)}
    {busy && <div className="muted">Agent is working…</div>}
    {error && <div className="err">{error.message} <button className="btn sm" onClick={() => { setModelIndex((i) => i + 1); setTimeout(() => void regenerate(), 0); }}>Retry with fallback model</button></div>}
    <form className="composer" onSubmit={(e) => { e.preventDefault(); send(input); setInput(""); }}>
      <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); setInput(""); } }} placeholder="e.g. Book me Lagos → Nairobi next Friday and settle through escrow" />
      <button className="btn" disabled={busy || !input.trim()}>Send</button>
    </form>
  </section>;
}
