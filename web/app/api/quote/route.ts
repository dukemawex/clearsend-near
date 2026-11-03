import { NextResponse } from "next/server";
import { dryQuote } from "@/lib/intents";
import { resolveAsset } from "@/lib/agent";
import { nearToYocto } from "@/lib/near-format";
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  try {
    const t = await resolveAsset(String(b.destination));
    const q = await dryQuote({ amountYocto: nearToYocto(String(b.amountNear)), destinationAsset: t.assetId, recipient: String(b.recipient), refundTo: String(b.refundTo) });
    return NextResponse.json({ asset: t, ...q });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 }); }
}
