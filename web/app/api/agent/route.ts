import { NextResponse } from "next/server";
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { buildTools, collectOffers, SYSTEM_PROMPT } from "@/lib/agent";
import { models } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.messages)) return NextResponse.json({ error: "messages must be an array" }, { status: 400 });
  const list = models();
  if (!list.length) return NextResponse.json({ error: "No free model configured. Set OPENROUTER_API_KEY." }, { status: 503 });
  const ui = body.messages as UIMessage[];
  const tools = buildTools({ offers: collectOffers(ui) });
  const messages = await convertToModelMessages(ui);
  const idx = Math.min(Number(req.headers.get("x-model-index") ?? 0) || 0, list.length - 1);
  const m = list[idx];
  const result = streamText({ model: m.model, system: SYSTEM_PROMPT, messages, tools, stopWhen: stepCountIs(6), maxOutputTokens: 1200 });
  return result.toUIMessageStreamResponse({
    messageMetadata: () => ({ model: m.id }),
    onError: (e) => `${m.id} failed: ${e instanceof Error ? e.message : String(e)}`,
  });
}
