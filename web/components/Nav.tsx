"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "./Wallet";
import { NETWORK } from "@/lib/config";
const links = [["/", "Agent"], ["/dashboard", "Escrows"], ["/escrow/new", "New escrow"], ["/trips", "Trips"], ["/payout", "Payout quote"], ["/policy", "Agent policy"], ["/judges", "Judges"]];
export function Nav() {
  const p = usePathname();
  return <header className="nav"><Link href="/" className="brand"><span className="logo">◈</span> ClearSend <em>Intents</em></Link>
    <nav>{links.map(([h, l]) => <Link key={h} href={h} className={p === h ? "active" : ""}>{l}</Link>)}</nav>
    <div className="nav-right"><span className="pill net">NEAR {NETWORK}</span><WalletButton /></div></header>;
}
