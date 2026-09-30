import { TODO, getNetwork, type LoadOptions } from "@portalkit/chains";
import { getAddress, isAddress, type Address } from "viem";
import { InvalidSs58AddressError, isValidSs58 } from "./ss58.js";
import { strategies, type AddressMappingStrategy } from "./strategy.js";

export * from "./ss58.js";
export * from "./strategy.js";

export class Ss58PrefixNotConfiguredError extends Error {
  override name = "Ss58PrefixNotConfiguredError";
  constructor(readonly networkKey: string) {
    super(`ss58Prefix for network "${networkKey}" is not configured yet in config/networks.json.`);
  }
}

/** SS58 prefix of a network, read from config/networks.json (never hardcoded). */
export function ss58PrefixFor(networkKey: string, options?: LoadOptions): number {
  const prefix = getNetwork(networkKey, options).ss58Prefix;
  if (prefix === undefined || prefix === TODO) throw new Ss58PrefixNotConfiguredError(networkKey);
  return prefix;
}

export type AddressKind = "evm" | "ss58" | "unknown";

/** Classify an address string. */
export function detectAddressKind(value: string): AddressKind {
  if (isAddress(value, { strict: false })) return "evm";
  if (isValidSs58(value)) return "ss58";
  return "unknown";
}

export interface ConvertOptions {
  /** Mapping strategy (object or registered id). */
  strategy: AddressMappingStrategy | string;
  /** Prefix used to encode SS58 output. */
  ss58Prefix: number;
}

/** Convert an EVM address to SS58 using the given mapping strategy. */
export function evmToSubstrate(h160: string, { strategy, ss58Prefix }: ConvertOptions): string {
  if (!isAddress(h160, { strict: false })) throw new Error(`Not an EVM address: "${h160}"`);
  return resolve(strategy).evmToSubstrate(getAddress(h160), ss58Prefix);
}

/** Convert an SS58 address to an EVM address using the given mapping strategy. */
export function substrateToEvm(ss58: string, { strategy }: Pick<ConvertOptions, "strategy">): Address {
  if (!isValidSs58(ss58)) throw new InvalidSs58AddressError(`Not a valid SS58 address: "${ss58}"`);
  return resolve(strategy).substrateToEvm(ss58);
}

function resolve(strategy: AddressMappingStrategy | string): AddressMappingStrategy {
  return typeof strategy === "string" ? strategies.get(strategy) : strategy;
}
