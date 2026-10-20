import { u8aToHex } from "@polkadot/util";
import { blake2AsU8a, xxhashAsU8a } from "@polkadot/util-crypto";
import type { Hex } from "viem";
import { decodeSs58 } from "./ss58.js";

/**
 * Minimal Substrate JSON-RPC helpers for the native side of Portaldot.
 *
 * Portaldot V2 runs an old runtime (Substrate 3.0, `portaldot` spec 1002) that current
 * `@polkadot/api` does not fully decode, so we use raw RPC + explicit layouts verified on mainnet.
 */

export interface SubstrateRpc {
  request<T = unknown>(method: string, params?: unknown[]): Promise<T>;
  close(): void;
}

export class SubstrateRpcError extends Error {
  override name = "SubstrateRpcError";
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
  }
}

type WebSocketLike = {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onclose: ((ev: unknown) => void) | null;
};

/** Connect to a node over WebSocket (uses the global `WebSocket`: browsers and Node ≥ 22). */
export function connectSubstrate(url: string, { timeoutMs = 10_000 } = {}): Promise<SubstrateRpc> {
  const WS = (globalThis as { WebSocket?: new (url: string) => WebSocketLike }).WebSocket;
  if (!WS) return Promise.reject(new SubstrateRpcError("No global WebSocket (needs a browser or Node ≥ 22)"));

  return new Promise((resolve, reject) => {
    const ws = new WS(url);
    let nextId = 0;
    const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();
    const openTimer = setTimeout(() => {
      ws.close();
      reject(new SubstrateRpcError(`Timed out connecting to ${url}`));
    }, timeoutMs);

    const failAll = (err: Error) => {
      for (const p of pending.values()) {
        clearTimeout(p.timer);
        p.reject(err);
      }
      pending.clear();
    };

    ws.onerror = () => {
      clearTimeout(openTimer);
      const err = new SubstrateRpcError(`Cannot connect to ${url}`);
      failAll(err);
      reject(err);
    };
    ws.onclose = () => failAll(new SubstrateRpcError(`Connection to ${url} closed`));
    ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data)) as { id?: number; result?: unknown; error?: { code: number; message: string } };
      if (msg.id === undefined) return;
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.error) p.reject(new SubstrateRpcError(msg.error.message, msg.error.code));
      else p.resolve(msg.result);
    };
    ws.onopen = () => {
      clearTimeout(openTimer);
      resolve({
        request<T>(method: string, params: unknown[] = []) {
          return new Promise<T>((res, rej) => {
            const id = ++nextId;
            const timer = setTimeout(() => {
              pending.delete(id);
              rej(new SubstrateRpcError(`${method} timed out`));
            }, timeoutMs);
            pending.set(id, { resolve: res as (v: unknown) => void, reject: rej, timer });
            ws.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
          });
        },
        close: () => ws.close(),
      });
    };
  });
}

// ---------------------------------------------------------------------------
// system.account

/** Storage key of `System.Account(accountId)`: twox128("System") ++ twox128("Account") ++ blake2_128(id) ++ id. */
export function systemAccountKey(ss58: string): Hex {
  const id = hexToBytes(decodeSs58(ss58).accountId);
  return u8aToHex(
    concat(xxhashAsU8a("System", 128), xxhashAsU8a("Account", 128), blake2AsU8a(id, 128), id),
  ) as Hex;
}

export interface NativeAccountInfo {
  nonce: number;
  consumers: number;
  providers: number;
  sufficients: number;
  free: bigint;
  reserved: bigint;
  /** V2 (spec 1002). On the V3 testnet this slot is `frozen`. */
  miscFrozen: bigint;
  /** V2 (spec 1002). On the V3 testnet this slot is `flags` (bit 127 set), not a balance; ignore it there. */
  feeFrozen: bigint;
}

/** SCALE size of AccountInfo on portaldot spec 1002: 4 × u32 refcounts/nonce + 4 × u128 balances. */
export const ACCOUNT_INFO_BYTES = 80;

/**
 * Decode `frame_system::AccountInfo<u32, pallet_balances::AccountData<u128>>` as used by the
 * Portaldot V2 runtime (verified on mainnet, spec 1002: nonce matches `system_accountNextIndex`,
 * metadata has `UpgradedToTripleRefCount`). Other runtimes (e.g. V3) may differ — this throws then.
 */
