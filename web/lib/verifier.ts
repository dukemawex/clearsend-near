import "server-only";
import { createHash } from "crypto";
import { generateText } from "ai";
import { models } from "./ai";
import type { Escrow } from "./types";

export type Verdict = { approved: boolean; reason: string; checklist: { requirement: string; met: boolean; evidence: string }[] };

const SYSTEM = `You are an impartial escrow verifier. Compare the DELIVERABLE to the payer's SPEC.
Return ONLY a JSON object: {"approved": boolean, "reason": string (<= 300 chars), "checklist": [{"requirement": string, "met": boolean, "evidence": string}]}.
Approve only if every concrete requirement in SPEC is evidenced by DELIVERABLE. If the deliverable is only a link you cannot open, judge only what the text shows and say so. Never invent evidence.`;

export function parseVerdict(text: string): Verdict {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("verifier model did not return JSON");
  const j = JSON.parse(m[0]);
  if (typeof j.approved !== "boolean" || typeof j.reason !== "string") throw new Error("verifier JSON missing approved/reason");
  return { approved: j.approved, reason: j.reason.slice(0, 900), checklist: Array.isArray(j.checklist) ? j.checklist.slice(0, 20) : [] };
}

export async function verifyDeliverable(e: Escrow) {
  if (e.status !== "Submitted" || !e.deliverable) throw new Error(`escrow ${e.id} is ${e.status}; verification needs a submitted deliverable`);
  const list = models();
  if (!list.length) throw new Error("No free model configured: set OPENROUTER_API_KEY (or NEARAI_API_KEY + NEARAI_MODEL)");
  let last: unknown;
  for (const m of list) {
    try {
      const { text } = await generateText({ model: m.model, system: SYSTEM, prompt: `SPEC:\n${e.spec}\n\nDELIVERABLE:\n${e.deliverable}`, maxOutputTokens: 800, temperature: 0 });
      const verdict = parseVerdict(text);
      const report = JSON.stringify({ escrow: e.id, contract: process.env.NEXT_PUBLIC_ESCROW_CONTRACT, model: m.id, spec: e.spec, deliverable: e.deliverable, verdict });
      return { verdict, model: m.id, report, reportHash: createHash("sha256").update(report).digest("hex") };
    } catch (err) { last = err; }
  }
  throw new Error(`All free models failed: ${last instanceof Error ? last.message : String(last)}`);
}
