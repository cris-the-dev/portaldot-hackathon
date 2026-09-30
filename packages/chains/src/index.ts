import { defineChain, type Chain } from "viem";
import { z } from "zod";
import rawNetworks from "../../../config/networks.json";
import {
  TODO,
  networksConfigSchema,
  type EvmNetworkConfig,
  type NetworkConfig,
  type NetworksConfig,
} from "./schema.js";

export * from "./schema.js";

export type Env = Readonly<Record<string, string | undefined>>;

export interface LoadOptions {
  /** Networks config to use. Defaults to the bundled `config/networks.json`. */
  config?: NetworksConfig;
  /** Environment used for RPC overrides. Defaults to `process.env` when available. */
  env?: Env;
}

export interface NetworkStatus {
  key: string;
  vm: NetworkConfig["vm"];
  name: string;
  /** "ready" = usable now; "pending" = a required value is still TODO. */
  status: "ready" | "pending";
  /** Every field still set to TODO (required or not). */
  pending: string[];
}

export class NetworkConfigError extends Error {
  override name = "NetworkConfigError";
}

export class UnknownNetworkError extends Error {
  override name = "UnknownNetworkError";
  constructor(
    readonly key: string,
    readonly known: string[],
  ) {
    super(`Unknown network "${key}". Known networks: ${known.join(", ") || "(none)"}.`);
  }
}

export class NetworkNotConfiguredError extends Error {
  override name = "NetworkNotConfiguredError";
  constructor(
    readonly key: string,
    readonly missing: string[],
  ) {
    super(
      `Network "${key}" is not configured yet: ${missing.join(", ")} still TODO in config/networks.json ` +
        `(or set ${rpcUrlEnvVar(key)}). See docs/v3-findings.md.`,
    );
  }
}

/** Fields an EVM network needs before it can become a viem chain. */
const REQUIRED_EVM_FIELDS = ["chainId", "rpcUrl", "nativeDecimals"] as const;

/** Validate an unknown value (e.g. parsed JSON) as a networks config. */
export function parseNetworksConfig(raw: unknown): NetworksConfig {
  const result = networksConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new NetworkConfigError(`Invalid networks config:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** The bundled `config/networks.json` (single source of truth), validated at load time. */
export const defaultNetworks: NetworksConfig = parseNetworksConfig(rawNetworks);

/** Env var that overrides a network's RPC URL, e.g. `PORTALKIT_RPC_URL_PORTALDOT_V3`. */
export function rpcUrlEnvVar(key: string): string {
  return `PORTALKIT_RPC_URL_${envSuffix(key)}`;
}

/** Env var that overrides a network's WebSocket URL, e.g. `PORTALKIT_WS_URL_ANVIL`. */
export function wsUrlEnvVar(key: string): string {
  return `PORTALKIT_WS_URL_${envSuffix(key)}`;
}

/** Look up a network (with env overrides applied). May still contain TODO values. */
export function getNetwork(key: string, options: LoadOptions = {}): NetworkConfig {
  const config = options.config ?? defaultNetworks;
  const network = config[key];
  if (!network) throw new UnknownNetworkError(key, Object.keys(config));
  return applyEnvOverrides(key, network, options.env ?? defaultEnv());
}

/** Keys of all TODO fields in a network. */
export function pendingFields(network: NetworkConfig): string[] {
  return Object.entries(network)
    .filter(([, value]) => value === TODO)
    .map(([field]) => field);
}

export function listNetworks(options: LoadOptions = {}): NetworkStatus[] {
  const config = options.config ?? defaultNetworks;
  return Object.keys(config).map((key) => {
    const network = getNetwork(key, options);
    const pending = pendingFields(network);
    const blocking = network.vm === "evm" ? missingRequiredEvmFields(network) : pending;
    return {
      key,
      vm: network.vm,
      name: network.name,
      status: blocking.length === 0 ? "ready" : "pending",
      pending,
    };
  });
}

/**
 * Build a viem `Chain` for an EVM network.
 * @throws NetworkNotConfiguredError if chainId / rpcUrl / nativeDecimals are still TODO.
 */
export function getEvmChain(key: string, options: LoadOptions = {}): Chain {
  const network = getNetwork(key, options);
  if (network.vm !== "evm") {
    throw new NetworkConfigError(`Network "${key}" is a ${network.vm} network, not EVM.`);
  }
  const missing = missingRequiredEvmFields(network);
  if (missing.length > 0) throw new NetworkNotConfiguredError(key, missing);
  return toViemChain(network);
}

/** All EVM networks that are ready to use (pending ones are skipped). */
export function getEvmChains(options: LoadOptions = {}): Chain[] {
  return listNetworks(options)
    .filter((n) => n.vm === "evm" && n.status === "ready")
    .map((n) => getEvmChain(n.key, options));
}

// ---------------------------------------------------------------------------

function toViemChain(network: EvmNetworkConfig): Chain {
  const { chainId, rpcUrl, nativeDecimals } = network;
  // Narrowed by missingRequiredEvmFields; re-checked here for the type system.
  if (chainId === TODO || rpcUrl === TODO || nativeDecimals === TODO) {
    throw new Error("unreachable: required EVM fields are TODO");
  }
  const wsUrl = known(network.wsUrl);
  const explorer = known(network.explorer);

  return defineChain({
    id: chainId,
    name: network.name,
    nativeCurrency: {
      name: network.nativeName ?? network.nativeSymbol,
      symbol: network.nativeSymbol,
      decimals: nativeDecimals,
    },
    rpcUrls: {
      default: wsUrl ? { http: [rpcUrl], webSocket: [wsUrl] } : { http: [rpcUrl] },
    },
    ...(explorer ? { blockExplorers: { default: { name: `${network.name} Explorer`, url: explorer } } } : {}),
    testnet: network.testnet ?? false,
  });
}

function missingRequiredEvmFields(network: EvmNetworkConfig): string[] {
  return REQUIRED_EVM_FIELDS.filter((field) => network[field] === TODO);
}

/** Drop TODO / null / undefined so optional values are only used when actually known. */
function known<T>(value: T | typeof TODO | null | undefined): T | undefined {
  return value === TODO || value === null || value === undefined ? undefined : value;
}

function applyEnvOverrides(key: string, network: NetworkConfig, env: Env): NetworkConfig {
  const rpcUrl = readUrlEnv(env, rpcUrlEnvVar(key));
  const wsUrl = readUrlEnv(env, wsUrlEnvVar(key));
  if (network.vm === "evm") {
    return { ...network, ...(rpcUrl ? { rpcUrl } : {}), ...(wsUrl ? { wsUrl } : {}) };
  }
  return { ...network, ...(wsUrl ? { wsUrl } : {}) };
}

function readUrlEnv(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  if (!value) return undefined;
  if (!z.url().safeParse(value).success) {
    throw new NetworkConfigError(`${name} is not a valid URL: "${value}"`);
  }
  return value;
}

function envSuffix(key: string): string {
  return key.toUpperCase().replace(/-/g, "_");
}

function defaultEnv(): Env {
  const proc = (globalThis as { process?: { env?: Env } }).process;
  return proc?.env ?? {};
}
