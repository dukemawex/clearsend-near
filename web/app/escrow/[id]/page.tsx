import { EscrowDetail } from "@/components/EscrowDetail";
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ role?: string; token?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  return <EscrowDetail id={id} role={sp.role} token={sp.token} />;
}
