"use client";

import { useSyncExternalStore } from "react";
import type { Chain } from "viem";
import { useConnection } from "wagmi";
import { configuredChains } from "./wagmi";

const subscribe = () => () => {};

/** false during SSR/hydration, true afterwards — gate wallet-dependent UI on it. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

/**
 * The chain the dashboard works against: the wallet's chain if it is a configured one,
 * otherwise the first configured chain. `wrongNetwork` is true when the wallet is on
 * a chain that is not in config/networks.json.
 */
export function useActiveChain(): { chain: Chain; wrongNetwork: boolean } {
  const { chainId, isConnected } = useConnection();
  const match = configuredChains.find((c) => c.id === chainId);
  return { chain: match ?? configuredChains[0], wrongNetwork: isConnected && !match };
}

export function errorMessage(err: unknown): string {
  const e = err as { shortMessage?: string; message?: string } | null;
  return (e?.shortMessage ?? e?.message ?? String(err)).split("\n")[0] ?? "Unknown error";
}
