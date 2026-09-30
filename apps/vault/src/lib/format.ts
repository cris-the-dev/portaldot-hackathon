import { formatUnits, parseUnits } from "viem";

/**
 * Human-readable token amount with thousands separators, rounded half-up to `maxFraction` decimals.
 * Rounding (not truncating) matters for ERC-4626: conversions round 1 wei in the vault's favour, and
 * truncation would show 109.9999 for a 110 position. Use `maxFraction = decimals` for exact values.
 */
export function formatToken(value: bigint, decimals: number, maxFraction = 4): string {
  const negative = value < 0n;
  let abs = negative ? -value : value;
  if (maxFraction < decimals) {
    const unit = 10n ** BigInt(decimals - maxFraction);
    abs = ((abs + unit / 2n) / unit) * unit;
  }
  const [whole = "0", fraction = ""] = formatUnits(abs, decimals).split(".");
  const cut = fraction.slice(0, maxFraction).replace(/0+$/, "");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}${cut ? `.${cut}` : ""}`;
}

export class AmountError extends Error {
  override name = "AmountError";
}

/** Parse a user-typed amount into base units. Rejects empty, negative, zero and over-precise input. */
export function parseAmount(text: string, decimals: number): bigint {
  const value = text.trim().replace(/,/g, "");
  if (!value) throw new AmountError("Enter an amount");
  if (!/^\d*\.?\d*$/.test(value) || value === ".") throw new AmountError("Not a valid number");
  const fraction = value.split(".")[1] ?? "";
  if (fraction.length > decimals) throw new AmountError(`At most ${decimals} decimals`);
  const amount = parseUnits(value, decimals);
  if (amount === 0n) throw new AmountError("Amount must be greater than 0");
  return amount;
}

export type HistoryKind = "deposit" | "withdraw" | "yield";

export interface HistoryEntry {
  kind: HistoryKind;
  assets: bigint;
  shares?: bigint;
  blockNumber: bigint;
  logIndex: number;
  transactionHash: `0x${string}`;
}

/** Newest first; stable by (block, logIndex). */
export function sortHistory(entries: HistoryEntry[]): HistoryEntry[] {
  return [...entries].sort((a, b) =>
    a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : a.blockNumber > b.blockNumber ? -1 : 1,
  );
}
