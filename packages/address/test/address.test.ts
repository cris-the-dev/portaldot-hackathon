import { describe, expect, it } from "vitest";
import { parseNetworksConfig } from "@portalkit/chains";
import rawNetworks from "../../../config/networks.json";
import {
  InvalidSs58AddressError,
  MappingNotAvailableError,
  PENDING_V3_STRATEGY_ID,
  REVIVE_STRATEGY_ID,
  Ss58PrefixNotConfiguredError,
  StrategyRegistry,
  UnknownStrategyError,
  decodeSs58,
  detectAddressKind,
  encodeSs58,
  evmToSubstrate,
  isValidSs58,
  pendingV3Strategy,
  reencodeSs58,
  reviveStrategy,
  ss58PrefixFor,
  strategies,
  substrateToEvm,
  type AddressMappingStrategy,
} from "../src/index.js";

// Well-known Substrate dev account //Alice (sr25519) — public test vector.
const ALICE_PUBKEY = "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d";
const ALICE_42 = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"; // generic Substrate
const ALICE_0 = "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5"; // Polkadot

const EVM = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Anvil account #0
const noEnv = { env: {} };

describe("SS58 helpers", () => {
  it("encodes the Alice test vector for prefixes 42 and 0", () => {
    expect(encodeSs58(ALICE_PUBKEY, 42)).toBe(ALICE_42);
    expect(encodeSs58(ALICE_PUBKEY, 0)).toBe(ALICE_0);
  });

  it("decodes account id and embedded prefix", () => {
    expect(decodeSs58(ALICE_42)).toEqual({ accountId: ALICE_PUBKEY, prefix: 42 });
    expect(decodeSs58(ALICE_0)).toEqual({ accountId: ALICE_PUBKEY, prefix: 0 });
  });

  it("re-encodes between networks without changing the account", () => {
    expect(reencodeSs58(ALICE_42, 0)).toBe(ALICE_0);
    expect(reencodeSs58(ALICE_0, 42)).toBe(ALICE_42);
  });

  it("round-trips two-byte prefixes", () => {
    const addr = encodeSs58(ALICE_PUBKEY, 1284);
    expect(decodeSs58(addr)).toEqual({ accountId: ALICE_PUBKEY, prefix: 1284 });
  });

  it("validates addresses, optionally against a prefix", () => {
    expect(isValidSs58(ALICE_42)).toBe(true);
    expect(isValidSs58(ALICE_42, 42)).toBe(true);
    expect(isValidSs58(ALICE_42, 0)).toBe(false);
    expect(isValidSs58(ALICE_42.slice(0, -1) + "Z")).toBe(false); // broken checksum
    expect(isValidSs58("not-an-address")).toBe(false);
    expect(isValidSs58(EVM)).toBe(false);
  });

  it("rejects bad inputs", () => {
    expect(() => decodeSs58("0OIl")).toThrow(InvalidSs58AddressError);
    expect(() => encodeSs58("0x1234", 42)).toThrow(InvalidSs58AddressError);
    expect(() => encodeSs58(new Uint8Array(20), 42)).toThrow(InvalidSs58AddressError);
    expect(() => encodeSs58(ALICE_PUBKEY, -1)).toThrow(RangeError);
    expect(() => encodeSs58(ALICE_PUBKEY, 16384)).toThrow(RangeError);
    expect(() => encodeSs58(ALICE_PUBKEY, 1.5)).toThrow(RangeError);
  });
});

describe("detectAddressKind", () => {
  it("classifies addresses", () => {
    expect(detectAddressKind(EVM)).toBe("evm");
    expect(detectAddressKind(EVM.toLowerCase())).toBe("evm");
    expect(detectAddressKind(ALICE_42)).toBe("ss58");
    expect(detectAddressKind("hello")).toBe("unknown");
  });
});

