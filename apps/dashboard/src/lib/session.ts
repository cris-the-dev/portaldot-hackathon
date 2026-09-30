import type { Abi, Address } from "viem";

// Per-viewer convenience only: hands the ABI of a freshly deployed contract to the playground.
// Storage can be unavailable (private mode, blocked site data), so every access is guarded.

const key = (address: string) => `portalkit:abi:${address.toLowerCase()}`;

export function rememberAbi(address: Address, abi: Abi): void {
  try {
    sessionStorage.setItem(key(address), JSON.stringify(abi));
  } catch {
    // ignore
  }
}

export function recallAbi(address: string): string | null {
  try {
    return sessionStorage.getItem(key(address));
  } catch {
    return null;
  }
}
