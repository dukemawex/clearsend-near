import { NextResponse } from "next/server";
import { searchFlights } from "@/lib/flights";
export const maxDuration = 60;
export async function GET(req: Request) {
  const u = new URL(req.url);
  const origin = u.searchParams.get("origin"), destination = u.searchParams.get("destination"), date = u.searchParams.get("date") ?? undefined;
  if (!origin || !destination) return NextResponse.json({ error: "origin and destination required" }, { status: 400 });
  try { return NextResponse.json(await searchFlights({ origin, destination, date })); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 }); }
}
