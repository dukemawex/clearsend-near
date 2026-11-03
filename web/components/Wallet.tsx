"use client";
import "@near-wallet-selector/modal-ui/styles.css";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { actionCreators, setupWalletSelector, type WalletSelector } from "@near-wallet-selector/core";
import { setupModal, type WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { setupHereWallet } from "@near-wallet-selector/here-wallet";
import { CONTRACT_ID, NETWORK } from "@/lib/config";

type Outcome = { transaction?: { hash?: string }; status?: { SuccessValue?: string; Failure?: unknown } } | void;
type Ctx = {
  accountId: string | null; ready: boolean;
  signIn: () => void; signOut: () => Promise<void>;
  call: (method: string, args: object, depositYocto?: string, gasTgas?: number) => Promise<Outcome>;
};
const WalletCtx = createContext<Ctx>({ accountId: null, ready: false, signIn: () => {}, signOut: async () => {}, call: async () => {} });
export const useWallet = () => useContext(WalletCtx);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [selector, setSelector] = useState<WalletSelector>();
  const [modal, setModal] = useState<WalletSelectorModal>();
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      const s = await setupWalletSelector({ network: NETWORK, modules: [setupMyNearWallet(), setupMeteorWallet(), setupHereWallet()] });
      setSelector(s);
      setModal(setupModal(s, { contractId: CONTRACT_ID }));
      const sync = () => setAccountId(s.store.getState().accounts.find((a) => a.active)?.accountId ?? null);
      sync();
      unsub = s.store.observable.subscribe(sync).unsubscribe;
    })().catch((e) => console.error("wallet selector failed", e));
    return () => unsub?.();
  }, []);

  const call = useCallback(async (method: string, args: object, depositYocto = "0", gasTgas = 50) => {
    if (!selector) throw new Error("wallet not ready");
    if (!CONTRACT_ID) throw new Error("NEXT_PUBLIC_ESCROW_CONTRACT not configured");
    const wallet = await selector.wallet();
    return (await wallet.signAndSendTransaction({
      receiverId: CONTRACT_ID,
      actions: [actionCreators.functionCall(method, args, BigInt(gasTgas) * BigInt(1e12), BigInt(depositYocto))],
    })) as Outcome;
  }, [selector]);

  const signOut = useCallback(async () => { if (selector) await (await selector.wallet()).signOut(); }, [selector]);

  return <WalletCtx.Provider value={{ accountId, ready: Boolean(selector), signIn: () => modal?.show(), signOut, call }}>{children}</WalletCtx.Provider>;
}

export function WalletButton() {
  const { accountId, ready, signIn, signOut } = useWallet();
  if (!ready) return <span className="pill muted">wallet…</span>;
  return accountId
    ? <button className="pill" onClick={() => void signOut()} title="Sign out">{accountId} · sign out</button>
    : <button className="btn" onClick={signIn}>Connect NEAR wallet</button>;
}

export function decodeReturn(o: Outcome): unknown {
  const v = o && o.status && "SuccessValue" in o.status ? o.status.SuccessValue : undefined;
  if (!v) return undefined;
  try { return JSON.parse(atob(v)); } catch { return undefined; }
}
