export const NETWORK = (process.env.NEXT_PUBLIC_NEAR_NETWORK ?? "testnet") as "testnet" | "mainnet";
export const CONTRACT_ID = process.env.NEXT_PUBLIC_ESCROW_CONTRACT ?? "";
export const VERIFIER_ID = process.env.NEXT_PUBLIC_VERIFIER_ACCOUNT ?? "";
export const RPC_URL = process.env.NEXT_PUBLIC_NEAR_RPC ?? (NETWORK === "mainnet" ? "https://rpc.mainnet.fastnear.com" : "https://rpc.testnet.fastnear.com");
export const EXPLORER = NETWORK === "mainnet" ? "https://nearblocks.io" : "https://testnet.nearblocks.io";
export const explorerTx = (hash: string) => `${EXPLORER}/txns/${hash}`;
export const explorerAccount = (id: string) => `${EXPLORER}/address/${id}`;
export const FEE_RATE = 0.025;
export const YOCTO = BigInt("1000000000000000000000000");
export const STORAGE_DEPOSIT = "100000000000000000000000"; // 0.1 NEAR; contract refunds the unused part
