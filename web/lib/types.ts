export type Status = "Created" | "Funded" | "Submitted" | "Verified" | "Rejected" | "Released" | "Refunded";
export type Attestation = { approved: boolean; reason: string; model: string; report_hash: string; attested_by: string; at_ns: string };
export type EscrowEvent = { status: Status; by: string; at_ns: string };
export type Escrow = {
  id: string; payer: string; recipient: string; verifier: string; spec: string; amount: string;
  deliverable: string | null; attestation: Attestation | null; status: Status;
  created_at_ns: string; deadline_ns: string; storage_paid: string; history: EscrowEvent[];
};
export type Role = "payer" | "recipient" | "verifier" | "observer";
export const FLIGHT_PREFIX = "FLIGHT|";
