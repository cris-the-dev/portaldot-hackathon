import { afterEach, describe, expect, it } from "vitest";
import {
  SubstrateRpcError,
  connectSubstrate,
  decodeAccountInfo,
  getNativeAccount,
  getNativeChainInfo,
  systemAccountKey,
  type SubstrateRpc,
} from "../src/index.js";

const ALICE = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";
// Well-known System.Account storage key of //Alice.
const ALICE_KEY =
  "0x26aa394eea5630e07c48ae0c9558cef7b99d880ec681799c0cf30e8886371da9" +
  "de1e86a9a8c739864cf3cc5ec2bea59f" +
  "d43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d";

// Real System.Account value read from Portaldot mainnet (spec 1002) on 2026-10-02.
const MAINNET_ACCOUNT =
  "0x" +
  "00000000" + "00000000" + "01000000" + "00000000" + // nonce, consumers, providers, sufficients
  "012dfa59516b0000" + "0000000000000000" + // free (u128 LE)
  "00".repeat(48); // reserved, miscFrozen, feeFrozen

const u128le = (n: bigint) =>
  n
    .toString(16)
    .padStart(32, "0")
    .replace(/(..)/g, "$1 ")
    .trim()
    .split(" ")
    .reverse()
    .join("");

function fakeRpc(results: Record<string, unknown>): SubstrateRpc {
  return {
    async request<T>(method: string) {
      if (!(method in results)) throw new SubstrateRpcError(`Method not found: ${method}`, -32601);
      return results[method] as T;
    },
    close() {},
  };
}

describe("systemAccountKey", () => {
  it("matches the well-known key for Alice", () => {
    expect(systemAccountKey(ALICE)).toBe(ALICE_KEY);
  });
});

describe("decodeAccountInfo", () => {
  it("decodes a real Portaldot mainnet account", () => {
    expect(decodeAccountInfo(MAINNET_ACCOUNT)).toEqual({
      nonce: 0,
      consumers: 0,
      providers: 1,
      sufficients: 0,
      free: 0x6b5159fa2d01n, // ≈ 1.18 POT at 14 decimals
      reserved: 0n,
      miscFrozen: 0n,
      feeFrozen: 0n,
    });
  });

  it("decodes every field position", () => {
    const hex =
      "0x" +
      ["07000000", "02000000", "01000000", "00000000"].join("") +
      [1n, 2n, 3n, 2n ** 127n].map(u128le).join("");
    expect(decodeAccountInfo(hex)).toMatchObject({ nonce: 7, consumers: 2, providers: 1, free: 1n, reserved: 2n, miscFrozen: 3n, feeFrozen: 2n ** 127n });
  });

  it("rejects other layouts instead of guessing", () => {
    expect(() => decodeAccountInfo("0x" + "00".repeat(76))).toThrow(/Unexpected AccountInfo size 76/);
    expect(() => decodeAccountInfo("0xzz")).toThrow(SubstrateRpcError);
  });
});

describe("getNativeAccount", () => {
  it("returns zeros for a missing account", async () => {
    const info = await getNativeAccount(fakeRpc({ state_getStorage: null }), ALICE);
    expect(info.free).toBe(0n);
    expect(info.nonce).toBe(0);
  });

  it("decodes storage", async () => {
    const info = await getNativeAccount(fakeRpc({ state_getStorage: MAINNET_ACCOUNT }), ALICE);
    expect(info.providers).toBe(1);
  });
});

