import {
  connectSubstrate,
  getNativeAccount,
  getNativeChainInfo,
  isValidSs58,
  type NativeChainInfo,
  type SubstrateRpc,
} from "@portalkit/address";
import { TODO, getNetwork, type SubstrateNetworkConfig } from "@portalkit/chains";
import { formatUnits, parseUnits } from "viem";
import type { CheckResult, DoctorOptions, DoctorReport } from "./doctor.js";

/**
 * Checks for Portaldot's native (Substrate) side: node reachable, chain properties match the
 * config (SS58 prefix, POT decimals/symbol — wrong values silently produce wrong addresses and
 * amounts), runtime, which execution environments the node exposes (EVM via pallet-revive or `eth_*` / WASM
 * `contracts_*` — tells you when V3's EVM is live), and an optional SS58 account balance.
 */
export async function runSubstrateDoctor(options: DoctorOptions): Promise<DoctorReport> {
  const checks: CheckResult[] = [];
  const report = (): DoctorReport => ({ network: options.network, checks, ok: checks.every((c) => c.status !== "fail") });
  const net = getNetwork(options.network, options) as SubstrateNetworkConfig;

  // 1. Config
  if (net.wsUrl === TODO) {
    checks.push({ id: "config", title: "Network config", status: "fail", detail: "wsUrl still TODO in the networks config" });
    return report();
  }
  checks.push({ id: "config", title: "Network config", status: "pass", detail: `${net.name} (substrate) → ${net.wsUrl}` });

  // 2. Node reachable
  let rpc: SubstrateRpc;
  let info: NativeChainInfo;
  try {
    rpc = options.substrateRpc ?? (await connectSubstrate(net.wsUrl, { timeoutMs: options.timeoutMs ?? 10_000 }));
  } catch (err) {
    checks.push({ id: "rpc", title: "Node reachable", status: "fail", detail: (err as Error).message });
    return report();
  }
  try {
    info = await getNativeChainInfo(rpc);
    checks.push({
      id: "rpc",
      title: "Node reachable",
      status: "pass",
      detail: `${info.chain} · node ${info.nodeVersion} · block #${info.bestBlock}`,
    });

    // 3. Chain properties vs config
    checks.push(propertiesCheck(net, info));

    // 4. Runtime
    checks.push({ id: "runtime", title: "Runtime", status: "pass", detail: `${info.specName} spec ${info.specVersion}` });

    // 5. Execution environments
    checks.push({
      id: "vms",
      title: "Execution environments",
      status: "pass",
      detail:
        `EVM: ${info.evm ? "available" : "not available"} · WASM contracts: ${info.wasmContracts ? "available" : "not available"}` +
        (info.evm ? " — check its Ethereum RPC with the matching vm:\"evm\" network" : ""),
    });

    // 6. Account balance
    checks.push(await balanceCheck(rpc, net, info, options));
  } catch (err) {
    checks.push({ id: "rpc", title: "Node reachable", status: "fail", detail: (err as Error).message });
  } finally {
    if (!options.substrateRpc) rpc.close();
  }
  return report();
}

function propertiesCheck(net: SubstrateNetworkConfig, info: NativeChainInfo): CheckResult {
  const title = "Chain properties match config";
  const { ss58Format, tokenDecimals, tokenSymbol } = info.properties;
  const mismatches: string[] = [];
  const todos: string[] = [];
  const compare = (field: string, configured: unknown, actual: unknown) => {
    if (actual === undefined) return;
    if (configured === TODO || configured === undefined) todos.push(`${field} = ${String(actual)}`);
    else if (configured !== actual) mismatches.push(`${field}: config ${String(configured)}, node ${String(actual)}`);
  };
  compare("ss58Prefix", net.ss58Prefix, ss58Format);
  compare("nativeDecimals", net.nativeDecimals, tokenDecimals);
  compare("nativeSymbol", net.nativeSymbol, tokenSymbol);

  if (mismatches.length) return { id: "properties", title, status: "fail", detail: mismatches.join("; ") };
  if (todos.length) return { id: "properties", title, status: "warn", detail: `not in config yet — node reports ${todos.join(", ")}` };
  return {
    id: "properties",
    title,
    status: "pass",
    detail: `ss58 ${String(ss58Format)} · ${String(tokenDecimals)} decimals · ${String(tokenSymbol)}`,
  };
}

async function balanceCheck(
  rpc: SubstrateRpc,
  net: SubstrateNetworkConfig,
  info: NativeChainInfo,
  options: DoctorOptions,
): Promise<CheckResult> {
  const title = "Account balance";
  if (!options.address) return { id: "balance", title, status: "skip", detail: "pass --address <SS58> to check an account" };
  if (!isValidSs58(options.address)) {
    return { id: "balance", title, status: "fail", detail: `--address is not an SS58 address: ${options.address}` };
  }
  const decimals = typeof net.nativeDecimals === "number" ? net.nativeDecimals : info.properties.tokenDecimals;
  if (decimals === undefined) return { id: "balance", title, status: "skip", detail: "token decimals unknown" };
  const symbol = net.nativeSymbol;
  try {
    const account = await getNativeAccount(rpc, options.address);
    const min = parseUnits(options.minBalance ?? "0.1", decimals);
    const shown = `${formatUnits(account.free, decimals)} ${symbol} free · nonce ${account.nonce}`;
    return account.free >= min
      ? { id: "balance", title, status: "pass", detail: shown }
      : { id: "balance", title, status: "fail", detail: `${shown} < required ${formatUnits(min, decimals)} ${symbol}` };
  } catch (err) {
    return { id: "balance", title, status: "fail", detail: (err as Error).message };
  }
}
