import "server-only";
import { createOpenAI } from "@ai-sdk/openai";

// Verifier / agent model provider. Default: Meta Model API (OpenAI-compatible).
// Configure with MODEL_API_KEY, VERIFIER_BASE_URL, VERIFIER_MODEL, VERIFIER_FALLBACK_MODEL.
const BASE_URL = process.env.VERIFIER_BASE_URL ?? "https://api.meta.ai/v1";
const provider = createOpenAI({ apiKey: process.env.MODEL_API_KEY ?? "missing", baseURL: BASE_URL });
const nearai = createOpenAI({ apiKey: process.env.NEARAI_API_KEY ?? "missing", baseURL: process.env.NEARAI_BASE_URL ?? "https://cloud-api.near.ai/v1" });

export function models() {
  const list: { name: string; id: string; model: ReturnType<typeof provider.chat> }[] = [];
  if (process.env.MODEL_API_KEY) {
    const primary = process.env.VERIFIER_MODEL ?? "muse-spark-1.3";
    const fallback = process.env.VERIFIER_FALLBACK_MODEL ?? "muse-spark-1.2";
    for (const id of new Set([primary, fallback].filter(Boolean))) list.push({ name: BASE_URL.includes("api.meta.ai") ? "meta-model-api" : "openai-compatible", id, model: provider.chat(id) });
  }
  if (process.env.NEARAI_API_KEY && process.env.NEARAI_MODEL) list.push({ name: "near-ai-cloud", id: process.env.NEARAI_MODEL, model: nearai.chat(process.env.NEARAI_MODEL) });
  return list;
}
