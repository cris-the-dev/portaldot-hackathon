import { u8aToHex } from "@polkadot/util";
import { base58Decode, checkAddressChecksum, decodeAddress, encodeAddress } from "@polkadot/util-crypto";
import type { Hex } from "viem";

/** Largest SS58 prefix allowed by the format (14 bits). */
export const MAX_SS58_PREFIX = 16383;

export class InvalidSs58AddressError extends Error {
  override name = "InvalidSs58AddressError";
}

export interface DecodedSs58 {
  /** 32-byte AccountId / public key as 0x-hex. */
  accountId: Hex;
  /** Network prefix embedded in the address. */
  prefix: number;
}

/** Decode an SS58 address into its AccountId and embedded network prefix. Checksum is verified. */
export function decodeSs58(address: string): DecodedSs58 {
  let raw: Uint8Array;
  try {
    raw = base58Decode(address);
  } catch {
    throw new InvalidSs58AddressError(`Not a base58 string: "${address}"`);
  }
  let valid: boolean;
  let prefix: number;
  try {
    [valid, , , prefix] = checkAddressChecksum(raw);
  } catch {
    throw new InvalidSs58AddressError(`Malformed SS58 address: "${address}"`);
  }
  if (!valid) throw new InvalidSs58AddressError(`Invalid SS58 checksum: "${address}"`);

  const accountId = decodeAddress(address);
  if (accountId.length !== 32) {
    throw new InvalidSs58AddressError(`Expected a 32-byte account, got ${accountId.length} bytes: "${address}"`);
  }
  return { accountId: u8aToHex(accountId), prefix };
}

/** Encode a 32-byte AccountId (0x-hex or bytes) as SS58 with the given network prefix. */
export function encodeSs58(accountId: Hex | Uint8Array, prefix: number): string {
  assertPrefix(prefix);
  const bytes = typeof accountId === "string" ? hexToBytes32(accountId) : accountId;
  if (bytes.length !== 32) throw new InvalidSs58AddressError(`AccountId must be 32 bytes, got ${bytes.length}`);
  return encodeAddress(bytes, prefix);
}

/** Re-encode an SS58 address for another network prefix (same underlying account). */
export function reencodeSs58(address: string, prefix: number): string {
  return encodeSs58(decodeSs58(address).accountId, prefix);
}

/** True if `address` is a valid SS58 account address (optionally for a specific prefix). */
export function isValidSs58(address: string, prefix?: number): boolean {
  try {
    const decoded = decodeSs58(address);
    return prefix === undefined || decoded.prefix === prefix;
  } catch {
    return false;
  }
}

function assertPrefix(prefix: number): void {
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > MAX_SS58_PREFIX) {
    throw new RangeError(`SS58 prefix must be an integer in [0, ${MAX_SS58_PREFIX}], got ${prefix}`);
  }
}

function hexToBytes32(hex: Hex): Uint8Array {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) {
    throw new InvalidSs58AddressError(`AccountId must be 32 bytes of 0x-hex, got "${hex}"`);
  }
  return decodeAddress(hex);
}
