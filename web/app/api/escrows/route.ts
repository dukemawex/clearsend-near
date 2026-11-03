import { NextResponse } from "next/server";
import { listEscrows, listForAccount } from "@/lib/near";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const account = new URL(req.url).searchParams.get("account");
  try { return NextResponse.json({ escrows: account ? await listForAccount(account) : await listEscrows(0, 100) }); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : String(e), escrows: [] }, { status: 502 }); }
}