describe("ss58PrefixFor (reads config/networks.json)", () => {
  it("returns the configured prefix for Portaldot V2", () => {
    expect(ss58PrefixFor("portaldot-v2", noEnv)).toBe(rawNetworks["portaldot-v2"].ss58Prefix);
  });

  it("throws while a network's prefix is TODO", () => {
    const config = parseNetworksConfig({ x: { ...rawNetworks["portaldot-v3"], ss58Prefix: "TODO" } });
    expect(() => ss58PrefixFor("x", { config, env: {} })).toThrow(Ss58PrefixNotConfiguredError);
  });

  it("throws for networks without a prefix", () => {
    expect(() => ss58PrefixFor("anvil", noEnv)).toThrow(Ss58PrefixNotConfiguredError);
  });
});

describe("mapping strategies", () => {
  it("registers revive (default) and the pending V3 strategy, which refuses to guess", () => {
    expect(strategies.ids()).toEqual([REVIVE_STRATEGY_ID, PENDING_V3_STRATEGY_ID]);
    expect(() => evmToSubstrate(EVM, { strategy: PENDING_V3_STRATEGY_ID, ss58Prefix: 42 })).toThrow(
      MappingNotAvailableError,
    );
    expect(() => substrateToEvm(ALICE_42, { strategy: pendingV3Strategy })).toThrow(MappingNotAvailableError);
  });

  // Test vector from the Portaldot V3 testnet guide (MetaMask address -> mapped Substrate address).
  const GUIDE_EVM = "0xf7eC65d11e35375A250e474059a917B537804142";
  const GUIDE_SS58 = "5Hfmuhj1AHrTBJiC9zUPnJo1cfG2G52LLMwofSigBnjtto8Y";

  it("revive: maps H160 to AccountId32 = H160 ++ 0xEE×12 (V3 guide vector) and back", () => {
    expect(evmToSubstrate(GUIDE_EVM.toLowerCase(), { strategy: REVIVE_STRATEGY_ID, ss58Prefix: 42 })).toBe(GUIDE_SS58);
    expect(substrateToEvm(GUIDE_SS58, { strategy: reviveStrategy })).toBe(GUIDE_EVM);
  });

  it("revive: refuses to guess the EVM address of a native account", () => {
    expect(() => substrateToEvm(ALICE_42, { strategy: reviveStrategy })).toThrow(MappingNotAvailableError);
  });

  it("validates input before calling the strategy", () => {
    expect(() => evmToSubstrate("0x123", { strategy: pendingV3Strategy, ss58Prefix: 42 })).toThrow(
      /Not an EVM address/,
    );
    expect(() => substrateToEvm("nope", { strategy: pendingV3Strategy })).toThrow(InvalidSs58AddressError);
  });

  // Test-only fake, NOT a real chain mapping: it just proves strategies are pluggable.
  const fake: AddressMappingStrategy = {
    id: "test-fake",
    description: "test only",
    evmToSubstrate: (h160, prefix) => encodeSs58(`0x${"00".repeat(12)}${h160.slice(2)}`, prefix),
    substrateToEvm: (ss58) => `0x${decodeSs58(ss58).accountId.slice(-40)}`,
  };

  it("plugs in custom strategies via a registry", () => {
    const registry = new StrategyRegistry();
    registry.register(fake);
    expect(registry.has("test-fake")).toBe(true);
    expect(registry.list()).toHaveLength(3);

    const ss58 = registry.get("test-fake").evmToSubstrate(EVM, 42);
    expect(isValidSs58(ss58, 42)).toBe(true);
    expect(substrateToEvm(ss58, { strategy: fake }).toLowerCase()).toBe(EVM.toLowerCase());
    expect(evmToSubstrate(EVM.toLowerCase(), { strategy: fake, ss58Prefix: 42 })).toBe(ss58);
  });

  it("guards against duplicate and unknown ids", () => {
    const registry = new StrategyRegistry([]);
    registry.register(fake);
    expect(() => registry.register(fake)).toThrow(/already registered/);
    registry.register({ ...fake, description: "v2" }, { replace: true });
    expect(registry.get("test-fake").description).toBe("v2");
    expect(() => registry.get("missing")).toThrow(UnknownStrategyError);
  });
});
