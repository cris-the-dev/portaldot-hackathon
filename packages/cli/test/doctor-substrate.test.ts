import { describe, expect, it } from "vitest";
import { parseNetworksConfig } from "@portalkit/chains";
import { SubstrateRpcError, type SubstrateRpc } from "@portalkit/address";
import { runDoctor, type DoctorReport } from "../src/index.js";

const ALICE = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY";
const status = (r: DoctorReport, id: string) => r.checks.find((c) => c.id === id);

/** 80-byte AccountInfo with the given free balance (Portaldot V2 layout). */
const accountHex = (free: bigint) =>
  "0x" + "01000000" + "00000000" + "01000000" + "00000000" + free.toString(16).padStart(32, "0").match(/../g)?.reverse().join("") + "00".repeat(48);

function fakeNode(overrides: Record<string, unknown> = {}): SubstrateRpc {
  const results: Record<string, unknown> = {
    system_chain: "Portaldot Mainnet",
    system_version: "2.0.0",
    state_getRuntimeVersion: { specName: "portaldot", specVersion: 1002 },
    chain_getHeader: { number: "0x10" },
    system_properties: { ss58Format: 42, tokenDecimals: 14, tokenSymbol: "POT" },
    rpc_methods: { methods: ["system_chain", "contracts_call"] },
    state_getStorage: accountHex(5n * 10n ** 14n),
    ...overrides,
  };
  return {
    async request<T>(method: string) {
      const v = results[method];
      if (v instanceof Error) throw v;
      if (v === undefined) throw new SubstrateRpcError(`Method not found: ${method}`, -32601);
      return v as T;
    },
    close() {},
  };
}

const base = { network: "portaldot-mainnet", env: {} };

describe("runDoctor — substrate networks", () => {
  it("passes against a node matching config and reports execution environments", async () => {
    const report = await runDoctor({ ...base, substrateRpc: fakeNode() });
    expect(report.ok).toBe(true);
    expect(report.checks.map((c) => [c.id, c.status])).toEqual([
      ["config", "pass"],
      ["rpc", "pass"],
      ["properties", "pass"],
      ["runtime", "pass"],
      ["vms", "pass"],
      ["balance", "skip"],
    ]);
    expect(status(report, "vms")?.detail).toBe("EVM (eth_*): not available · WASM contracts: available");
  });

  it("detects when EVM becomes available", async () => {
    const report = await runDoctor({ ...base, substrateRpc: fakeNode({ rpc_methods: { methods: ["eth_chainId", "contracts_call"] } }) });
    expect(status(report, "vms")?.detail).toMatch(/EVM \(eth_\*\): available/);
  });

  it("fails when the node's properties contradict the config", async () => {
    const report = await runDoctor({
      ...base,
      substrateRpc: fakeNode({ system_properties: { ss58Format: 0, tokenDecimals: 18, tokenSymbol: "POT" } }),
    });
    expect(report.ok).toBe(false);
    expect(status(report, "properties")?.detail).toBe("ss58Prefix: config 42, node 0; nativeDecimals: config 14, node 18");
  });

  it("warns with the node's values when config fields are TODO", async () => {
    const config = parseNetworksConfig({
      node: { vm: "substrate", name: "New node", wsUrl: "ws://127.0.0.1:9944", nativeSymbol: "POT", nativeDecimals: "TODO", ss58Prefix: "TODO" },
    });
    const report = await runDoctor({ network: "node", config, env: {}, substrateRpc: fakeNode() });
    expect(status(report, "properties")).toMatchObject({ status: "warn", detail: "not in config yet — node reports ss58Prefix = 42, nativeDecimals = 14" });
    expect(report.ok).toBe(true);
  });

  it("checks an SS58 account balance against --min-balance", async () => {
    const ok = await runDoctor({ ...base, address: ALICE, minBalance: "1", substrateRpc: fakeNode() });
    expect(status(ok, "balance")).toMatchObject({ status: "pass", detail: "5 POT free · nonce 1" });
    const low = await runDoctor({ ...base, address: ALICE, minBalance: "10", substrateRpc: fakeNode() });
    expect(status(low, "balance")?.status).toBe("fail");
    const empty = await runDoctor({ ...base, address: ALICE, substrateRpc: fakeNode({ state_getStorage: null }) });
    expect(status(empty, "balance")?.detail).toMatch(/^0 POT free/);
  });

  it("rejects a non-SS58 --address", async () => {
    const report = await runDoctor({ ...base, address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", substrateRpc: fakeNode() });
    expect(status(report, "balance")?.status).toBe("fail");
  });

  it("fails cleanly when RPC calls error", async () => {
    const report = await runDoctor({ ...base, substrateRpc: fakeNode({ system_chain: new SubstrateRpcError("boom") }) });
    expect(status(report, "rpc")).toMatchObject({ status: "fail", detail: "boom" });
  });

  it("fails when the node is unreachable", async () => {
    const config = parseNetworksConfig({ x: { vm: "substrate", name: "X", wsUrl: "ws://127.0.0.1:1", nativeSymbol: "POT", nativeDecimals: 14 } });
    const report = await runDoctor({ network: "x", config, env: {}, timeoutMs: 2000 });
    expect(status(report, "rpc")?.status).toBe("fail");
  });

  it("reports unknown networks", async () => {
    const report = await runDoctor({ network: "nope", env: {} });
    expect(report.checks[0]?.detail).toMatch(/Unknown network "nope"/);
  });
});
