import "server-only";
import { Account, KeyPairSigner, providers, transactions } from "near-api-js";
import { CONTRACT_ID, RPC_URL, VERIFIER_ID } from "./config";
import type { Escrow } from "./types";

export const provider = new providers.JsonRpcProvider({ url: RPC_URL });

function requireContract() {
  if (!CONTRACT_ID) throw new Error("NEXT_PUBLIC_ESCROW_CONTRACT is not set");
  return CONTRACT_ID;
}

export async function view<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
  return (await provider.callFunction(requireContract(), method, args)) as T;
}

export const getEscrow = (id: string) => view<Escrow | null>("get_escrow", { id });
export const listEscrows = (from = 0, limit = 50) => view<Escrow[]>("list_escrows", { from_index: String(from), limit: String(limit) });
export const listForAccount = (account_id: string) => view<Escrow[]>("list_for_account", { account_id, limit: "100" });

export async function accessKeys(accountId = VERIFIER_ID) {
  if (!accountId) throw new Error("NEXT_PUBLIC_VERIFIER_ACCOUNT is not set");
  const res = await provider.viewAccessKeyList(accountId);
  return res.keys;
}

/** True when the server holds a restricted agent key for the verifier account. */
export const agentConfigured = () => Boolean(process.env.AGENT_PRIVATE_KEY && VERIFIER_ID && CONTRACT_ID);

/** Sign `attest` with the agent's function-call key. Returns tx hash. */
export async function signAttestation(args: { id: string; approved: boolean; reason: string; model: string; report_hash: string }) {
  const sk = process.env.AGENT_PRIVATE_KEY;
  if (!sk || !VERIFIER_ID) throw new Error("AGENT_PRIVATE_KEY / NEXT_PUBLIC_VERIFIER_ACCOUNT not configured; attestation must be signed by the verifier in their wallet");
  const signer = KeyPairSigner.fromSecretKey(sk as `ed25519:${string}`);
  const account = new Account(VERIFIER_ID, provider, signer);
  const outcome = await account.signAndSendTransaction({
    receiverId: requireContract(),
    actions: [
      transactions.functionCall("attest", args, BigInt(30_000_000_000_000), BigInt(0)),
    ],
  });
  const status = outcome.status as { Failure?: unknown };
  if (status && typeof status === "object" && "Failure" in status) throw new Error(`attest failed on-chain: ${JSON.stringify(status.Failure)}`);
  return outcome.transaction.hash as string;
}
