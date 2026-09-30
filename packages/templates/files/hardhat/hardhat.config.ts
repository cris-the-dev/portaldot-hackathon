import { readFileSync } from "node:fs";
import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
import { getEvmChain, listNetworks, parseNetworksConfig } from "@portalkit/chains";
import { configVariable, defineConfig } from "hardhat/config";

// Networks come from ../networks.json (the project's single source of truth) via @portalkit/chains.
// Only fully configured EVM networks are added; RPC URLs can be overridden with PORTALKIT_RPC_URL_<KEY>.
const portalkit = { config: parseNetworksConfig(JSON.parse(readFileSync(new URL("../networks.json", import.meta.url), "utf8"))), env: process.env };
const networks = Object.fromEntries(
  listNetworks(portalkit)
    .filter((n) => n.vm === "evm" && n.status === "ready")
    .map((n) => {
      const chain = getEvmChain(n.key, portalkit);
      return [
        n.key,
        {
          type: "http" as const,
          chainType: "l1" as const,
          url: chain.rpcUrls.default.http[0]!,
          chainId: chain.id,
          accounts: [configVariable("PRIVATE_KEY")],
        },
      ];
    }),
);

export default defineConfig({
  plugins: [hardhatToolboxViem],
  solidity: { version: "0.8.28", settings: { evmVersion: "cancun" } },
  paths: { sources: "src", tests: { nodejs: "test" } },
  networks,
});
