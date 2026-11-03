import "server-only";
import { createOpenAI } from "@ai-sdk/openai";

const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY ?? "missing",
  baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  headers: { "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000", "X-Title": "ClearSend Intents" },
});
const nearai = createOpenAI({ apiKey: process.env.NEARAI_API_KEY ?? "missing", baseURL: process.env.NEARAI_BASE_URL ?? "https://cloud-api.near.ai/v1" });

/** Free models only: OpenRouter :free models, plus NEAR AI Cloud when its key is provided. */
export function models() {
  const list: { name: string; id: string; model: ReturnType<typeof openrouter.chat> }[] = [];
  if (process.env.OPENROUTER_API_KEY) {
    const primary = process.env.OPENROUTER_MODEL ?? "nvidia/nemotron-3-ultra-550b-a55b:free";
    const fallback = process.env.OPENROUTER_FALLBACK_MODEL ?? "google/gemma-4-31b-it:free";
    for (const id of [primary, fallback]) {
      if (!id.endsWith(":free")) continue; // refuse paid models
      list.push({ name: "openrouter", id, model: openrouter.chat(id) });
    }
  }
  if (process.env.NEARAI_API_KEY && process.env.NEARAI_MODEL) list.push({ name: "near-ai-cloud", id: process.env.NEARAI_MODEL, model: nearai.chat(process.env.NEARAI_MODEL) });
  return list;
}
