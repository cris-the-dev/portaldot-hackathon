import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { custom, numberToHex } from "viem";
import { parseNetworksConfig } from "@portalkit/chains";
import { runDoctor, type DoctorReport } from "../src/index.js";

// Public Anvil dev account #0 — local testing only.
const ANVIL_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const ANVIL_ADDR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

const status = (report: DoctorReport, id: string) => report.checks.find((c) => c.id === id)?.status;

/** Fake RPC: answers every method sensibly, with per-method overrides. */
function fakeRpc(overrides: Record<string, unknown | Error> = {}, chainId = 31337) {
  const defaults: Record<string, unknown> = {
    eth_blockNumber: "0x10",
    eth_chainId: numberToHex(chainId),
    eth_gasPrice: "0x1",
    eth_getBalance: numberToHex(10n ** 18n),
    eth_getTransactionCount: "0x0",
    eth_getBlockByNumber: { number: "0x10" },
    eth_call: "0x",
    eth_estimateGas: "0x5208",
    eth_getCode: "0x",
    eth_feeHistory: { oldestBlock: "0x10", baseFeePerGas: ["0x1"], gasUsedRatio: [0] },
    eth_maxPriorityFeePerGas: "0x1",
    net_version: "31337",
    web3_clientVersion: "fake/1.0",
  };
  return custom({
    async request({ method }: { method: string }) {
      const value = method in overrides ? overrides[method] : defaults[method];
      if (value instanceof Error) throw value;
      if (value === undefined) throw new Error(`Method not found: ${method}`);
      return value;
    },
  });
}

const base = { network: "anvil", env: {} };

describe("runDoctor (mocked RPC)", () => {
  it("passes on a healthy node", async () => {
    const report = await runDoctor({ ...base, address: ANVIL_ADDR, transport: fakeRpc() });
    expect(report.ok).toBe(true);
    expect(report.checks.map((c) => [c.id, c.status])).toEqual([
      ["config", "pass"],
      ["rpc", "pass"],
      ["chain-id", "pass"],
      ["eth-api", "pass"],
      ["eth-api-optional", "pass"],
      ["balance", "pass"],
    ]);
  });

  it("fails on a pending (TODO) network without touching the RPC", async () => {
    const report = await runDoctor({ ...base, network: "portaldot-v3", transport: fakeRpc() });
    expect(report.ok).toBe(false);
    expect(report.checks).toHaveLength(1);
    expect(report.checks[0]?.detail).toMatch(/rpcUrl still TODO/);
  });

  it("fails when the RPC is down", async () => {
    const report = await runDoctor({ ...base, transport: fakeRpc({ eth_blockNumber: new Error("ECONNREFUSED") }) });
    expect(report.ok).toBe(false);
    expect(status(report, "rpc")).toBe("fail");
    expect(report.checks).toHaveLength(2);
  });

  it("fails on chainId mismatch", async () => {
    const report = await runDoctor({ ...base, transport: fakeRpc({}, 1) });
    expect(status(report, "chain-id")).toBe("fail");
    expect(report.checks.find((c) => c.id === "chain-id")?.detail).toBe("RPC reports 1, config says 31337");
  });

  it("fails when a required eth_* method is missing, warns for optional ones", async () => {
    const report = await runDoctor({
      ...base,
      transport: fakeRpc({ eth_estimateGas: new Error("Method not found"), eth_feeHistory: new Error("nope") }),
    });
    expect(status(report, "eth-api")).toBe("fail");
    expect(report.checks.find((c) => c.id === "eth-api")?.detail).toContain("eth_estimateGas");
    expect(status(report, "eth-api-optional")).toBe("warn");
  });

  it("derives the deployer from PRIVATE_KEY and enforces --min-balance", async () => {
    const report = await runDoctor({
      ...base,
      env: { PRIVATE_KEY: ANVIL_PK },
      minBalance: "2",
      transport: fakeRpc(),
    });
    const balance = report.checks.find((c) => c.id === "balance");
    expect(balance?.status).toBe("fail");
    expect(balance?.detail).toContain(ANVIL_ADDR);
    expect(balance?.detail).toContain("< required 2 ETH");
  });

  it("skips the balance check with no account", async () => {
    const report = await runDoctor({ ...base, transport: fakeRpc() });
    expect(status(report, "balance")).toBe("skip");
    expect(report.ok).toBe(true);
  });

  it("rejects an invalid --address", async () => {
    const report = await runDoctor({ ...base, address: "0x123", transport: fakeRpc() });
    expect(status(report, "balance")).toBe("fail");
  });

  it("works with a custom config", async () => {
    const config = parseNetworksConfig({
      custom: {
        vm: "evm",
        name: "Custom",
        chainId: 4242,
        rpcUrl: "http://127.0.0.1:1",
        nativeSymbol: "POT",
        nativeDecimals: 18,
        explorer: null,
      },
    });
    const report = await runDoctor({ network: "custom", config, env: {}, transport: fakeRpc({}, 4242) });
    expect(report.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration: a real Anvil node (skipped when the `anvil` binary is not installed).

const hasAnvil = spawnSync("anvil", ["--version"], { stdio: "ignore" }).status === 0;
const PORT = 18545;

describe.skipIf(!hasAnvil)("runDoctor against a real Anvil", () => {
  let anvil: ChildProcess;

  beforeAll(async () => {
    anvil = spawn("anvil", ["--port", String(PORT), "--silent"], { stdio: "ignore" });
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
        });
        if (res.ok) return;
      } catch {
        // not up yet
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error("anvil did not start");
  }, 20_000);

  afterAll(() => {
    anvil?.kill();
  });

  it("passes every check with the funded dev account", async () => {
    const report = await runDoctor({
      network: "anvil",
      env: { PORTALKIT_RPC_URL_ANVIL: `http://127.0.0.1:${PORT}`, PRIVATE_KEY: ANVIL_PK },
    });
    expect(report.checks.filter((c) => c.status !== "pass")).toEqual([]);
    expect(report.ok).toBe(true);
  });
});
