import { explorerAccount } from "@/lib/config";
import { nsToDate } from "@/lib/near-format";
import type { Escrow, Status } from "@/lib/types";
const ORDER: Status[] = ["Created", "Funded", "Submitted", "Verified", "Released"];
export function StatusBadge({ s }: { s: Status }) { return <span className={`badge s-${s.toLowerCase()}`}>{s}</span>; }
export function Timeline({ e }: { e: Escrow }) {
  const done = new Map(e.history.map((h) => [h.status, h]));
  const steps: Status[] = e.status === "Rejected" || e.status === "Refunded" ? [...e.history.map((h) => h.status)] : ORDER;
  return <ol className="timeline">{steps.map((s, i) => { const h = done.get(s); return <li key={s + i} className={h ? "done" : "todo"}>
    <b>{s}</b>{h ? <span> by <a href={explorerAccount(h.by)} target="_blank" rel="noreferrer">{h.by}</a> · {nsToDate(h.at_ns).toLocaleString()}</span> : <span className="muted"> pending</span>}</li>; })}</ol>;
}
