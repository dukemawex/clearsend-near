import { NextResponse } from "next/server";
import { roleLinks } from "@/lib/escrow-links";
import { getEscrow } from "@/lib/near";
export async function POST(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== "string" || !/^\d+$/.test(id)) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    if (!(await getEscrow(id))) return NextResponse.json({ error: "escrow not found" }, { status: 404 });
    return NextResponse.json({ links: roleLinks(id, new URL(req.url).origin) });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 503 }); }
}
