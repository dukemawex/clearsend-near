import "server-only";
import { createHash } from "crypto";
import { generateText } from "ai";
import { models } from "./ai";
import type { Escrow } from "./types";
import { parseVerdict } from "./verdict";
export type { Verdict } from "./verdict";

const SYSTEM = `You are an impartial escrow verifier. Compare the DELIVERABLE to the payer's SPEC.
Return ONLY a JSON object: {"approved": boolean, "reason": string (<= 300 chars), "checklist": [{"requirement": string, "met": boolean, "evidence": string}]}.
Approve only if every concrete requirement in SPEC is evidenced by DELIVERABLE. If the deliverable is only a link you cannot open, judge only what the text shows and say so. Never invent evidence.`;

export async function verifyDeliverable(e: Escrow) {
  if (e.status !== "Submitted" || !e.deliverable) throw new Error(`escrow ${e.id} is ${e.status}; verification needs a submitted deliverable`);
  const list = models();
  if (!list.length) throw new Error("No model configured: set MODEL_API_KEY (Meta Model API) or NEARAI_API_KEY + NEARAI_MODEL");
  let last: unknown;
  for (const m of list) {
    try {
      const { text } = await generateText({ model: m.model, system: SYSTEM, prompt: `SPEC:\n${e.spec}\n\nDELIVERABLE:\n${e.deliverable}`, maxOutputTokens: 4000, temperature: 0 });
      const verdict = parseVerdict(text);
      const report = JSON.stringify({ escrow: e.id, contract: process.env.NEXT_PUBLIC_ESCROW_CONTRACT, model: m.id, spec: e.spec, deliverable: e.deliverable, verdict });
      return { verdict, model: m.id, report, reportHash: createHash("sha256").update(report).digest("hex") };
    } catch (err) { last = err; }
  }
  throw new Error(`All configured models failed: ${last instanceof Error ? last.message : String(last)}`);
}
