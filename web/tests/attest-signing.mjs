// Live check that the agent's function-call key signs on testnet and that the
// contract (not the server) enforces the rules. Calls attest on a non-existent
// escrow id: expected result is an on-chain panic "escrow not found", proving the
// key works for `attest` without recording any verdict. Then tries `release` with
// the same key: expected rejection by the protocol (method not allowed).
// Usage: node --env-file=.env.local tests/attest-signing.mjs
import { Account, KeyPairSigner, providers, transactions } from "near-api-js";
const provider = new providers.JsonRpcProvider({ url: process.env.NEXT_PUBLIC_NEAR_RPC ?? "https://rpc.testnet.fastnear.com" });
const acct = new Account(process.env.NEXT_PUBLIC_VERIFIER_ACCOUNT, provider, KeyPairSigner.fromSecretKey(process.env.AGENT_PRIVATE_KEY));
const C = process.env.NEXT_PUBLIC_ESCROW_CONTRACT;
async function attempt(method, args) {
  try {
    const o = await acct.signAndSendTransaction({ receiverId: C, actions: [transactions.functionCall(method, args, 30000000000000n, 0n)] });
    console.log(method, "tx", o.transaction.hash, JSON.stringify(o.status).slice(0, 200));
  } catch (e) { console.log(method, "rejected:", String(e.message ?? e).slice(0, 200)); }
}
await attempt("attest", { id: "999999", approved: false, reason: "key check", model: "none", report_hash: "none" });
await attempt("release", { id: "0" });
