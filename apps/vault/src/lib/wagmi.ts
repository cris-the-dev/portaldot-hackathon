import { getEvmChains, listNetworks } from "@portalkit/chains";
import type { Chain } from "viem";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors/injected";

// Chains come from config/networks.json via @portalkit/chains. Networks whose required values are
// still TODO (e.g. Portaldot V3 today) are skipped until they are filled in.
// `env: {}` keeps server and client renders identical (no process.env on the client).
// NEXT_PUBLIC_DEFAULT_CHAIN_ID (inlined at build time) puts that chain first — the one read before a wallet connects.
const preferred = Number(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID);
const chains = getEvmChains({ env: {} }).sort((a, b) => Number(b.id === preferred) - Number(a.id === preferred));
if (chains.length === 0) throw new Error("No ready EVM network in config/networks.json");

export const configuredChains = chains as [Chain, ...Chain[]];
export const networkStatuses = listNetworks({ env: {} });

export const wagmiConfig = createConfig({
  chains: configuredChains,
  connectors: [injected()],
  transports: Object.fromEntries(configuredChains.map((c) => [c.id, http()])),
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
