import { describe, expect, it } from "vitest";
import { AmountError, formatToken, parseAmount, sortHistory, type HistoryEntry } from "../src/lib/format";

describe("formatToken", () => {
  it("formats with separators and trimmed fraction", () => {
    expect(formatToken(1234567n * 10n ** 18n, 18)).toBe("1,234,567");
    expect(formatToken(15n * 10n ** 17n, 18)).toBe("1.5");
    expect(formatToken(123456789n, 6)).toBe("123.4568");
    expect(formatToken(123456789n, 6, 2)).toBe("123.46");
    expect(formatToken(0n, 18)).toBe("0");
    expect(formatToken(-15n * 10n ** 17n, 18)).toBe("-1.5");
  });

  it("rounds half-up, so 1-wei ERC-4626 rounding does not show", () => {
    expect(formatToken(110n * 10n ** 18n - 1n, 18)).toBe("110");
    expect(formatToken(19999n, 4, 2)).toBe("2");
    expect(formatToken(19949n, 4, 2)).toBe("1.99");
    expect(formatToken(999_999n, 6, 6)).toBe("0.999999"); // exact when maxFraction = decimals
  });
});

describe("parseAmount", () => {
  it("parses decimals into base units", () => {
    expect(parseAmount("1.5", 18)).toBe(15n * 10n ** 17n);
    expect(parseAmount(" 1,000 ", 6)).toBe(1_000_000_000n);
    expect(parseAmount(".5", 2)).toBe(50n);
  });

  it("rejects invalid amounts", () => {
    expect(() => parseAmount("", 18)).toThrow(AmountError);
    expect(() => parseAmount("0", 18)).toThrow(/greater than 0/);
    expect(() => parseAmount("-1", 18)).toThrow(/valid number/);
    expect(() => parseAmount("1e18", 18)).toThrow(/valid number/);
    expect(() => parseAmount(".", 18)).toThrow(/valid number/);
    expect(() => parseAmount("1.123", 2)).toThrow(/At most 2 decimals/);
  });
});

describe("sortHistory", () => {
  const e = (blockNumber: bigint, logIndex: number): HistoryEntry => ({
    kind: "deposit",
    assets: 1n,
    blockNumber,
    logIndex,
    transactionHash: "0x00",
  });

  it("orders newest first by block then log index", () => {
    const sorted = sortHistory([e(1n, 0), e(3n, 1), e(3n, 4), e(2n, 0)]);
    expect(sorted.map((x) => `${x.blockNumber}:${x.logIndex}`)).toEqual(["3:4", "3:1", "2:0", "1:0"]);
  });
});
