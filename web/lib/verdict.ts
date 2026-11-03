export type Verdict = { approved: boolean; reason: string; checklist: { requirement: string; met: boolean; evidence: string }[] };

export function parseVerdict(text: string): Verdict {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("verifier model did not return JSON");
  const j = JSON.parse(m[0]);
  if (typeof j.approved !== "boolean" || typeof j.reason !== "string") throw new Error("verifier JSON missing approved/reason");
  return { approved: j.approved, reason: j.reason.slice(0, 900), checklist: Array.isArray(j.checklist) ? j.checklist.slice(0, 20) : [] };
}

