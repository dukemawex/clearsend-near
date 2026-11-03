import { YOCTO } from "./config";
export function nearToYocto(near: string | number): string {
  const s = String(near).trim();
  if (!/^\d+(\.\d{0,24})?$/.test(s)) throw new Error(`invalid NEAR amount: ${s}`);
  const [w, f = ""] = s.split(".");
  return (BigInt(w) * YOCTO + BigInt((f + "0".repeat(24)).slice(0, 24))).toString();
}
export function yoctoToNear(yocto: string, digits = 4): string {
  const v = BigInt(yocto || "0");
  const w = v / YOCTO;
  const f = (v % YOCTO).toString().padStart(24, "0").slice(0, digits).replace(/0+$/, "");
  return f ? `${w}.${f}` : `${w}`;
}
export const nsToDate = (ns: string) => new Date(Number(BigInt(ns) / BigInt(1_000_000)));
