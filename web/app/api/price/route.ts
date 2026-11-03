import { NextResponse } from "next/server";
import { fareBreakdown } from "@/lib/pricing";
export async function GET(req: Request) {
  const u = new URL(req.url);
  try { return NextResponse.json(await fareBreakdown(Number(u.searchParams.get("fare")), u.searchParams.get("currency") ?? "USD", Number(u.searchParams.get("travellers") ?? 1))); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 }); }
}
