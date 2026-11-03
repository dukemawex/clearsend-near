import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import type { Role } from "./types";

// Role links are a convenience for sharing the right per-party view. They grant NO
// on-chain authority: every state change is signed by the party's own NEAR wallet.
function secret(): string {
  const s = process.env.ESCROW_LINK_SECRET;
  if (!s) throw new Error("ESCROW_LINK_SECRET is not set");
  return s;
}
export function signRole(id: string, role: Role) {
  return createHmac("sha256", secret()).update(`${id}:${role}`).digest("hex");
}
export function verifyRole(id: string, role: Role, token: string) {
  try {
    const a = Buffer.from(signRole(id, role)); const b = Buffer.from(token || "");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}
export function roleLinks(id: string, base: string) {
  return (["payer", "recipient", "verifier"] as const).map((role) => ({ role, url: `${base}/escrow/${id}?role=${role}&token=${signRole(id, role)}` }));
}
