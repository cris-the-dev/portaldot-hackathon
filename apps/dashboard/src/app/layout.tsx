import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Nav } from "@/components/nav";
import { WalletBar } from "@/components/wallet";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "PortalKit Dashboard",
  description: "Deploy, call and inspect EVM contracts on Portaldot.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <Providers>
          <header className="border-b border-border bg-panel">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-6">
                <span className="font-semibold">
                  Portal<span className="text-accent">Kit</span>
                </span>
                <Nav />
              </div>
              <WalletBar />
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
