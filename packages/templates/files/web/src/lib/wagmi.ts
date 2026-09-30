import { getEvmChains, parseNetworksConfig } from "@portalkit/chains";
import type { Chain } from "viem";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors/injected";
import networks from "../../../networks.json";

// Every network in ../networks.json whose required values are filled in (TODO ones are skipped).
const chains = getEvmChains({ config: parseNetworksConfig(networks), env: {} });
if (chains.length === 0) throw new Error("No ready EVM network in networks.json");

export const configuredChains = chains as [Chain, ...Chain[]];

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