describe("getNativeChainInfo", () => {
  it("reads properties and detects execution environments", async () => {
    const info = await getNativeChainInfo(
      fakeRpc({
        system_chain: "Portaldot Mainnet",
        system_version: "2.0.0",
        state_getRuntimeVersion: { specName: "portaldot", specVersion: 1002 },
        chain_getHeader: { number: "0x2952da" },
        system_properties: { ss58Format: 42, tokenDecimals: 14, tokenSymbol: "POT" },
        rpc_methods: { methods: ["system_chain", "contracts_call", "state_getStorage"] },
      }),
    );
    expect(info).toMatchObject({
      chain: "Portaldot Mainnet",
      specName: "portaldot",
      specVersion: 1002,
      bestBlock: 0x2952da,
      properties: { ss58Format: 42, tokenDecimals: 14, tokenSymbol: "POT" },
      evm: false,
      wasmContracts: true,
    });
  });

  it("handles array-valued properties and EVM nodes", async () => {
    const info = await getNativeChainInfo(
      fakeRpc({
        system_chain: "X",
        system_version: "1",
        state_getRuntimeVersion: { specName: "x", specVersion: 1 },
        chain_getHeader: { number: "0x1" },
        system_properties: { ss58Format: 7, tokenDecimals: [18, 12], tokenSymbol: ["A", "B"] },
        rpc_methods: { methods: ["eth_chainId"] },
      }),
    );
    expect(info.properties).toEqual({ ss58Format: 7, tokenDecimals: 18, tokenSymbol: "A" });
    expect(info.evm).toBe(true);
    expect(info.wasmContracts).toBe(false);
  });
});

describe("connectSubstrate (mock WebSocket)", () => {
  const original = (globalThis as { WebSocket?: unknown }).WebSocket;
  afterEach(() => {
    (globalThis as { WebSocket?: unknown }).WebSocket = original;
  });

  class MockWS {
    static fail = false;
    readyState = 0;
    onopen: ((ev: unknown) => void) | null = null;
    onmessage: ((ev: { data: unknown }) => void) | null = null;
    onerror: ((ev: unknown) => void) | null = null;
    onclose: ((ev: unknown) => void) | null = null;
    constructor() {
      setTimeout(() => (MockWS.fail ? this.onerror?.({}) : this.onopen?.({})), 0);
    }
    send(data: string) {
      const { id, method } = JSON.parse(data) as { id: number; method: string };
      const reply = method === "system_chain" ? { id, result: "Mock" } : { id, error: { code: -32601, message: "Method not found" } };
      setTimeout(() => this.onmessage?.({ data: JSON.stringify(reply) }), 0);
    }
    close() {}
  }

  it("sends requests and maps errors", async () => {
    MockWS.fail = false;
    (globalThis as { WebSocket?: unknown }).WebSocket = MockWS;
    const rpc = await connectSubstrate("ws://mock");
    await expect(rpc.request("system_chain")).resolves.toBe("Mock");
    await expect(rpc.request("eth_chainId")).rejects.toMatchObject({ code: -32601 });
    rpc.close();
  });

  it("rejects when the connection fails", async () => {
    MockWS.fail = true;
    (globalThis as { WebSocket?: unknown }).WebSocket = MockWS;
    await expect(connectSubstrate("ws://mock")).rejects.toThrow(/Cannot connect/);
  });
});

// Live check against Portaldot mainnet — opt-in (network): PORTALKIT_LIVE_TESTS=1
describe.skipIf(!process.env.PORTALKIT_LIVE_TESTS)("Portaldot mainnet (live)", () => {
  it("matches config: ss58 42, 14 decimals, no EVM yet", async () => {
    const rpc = await connectSubstrate("wss://mainnet.portaldot.io", { timeoutMs: 20_000 });
    try {
      const info = await getNativeChainInfo(rpc);
      expect(info.properties).toEqual({ ss58Format: 42, tokenDecimals: 14, tokenSymbol: "POT" });
      expect(info.specName).toBe("portaldot");
      const acct = await getNativeAccount(rpc, "5CtTVdK6Gb957tAPGwnXZmTiKsrtZ7bjg2ASHodcpJYzxqpF");
      expect(acct.nonce).toBe(await rpc.request("system_accountNextIndex", ["5CtTVdK6Gb957tAPGwnXZmTiKsrtZ7bjg2ASHodcpJYzxqpF"]));
    } finally {
      rpc.close();
    }
  }, 30_000);
});