export function decodeAccountInfo(hex: string): NativeAccountInfo {
  const bytes = hexToBytes(hex);
  if (bytes.length !== ACCOUNT_INFO_BYTES) {
    throw new SubstrateRpcError(
      `Unexpected AccountInfo size ${bytes.length} (expected ${ACCOUNT_INFO_BYTES}); the runtime layout differs from Portaldot V2`,
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u128 = (at: number) => view.getBigUint64(at, true) + (view.getBigUint64(at + 8, true) << 64n);
  return {
    nonce: view.getUint32(0, true),
    consumers: view.getUint32(4, true),
    providers: view.getUint32(8, true),
    sufficients: view.getUint32(12, true),
    free: u128(16),
    reserved: u128(32),
    miscFrozen: u128(48),
    feeFrozen: u128(64),
  };
}

const EMPTY_ACCOUNT: NativeAccountInfo = {
  nonce: 0,
  consumers: 0,
  providers: 0,
  sufficients: 0,
  free: 0n,
  reserved: 0n,
  miscFrozen: 0n,
  feeFrozen: 0n,
};

/** Native POT account of an SS58 address (all zeros if the account does not exist yet). */
export async function getNativeAccount(rpc: SubstrateRpc, ss58: string): Promise<NativeAccountInfo> {
  const value = await rpc.request<string | null>("state_getStorage", [systemAccountKey(ss58)]);
  return value ? decodeAccountInfo(value) : { ...EMPTY_ACCOUNT };
}

// ---------------------------------------------------------------------------
// chain info

export interface ChainProperties {
  ss58Format?: number;
  tokenDecimals?: number;
  tokenSymbol?: string;
}

/** Runtime API ids = blake2_64(name): "ReviveApi" (pallet-revive, EVM) and "ContractsApi" (pallet-contracts, WASM). */
export const REVIVE_API_ID = "0x8c403e5c4a9fd442";
export const CONTRACTS_API_ID = "0x68b66ba122c93fa7";

export interface NativeChainInfo {
  chain: string;
  nodeVersion: string;
  specName: string;
  specVersion: number;
  bestBlock: number;
  properties: ChainProperties;
  /** EVM execution: pallet-revive runtime API (V3; Ethereum RPC is a separate eth-rpc service) or `eth_*` on the node. */
  evm: boolean;
  /** WASM smart contracts (pallet-contracts / ink!): `ContractsApi` runtime API or `contracts_*` RPC. */
  wasmContracts: boolean;
  rpcMethodCount: number;
}

/** Read chain identity, properties and which execution environments the node exposes. */
export async function getNativeChainInfo(rpc: SubstrateRpc): Promise<NativeChainInfo> {
  const [chain, nodeVersion, runtime, header, rawProps, methods] = await Promise.all([
    rpc.request<string>("system_chain"),
    rpc.request<string>("system_version"),
    rpc.request<{ specName: string; specVersion: number; apis?: [string, number][] }>("state_getRuntimeVersion"),
    rpc.request<{ number: string }>("chain_getHeader"),
    rpc.request<Record<string, unknown>>("system_properties"),
    rpc.request<{ methods: string[] }>("rpc_methods"),
  ]);
  const first = (v: unknown) => (Array.isArray(v) ? v[0] : v);
  const hasApi = (id: string) => (runtime.apis ?? []).some(([apiId]) => apiId === id);
  const properties: ChainProperties = {};
  const ss58 = first(rawProps.ss58Format);
  const decimals = first(rawProps.tokenDecimals);
  const symbol = first(rawProps.tokenSymbol);
  if (typeof ss58 === "number") properties.ss58Format = ss58;
  if (typeof decimals === "number") properties.tokenDecimals = decimals;
  if (typeof symbol === "string") properties.tokenSymbol = symbol;
  return {
    chain,
    nodeVersion,
    specName: runtime.specName,
    specVersion: runtime.specVersion,
    bestBlock: parseInt(header.number, 16),
    properties,
    evm: hasApi(REVIVE_API_ID) || methods.methods.some((m) => m.startsWith("eth_")),
    wasmContracts: hasApi(CONTRACTS_API_ID) || methods.methods.some((m) => m.startsWith("contracts_")),
    rpcMethodCount: methods.methods.length,
  };
}

// ---------------------------------------------------------------------------

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) throw new SubstrateRpcError(`Invalid hex: ${hex.slice(0, 20)}…`);
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
