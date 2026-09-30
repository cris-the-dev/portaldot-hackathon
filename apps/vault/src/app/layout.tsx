import type { Metadata } from "next";
import type { ReactNode } from "react";
import { WalletBar } from "@/components/wallet";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "PortalVault",
  description: "Tokenized RWA vault (ERC-4626) on Portaldot, built with PortalKit.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <Providers>
          <header className="border-b border-border bg-panel">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="font-semibold">
                Portal<span className="text-accent">Vault</span>
                <span className="ml-2 text-xs font-normal text-muted">built with PortalKit</span>
              </span>
              <WalletBar />
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
