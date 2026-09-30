import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import rawNetworks from "../../../config/networks.json";
import {
  NetworkConfigError,
  NetworkNotConfiguredError,
  UnknownNetworkError,
  defaultNetworks,
  getEvmChain,
  getEvmChains,
  getNetwork,
  listNetworks,
  parseNetworksConfig,
  pendingFields,
  rpcUrlEnvVar,
  type NetworksConfig,
} from "../src/index.js";
import { loadNetworksFromFile } from "../src/node.js";

const noEnv = { env: {} };

describe("bundled config/networks.json", () => {
  it("is valid and matches the file on disk", () => {
    expect(defaultNetworks).toEqual(rawNetworks);
  });

  it("builds the anvil chain purely from config", () => {
    const chain = getEvmChain("anvil", noEnv);
    const anvil = rawNetworks.anvil;
    expect(chain.id).toBe(anvil.chainId);
    expect(chain.name).toBe(anvil.name);
    expect(chain.rpcUrls.default.http).toEqual([anvil.rpcUrl]);
    expect(chain.rpcUrls.default.webSocket).toEqual([anvil.wsUrl]);
    expect(chain.nativeCurrency).toEqual({
      name: anvil.nativeName,
      symbol: anvil.nativeSymbol,
      decimals: anvil.nativeDecimals,
    });
    expect(chain.blockExplorers).toBeUndefined();
  });

  it("keeps Portaldot V3 pending until its values are known", () => {
    expect(() => getEvmChain("portaldot-v3", noEnv)).toThrow(NetworkNotConfiguredError);
    const status = listNetworks(noEnv).find((n) => n.key === "portaldot-v3");
    expect(status?.status).toBe("pending");
    expect(status?.pending).toEqual(
      expect.arrayContaining(["chainId", "rpcUrl", "nativeDecimals", "explorer", "ss58Prefix"]),
    );
  });

  it("only returns ready EVM chains from getEvmChains", () => {
    expect(getEvmChains(noEnv).map((c) => c.id)).toEqual([rawNetworks.anvil.chainId]);
  });
});

describe("error reporting", () => {
  it("names every missing field for a pending network", () => {
    try {
      getEvmChain("portaldot-v3", noEnv);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(NetworkNotConfiguredError);
      expect((err as NetworkNotConfiguredError).missing).toEqual(["chainId", "rpcUrl", "nativeDecimals"]);
      expect((err as Error).message).toContain(rpcUrlEnvVar("portaldot-v3"));
    }
  });

  it("rejects unknown networks", () => {
    expect(() => getNetwork("nope", noEnv)).toThrow(UnknownNetworkError);
  });

  it("refuses to build an EVM chain from a substrate network", () => {
    expect(() => getEvmChain("portaldot-v2", noEnv)).toThrow(NetworkConfigError);
  });

  it("rejects malformed configs with a readable message", () => {
    expect(() => parseNetworksConfig({ bad: { vm: "evm", name: "x" } })).toThrow(NetworkConfigError);
    expect(() => parseNetworksConfig({ "Bad Key": rawNetworks.anvil })).toThrow(/kebab-case/);
    expect(() => parseNetworksConfig({ x: { ...rawNetworks.anvil, rpcUrl: "not a url" } })).toThrow(
      NetworkConfigError,
    );
    expect(() => parseNetworksConfig({ x: { ...rawNetworks.anvil, chainId: "31337" } })).toThrow(
      NetworkConfigError,
    );
  });
});

describe("custom configs", () => {
  const ready: NetworksConfig = parseNetworksConfig({
    "my-chain": {
      vm: "evm",
      name: "My Chain",
      chainId: 4242,
      rpcUrl: "https://rpc.example.org",
      nativeSymbol: "POT",
      nativeDecimals: 18,
      explorer: "https://explorer.example.org",
      wsUrl: "TODO",
    },
  });

  it("builds a chain once required fields are filled, ignoring optional TODOs", () => {
    const chain = getEvmChain("my-chain", { config: ready, env: {} });
    expect(chain.id).toBe(4242);
    expect(chain.nativeCurrency.name).toBe("POT"); // falls back to symbol
    expect(chain.rpcUrls.default.webSocket).toBeUndefined();
    expect(chain.blockExplorers?.default.url).toBe("https://explorer.example.org");
    expect(chain.testnet).toBe(false);
    expect(pendingFields(getNetwork("my-chain", { config: ready, env: {} }))).toEqual(["wsUrl"]);
  });
});

describe("env overrides", () => {
  it("overrides rpcUrl from PORTALKIT_RPC_URL_<KEY>", () => {
    const chain = getEvmChain("anvil", { env: { PORTALKIT_RPC_URL_ANVIL: "http://10.0.0.5:8545" } });
    expect(chain.rpcUrls.default.http).toEqual(["http://10.0.0.5:8545"]);
  });

  it("maps kebab-case keys to upper snake case", () => {
    expect(rpcUrlEnvVar("portaldot-v3")).toBe("PORTALKIT_RPC_URL_PORTALDOT_V3");
  });

  it("an RPC override alone does not make a pending network ready", () => {
    const env = { PORTALKIT_RPC_URL_PORTALDOT_V3: "https://rpc.example.org" };
    expect(() => getEvmChain("portaldot-v3", { env })).toThrow(/chainId, nativeDecimals/);
  });

  it("overrides wsUrl for substrate networks", () => {
    const net = getNetwork("portaldot-v2", { env: { PORTALKIT_WS_URL_PORTALDOT_V2: "wss://node.example.org" } });
    expect(net.wsUrl).toBe("wss://node.example.org");
  });

  it("rejects invalid override URLs", () => {
    expect(() => getNetwork("anvil", { env: { PORTALKIT_RPC_URL_ANVIL: "localhost" } })).toThrow(
      NetworkConfigError,
    );
  });

  it("ignores empty overrides", () => {
    const chain = getEvmChain("anvil", { env: { PORTALKIT_RPC_URL_ANVIL: "  " } });
    expect(chain.rpcUrls.default.http).toEqual([rawNetworks.anvil.rpcUrl]);
  });
});

describe("loadNetworksFromFile", () => {
  it("loads and validates a file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "portalkit-"));
    const file = join(dir, "networks.json");
    await writeFile(file, JSON.stringify({ anvil: rawNetworks.anvil }));
    await expect(loadNetworksFromFile(file)).resolves.toEqual({ anvil: rawNetworks.anvil });
  });

  it("reports invalid JSON", async () => {
    const dir = await mkdtemp(join(tmpdir(), "portalkit-"));
    const file = join(dir, "networks.json");
    await writeFile(file, "{ nope");
    await expect(loadNetworksFromFile(file)).rejects.toThrow(/Failed to parse/);
  });
});
