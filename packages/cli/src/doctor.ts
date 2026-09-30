import {
  NetworkNotConfiguredError,
  getEvmChain,
  type LoadOptions,
} from "@portalkit/chains";
import {
  createPublicClient,
  formatUnits,
  http,
  isAddress,
  parseUnits,
  zeroAddress,
  type Address,
  type Chain,
  type PublicClient,
  type Transport,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export type CheckStatus = "pass" | "warn" | "fail" | "skip";

export interface CheckResult {
  id: string;
  title: string;
  status: CheckStatus;
  detail: string;
}

export interface DoctorReport {
  network: string;
  checks: CheckResult[];
  /** true when no check failed (warnings are allowed). */
  ok: boolean;
}

export interface DoctorOptions extends LoadOptions {
  network: string;
  /** Account to check the balance of. Falls back to the account of env PRIVATE_KEY. */
  address?: string;
  /** Minimum native balance (human units, e.g. "0.1") for the deployer check. */
  minBalance?: string;
  /** Override the transport (tests). Defaults to HTTP on the configured RPC URL. */
  transport?: Transport;
  /** Per-request timeout in ms for the default HTTP transport. */
  timeoutMs?: number;
}

/** JSON-RPC methods every EVM tool (wallets, Foundry, viem) relies on. */
const REQUIRED_METHODS = [
  "eth_blockNumber",
  "eth_chainId",
  "eth_gasPrice",
  "eth_getBalance",
  "eth_getTransactionCount",
  "eth_getBlockByNumber",
  "eth_call",
  "eth_estimateGas",
  "eth_getCode",
] as const;

/** Nice to have: EIP-1559 fees and client info. Missing → warning. */
const OPTIONAL_METHODS = ["eth_feeHistory", "eth_maxPriorityFeePerGas", "net_version", "web3_clientVersion"] as const;

export async function runDoctor(options: DoctorOptions): Promise<DoctorReport> {
  const checks: CheckResult[] = [];
  const report = (): DoctorReport => ({
    network: options.network,
    checks,
    ok: checks.every((c) => c.status !== "fail"),
  });

  // 1. Config
  let chain: Chain;
  try {
    chain = getEvmChain(options.network, options);
    checks.push({
      id: "config",
      title: "Network config",
      status: "pass",
      detail: `${chain.name} (chainId ${chain.id}) → ${chain.rpcUrls.default.http[0]}`,
    });
  } catch (err) {
    const detail =
      err instanceof NetworkNotConfiguredError
        ? `${err.missing.join(", ")} still TODO in config/networks.json`
        : (err as Error).message;
    checks.push({ id: "config", title: "Network config", status: "fail", detail });
    return report();
  }

  const client = createPublicClient({
    chain,
    transport: options.transport ?? http(chain.rpcUrls.default.http[0], { timeout: options.timeoutMs ?? 10_000, retryCount: 0 }),
  });

  // 2. RPC reachable
  try {
    const started = Date.now();
    const block = await client.getBlockNumber();
    checks.push({
      id: "rpc",
      title: "RPC reachable",
      status: "pass",
      detail: `block #${block} in ${Date.now() - started} ms`,
    });
  } catch (err) {
    checks.push({ id: "rpc", title: "RPC reachable", status: "fail", detail: shortError(err) });
    return report();
  }

  // 3. chainId matches config
  try {
    const remote = await client.getChainId();
    checks.push(
      remote === chain.id
        ? { id: "chain-id", title: "chainId matches config", status: "pass", detail: `${remote}` }
        : {
            id: "chain-id",
            title: "chainId matches config",
            status: "fail",
            detail: `RPC reports ${remote}, config says ${chain.id}`,
          },
    );
  } catch (err) {
    checks.push({ id: "chain-id", title: "chainId matches config", status: "fail", detail: shortError(err) });
  }

  // 4. Standard eth_* API
  const probe = probeMethods(client);
  const required = await Promise.all(REQUIRED_METHODS.map(async (m) => [m, await probe(m)] as const));
  const missingRequired = required.filter(([, err]) => err).map(([m, err]) => `${m} (${err})`);
  checks.push({
    id: "eth-api",
    title: "Standard Ethereum JSON-RPC",
    status: missingRequired.length ? "fail" : "pass",
    detail: missingRequired.length
      ? `failing: ${missingRequired.join("; ")}`
      : `${REQUIRED_METHODS.length} required methods OK`,
  });

  const optional = await Promise.all(OPTIONAL_METHODS.map(async (m) => [m, await probe(m)] as const));
  const missingOptional = optional.filter(([, err]) => err).map(([m]) => m);
  checks.push({
    id: "eth-api-optional",
    title: "EIP-1559 & client info",
    status: missingOptional.length ? "warn" : "pass",
    detail: missingOptional.length ? `unsupported: ${missingOptional.join(", ")}` : "all supported",
  });

  // 5. Deployer balance
  checks.push(await balanceCheck(client, chain, options));

  return report();
}

async function balanceCheck(client: PublicClient, chain: Chain, options: DoctorOptions): Promise<CheckResult> {
  const title = "Deployer balance";
  let address: Address | undefined;
  let source = "";
  try {
    if (options.address) {
      if (!isAddress(options.address)) throw new Error(`--address is not an EVM address: ${options.address}`);
      address = options.address;
      source = "--address";
    } else {
      const pk = (options.env ?? process.env).PRIVATE_KEY?.trim();
      if (pk) {
        address = privateKeyToAccount(pk as `0x${string}`).address;
        source = "PRIVATE_KEY";
      }
    }
  } catch (err) {
    return { id: "balance", title, status: "fail", detail: shortError(err) };
  }
  if (!address) {
    return { id: "balance", title, status: "skip", detail: "no --address and no PRIVATE_KEY in env" };
  }

  const { decimals, symbol } = chain.nativeCurrency;
  const min = parseUnits(options.minBalance ?? "0.1", decimals);
  try {
    const balance = await client.getBalance({ address });
    const shown = `${formatUnits(balance, decimals)} ${symbol} (${address} via ${source})`;
    return balance >= min
      ? { id: "balance", title, status: "pass", detail: shown }
      : {
          id: "balance",
          title,
          status: "fail",
          detail: `${shown} < required ${formatUnits(min, decimals)} ${symbol}`,
        };
  } catch (err) {
    return { id: "balance", title, status: "fail", detail: shortError(err) };
  }
}

/** Returns a function that calls a method with harmless params and resolves to an error string or null. */
function probeMethods(client: PublicClient) {
  const params: Record<string, unknown[]> = {
    eth_getBalance: [zeroAddress, "latest"],
    eth_getTransactionCount: [zeroAddress, "latest"],
    eth_getBlockByNumber: ["latest", false],
    eth_call: [{ to: zeroAddress, data: "0x" }, "latest"],
    eth_estimateGas: [{ from: zeroAddress, to: zeroAddress, value: "0x0" }],
    eth_getCode: [zeroAddress, "latest"],
    eth_feeHistory: ["0x1", "latest", [50]],
  };
  return async (method: string): Promise<string | null> => {
    try {
      // Probing arbitrary methods by name is outside viem's typed RPC schema.
      const request = client.request as (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      const result = await request({ method, params: params[method] ?? [] });
      return result === undefined ? "empty result" : null;
    } catch (err) {
      return shortError(err);
    }
  };
}

function shortError(err: unknown): string {
  const e = err as { shortMessage?: string; message?: string };
  return (e.shortMessage ?? e.message ?? String(err)).split("\n")[0] ?? "unknown error";
}
