import "./globals.css";
import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { WalletProvider } from "@/components/Wallet";
export const metadata: Metadata = { title: "ClearSend Intents", description: "Cross-border payments and travel settled through a NEAR escrow with on-chain AI verification" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><WalletProvider><Nav /><main className="wrap">{children}</main></WalletProvider></body></html>;
}
