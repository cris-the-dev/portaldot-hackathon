import { describe, expect, it } from "vitest";
import type { AbiParameter } from "viem";
import { ArgError, parseArg, parseArgs, placeholderFor, stringifyResult } from "../src/lib/abi-args";
import { ArtifactError, parseArtifact, parseBytecode } from "../src/lib/artifact";

const p = (type: string, name = "x", components?: AbiParameter[]): AbiParameter =>
  (components ? { type, name, components } : { type, name }) as AbiParameter;

const ADDR = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const ADDR_CHECKSUM = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

describe("parseArg — scalars", () => {
  it("parses integers (decimal, hex, underscores, negative)", () => {
    expect(parseArg(p("uint256"), "1000000000000000000")).toBe(10n ** 18n);
    expect(parseArg(p("uint8"), "0xff")).toBe(255n);
    expect(parseArg(p("uint256"), "1_000")).toBe(1000n);
    expect(parseArg(p("int8"), "-128")).toBe(-128n);
    expect(parseArg(p("uint"), " 7 ")).toBe(7n);
  });

  it("enforces integer ranges and format", () => {
    expect(() => parseArg(p("uint8"), "256")).toThrow(ArgError);
    expect(() => parseArg(p("uint256"), "-1")).toThrow(/out of range/);
    expect(() => parseArg(p("int8"), "128")).toThrow(/out of range/);
    expect(() => parseArg(p("uint256"), "1.5")).toThrow(/expected an integer/);
    expect(() => parseArg(p("uint256"), "")).toThrow(ArgError);
  });

  it("parses addresses to checksum form", () => {
    expect(parseArg(p("address"), ADDR)).toBe(ADDR_CHECKSUM);
    expect(() => parseArg(p("address"), "0x123")).toThrow(/not a valid address/);
  });

  it("parses bools", () => {
    expect(parseArg(p("bool"), "true")).toBe(true);
    expect(parseArg(p("bool"), "0")).toBe(false);
    expect(parseArg(p("bool"), "FALSE")).toBe(false);
    expect(() => parseArg(p("bool"), "yes")).toThrow(ArgError);
  });

  it("parses strings and bytes", () => {
    expect(parseArg(p("string"), "Tokenized Gold")).toBe("Tokenized Gold");
    expect(parseArg(p("bytes"), "0xdeadbeef")).toBe("0xdeadbeef");
    expect(() => parseArg(p("bytes"), "0xabc")).toThrow(ArgError);
    const b32 = `0x${"ab".repeat(32)}`;
    expect(parseArg(p("bytes32"), b32)).toBe(b32);
    expect(() => parseArg(p("bytes32"), "0xab")).toThrow(/32 bytes/);
  });

  it("rejects unsupported types", () => {
    expect(() => parseArg(p("fixed128x18"), "1")).toThrow(/unsupported/);
  });
});

describe("parseArg — composites", () => {
  it("parses arrays (dynamic, fixed, nested)", () => {
    expect(parseArg(p("uint256[]"), '["1", 2, "0x3"]')).toEqual([1n, 2n, 3n]);
    expect(parseArg(p("address[2]"), JSON.stringify([ADDR, ADDR]))).toEqual([ADDR_CHECKSUM, ADDR_CHECKSUM]);
    expect(() => parseArg(p("address[2]"), JSON.stringify([ADDR]))).toThrow(/expected 2 items/);
    expect(parseArg(p("uint8[][]"), "[[1],[2,3]]")).toEqual([[1n], [2n, 3n]]);
    expect(() => parseArg(p("uint256[]"), "not json")).toThrow(/invalid JSON/);
    expect(() => parseArg(p("uint256[]"), "")).toThrow(/expected JSON/);
    expect(() => parseArg(p("uint256[]"), "{}")).toThrow(/expected an array/);
  });

  it("parses tuples from objects or arrays", () => {
    const tuple = p("tuple", "order", [p("address", "to"), p("uint256", "amount")]);
    expect(parseArg(tuple, JSON.stringify({ to: ADDR, amount: "5" }))).toEqual({ to: ADDR_CHECKSUM, amount: 5n });
    expect(parseArg(tuple, JSON.stringify([ADDR, 5]))).toEqual([ADDR_CHECKSUM, 5n]);
    expect(() => parseArg(tuple, "[1]")).toThrow(/expected 2 tuple items/);
  });

  it("parses tuple arrays", () => {
    const param = p("tuple[]", "orders", [p("uint256", "id"), p("bool", "ok")]);
    expect(parseArg(param, '[{"id":"1","ok":true},{"id":2,"ok":false}]')).toEqual([
      { id: 1n, ok: true },
      { id: 2n, ok: false },
    ]);
  });

  it("parses a whole argument list", () => {
    const params = [p("string", "name"), p("string", "symbol"), p("address", "admin")];
    expect(parseArgs(params, ["Tokenized Gold", "tGOLD", ADDR])).toEqual(["Tokenized Gold", "tGOLD", ADDR_CHECKSUM]);
  });
});

describe("helpers", () => {
  it("renders placeholders", () => {
    expect(placeholderFor(p("uint256"))).toBe("123");
    expect(placeholderFor(p("address[]"))).toContain("JSON array");
    expect(placeholderFor(p("tuple", "t", [p("uint256", "a")]))).toContain("a");
  });

  it("stringifies bigints", () => {
    expect(stringifyResult(1n)).toBe('"1"');
    expect(stringifyResult({ a: [1n, "x"] })).toContain('"1"');
    expect(stringifyResult("plain")).toBe("plain");
  });
});

describe("parseArtifact", () => {
  const abi = [{ type: "constructor", inputs: [{ name: "x", type: "uint256" }], stateMutability: "nonpayable" }];

  it("reads Foundry artifacts", () => {
    const parsed = parseArtifact(JSON.stringify({ abi, bytecode: { object: "0x6080" } }));
    expect(parsed.abi).toEqual(abi);
    expect(parsed.bytecode).toBe("0x6080");
  });

  it("reads Hardhat artifacts", () => {
    const parsed = parseArtifact(JSON.stringify({ contractName: "Foo", abi, bytecode: "0x6080" }));
    expect(parsed).toEqual({ abi, bytecode: "0x6080", name: "Foo" });
  });

  it("reads a bare ABI and artifacts without bytecode", () => {
    expect(parseArtifact(JSON.stringify(abi))).toEqual({ abi });
    expect(parseArtifact(JSON.stringify({ abi, bytecode: "0x" }))).toEqual({ abi });
  });

  it("rejects bad input", () => {
    expect(() => parseArtifact("nope")).toThrow(ArtifactError);
    expect(() => parseArtifact("{}")).toThrow(/no "abi"/);
    expect(() => parseArtifact('[{"name":"x"}]')).toThrow(/no "type"/);
    expect(() => parseArtifact('{"abi": {}}')).toThrow(/must be an array/);
  });

  it("validates bytecode", () => {
    expect(parseBytecode("6080")).toBe("0x6080");
    expect(() => parseBytecode("0x")).toThrow(/empty/);
    expect(() => parseBytecode("0x60zz")).toThrow(/not valid hex/);
    expect(() => parseBytecode(`0x60__$${"a".repeat(34)}$__`)).toThrow(/unlinked/);
  });
});
