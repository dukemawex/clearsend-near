import { NextResponse } from "next/server";
import { getEscrow } from "@/lib/near";
import { verifyRole } from "@/lib/escrow-links";
import type { Role } from "@/lib/types";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "id must be an integer" }, { status: 400 });
  try {
    const escrow = await getEscrow(id);
    if (!escrow) return NextResponse.json({ error: `escrow ${id} not found on-chain` }, { status: 404 });
    const u = new URL(req.url); const role = u.searchParams.get("role") as Role | null; const token = u.searchParams.get("token") ?? "";
    let linkRole: Role | null = null;
    if (role && token) { try { linkRole = verifyRole(id, role, token) ? role : null; } catch { linkRole = null; } }
    return NextResponse.json({ escrow, linkRole });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 }); }
}
