"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "./Wallet";
import { StatusBadge } from "./Timeline";
import { yoctoToNear } from "@/lib/near-format";
import { FLIGHT_PREFIX, type Escrow } from "@/lib/types";

export function EscrowList({ flightsOnly = false }: { flightsOnly?: boolean }) {
  const { accountId } = useWallet();
  const [mine, setMine] = useState(false);
  const [data, setData] = useState<{ escrows: Escrow[]; error?: string } | null>(null);
  useEffect(() => {
    setData(null);
    fetch(`/api/escrows${mine && accountId ? `?account=${accountId}` : ""}`).then((r) => r.json()).then(setData).catch((e) => setData({ escrows: [], error: String(e) }));
  }, [mine, accountId]);
  const rows = (data?.escrows ?? []).filter((e) => !flightsOnly || e.spec.startsWith(FLIGHT_PREFIX)).reverse();
  const total = rows.reduce((a, e) => a + BigInt(e.amount), BigInt(0));
  return <div>
    <div className="row">{accountId && <label className="check"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> only where I am a party ({accountId})</label>}
      <span className="muted">{rows.length} {flightsOnly ? "trips" : "escrows"} · {yoctoToNear(total.toString())} NEAR total · read live from the contract</span></div>
    {!data && <p className="muted">Loading from NEAR RPC…</p>}
    {data?.error && <p className="err">Could not read the contract: {data.error}</p>}
    {data && !data.error && rows.length === 0 && <div className="empty"><p>{flightsOnly ? "No flight escrows yet. Ask the agent to find and book a flight." : "No escrows on this contract yet."} <Link href={flightsOnly ? "/" : "/escrow/new"}>Create one →</Link></p></div>}
    <table className="list"><tbody>{rows.map((e) => <tr key={e.id}>
      <td><Link href={`/escrow/${e.id}`}>#{e.id}</Link></td><td><StatusBadge s={e.status} /></td>
      <td className="clip">{e.spec.startsWith(FLIGHT_PREFIX) ? e.spec.split("\n")[0].split("|").slice(1, 4).join(" · ") : e.spec}</td>
      <td>{yoctoToNear(e.amount)} NEAR</td><td className="muted">{e.payer} → {e.recipient}</td></tr>)}</tbody></table>
  </div>;
}
