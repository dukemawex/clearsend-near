import "server-only";

// Simple per-IP fixed-window limiter plus a global daily cap, to stop anyone burning the model key.
// In-memory per serverless instance: good enough for a hackathon demo, not a hard guarantee.
const hits = new Map<string, { n: number; reset: number }>();
let day = { n: 0, reset: 0 };

export function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

export function rateLimit(req: Request, bucket: string, max: number, windowMs: number, dailyMax = Number(process.env.AI_DAILY_CAP ?? 300)) {
  const now = Date.now();
  if (now > day.reset) day = { n: 0, reset: now + 86_400_000 };
  if (day.n >= dailyMax) return { ok: false, retryAfter: Math.ceil((day.reset - now) / 1000), reason: "daily AI budget for this demo reached" };
  const key = `${bucket}:${clientIp(req)}`;
  const h = hits.get(key);
  if (!h || now > h.reset) hits.set(key, { n: 1, reset: now + windowMs });
  else if (h.n >= max) return { ok: false, retryAfter: Math.ceil((h.reset - now) / 1000), reason: "too many requests from your IP" };
  else h.n++;
  day.n++;
  if (hits.size > 5000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
  return { ok: true as const };
}
