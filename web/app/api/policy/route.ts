import { NextResponse } from "next/server";
import { accessKeys } from "@/lib/near";
import { CONTRACT_ID, VERIFIER_ID } from "@/lib/config";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const keys = await accessKeys();
    return NextResponse.json({ account: VERIFIER_ID, contract: CONTRACT_ID, keys: keys.map((k) => ({ publicKey: k.public_key, nonce: String(k.access_key.nonce), permission: k.access_key.permission })) });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 }); }
}
