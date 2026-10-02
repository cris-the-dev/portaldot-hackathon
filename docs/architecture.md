# Architecture

## Principles

1. **One config file.** `config/networks.json` holds every chainId, RPC/WS URL, decimals, explorer, faucet and SS58 prefix.
   Nothing else hardcodes them. Generated projects get their own snapshot (`networks.json`) so they can evolve independently.
2. **Unknowns are explicit.** Any value may be the string `"TODO"`. `@portalkit/chains` validates the file with zod and splits
   networks into *ready* and *pending*:
   - EVM networks are pending while `chainId`, `rpcUrl` or `nativeDecimals` is TODO → `getEvmChain()` throws
     `NetworkNotConfiguredError` naming the missing fields; wagmi configs simply skip them.
   - Optional TODOs (`wsUrl`, `explorer`, `faucetUrl`, `ss58Prefix`) are omitted from the viem chain and shown in the UI.
3. **Anvil-first.** Every EVM feature is exercised on a local Anvil node (unit tests, integration tests, browser E2E) before it
   ever touches V3.
4. **Strategies for what V3 hasn't specified.** The H160 ↔ SS58 account mapping is an `AddressMappingStrategy` interface with a
   registry. Today only `pending-v3` exists and it refuses to guess; the real one plugs in without touching callers.
5. **Verify, don't assume.** Native-side facts (SS58 42, POT 14 decimals, `AccountInfo` layout) were read from live mainnet and
   are covered by fixtures + an opt-in live test.

## Components

```
config/networks.json ─┬─► @portalkit/chains ──┬─► @portalkit/cli (doctor, create-portalkit-app)
                      │   (zod, TODO-aware,   ├─► apps/dashboard
                      │    env overrides)     └─► apps/vault
                      │
                      └─► generated projects (snapshot)

@portalkit/address ── SS58 encode/decode/validate
                   ── AddressMappingStrategy + StrategyRegistry (pending-v3)
                   ── native RPC: connectSubstrate, getNativeChainInfo, getNativeAccount

@portalkit/templates ── files/base · files/foundry · files/hardhat · files/web

contracts/ ── MockRWA, RWAVault ── script/Deploy.s.sol ──► config/deployments/<chainId>.json ──► apps/vault (generated index)
```

### `@portalkit/chains`
- `parseNetworksConfig(raw)` — zod schema, discriminated by `vm: "evm" | "substrate"`.
- `getEvmChain(key)`, `getEvmChains()`, `listNetworks()`, `getNetwork(key)`.
- Env overrides `PORTALKIT_RPC_URL_<KEY>` / `PORTALKIT_WS_URL_<KEY>`; the browser passes `env: {}` so SSR and CSR agree.
- The root JSON is inlined by tsup at build time, so the published package carries the same source of truth.

### `@portalkit/address`
- SS58 via `@polkadot/util-crypto` (checksum verified, prefix extracted).
- Native helpers use **raw JSON-RPC over WebSocket** (global `WebSocket`: browsers and Node ≥ 22) instead of `@polkadot/api`,
  because the V2 runtime (Substrate 3.0, spec 1002) is not fully decodable by current api versions.
- `decodeAccountInfo` — 80 bytes: `nonce, consumers, providers, sufficients` (u32) + `free, reserved, miscFrozen, feeFrozen`
  (u128). Verified on mainnet: nonce equals `system_accountNextIndex`, metadata contains `UpgradedToTripleRefCount`.
  Any other size throws instead of mis-decoding (V3 may change the layout).

### `@portalkit/cli`
- `portalkit doctor` dispatches on `vm`:
  - **EVM:** config → `eth_blockNumber` → chainId vs config → 9 required `eth_*` methods (fail) + 4 optional (warn) → deployer
    balance (`--address` or `PRIVATE_KEY`).
  - **Substrate:** config → node info → `system_properties` vs config (mismatch = fail, config TODO = warn with the node's
    value) → runtime → execution environments (`eth_*` present? `contracts_*` present?) → SS58 balance.
- `create-portalkit-app` copies template sets, replaces `{{placeholders}}`, writes the networks snapshot, then optionally runs
  `git init`, `forge install forge-std` (Foundry) and `pnpm install`. Hardhat projects make `contracts/` a workspace package and
  pre-approve esbuild's build script (pnpm 11 blocks it otherwise). `--portalkit <path>` packs the local packages with
  `pnpm pack` and points overrides at the tarballs — exactly what users would get from npm.

### Dashboard (`apps/dashboard`)
Next.js 16 App Router, wagmi 3 + viem, Tailwind 4.
- `lib/wagmi.ts` builds the wagmi config from `getEvmChains()`.
- `lib/abi-args.ts` parses form text into ABI values (ints with range checks, addresses → checksum, bytesN length, arrays and
  tuples as JSON). `lib/artifact.ts` accepts Foundry/Hardhat artifacts or a bare ABI.
- Pages: Get started (wallet, `wallet_addEthereumChain`, faucet: official URL or Anvil dev node via `anvil_setBalance`,
  network table, native V3-readiness card) · Deploy · Playground (reads, writes, receipt + historical log decoding) · Address
  (EVM checksum, SS58 re-encoding per configured prefix, live native POT balance, mapping strategy).

### PortalVault (`apps/vault`)
- `scripts/sync-contracts.mjs` generates `src/generated/abis.ts` (from `contracts/out`) and `deployments.ts`
  (from `config/deployments/*.json`) before `dev`/`build`.
- Reads are batched with `useReadContracts` (metadata once, live values every 5 s); writes go through `useTxRunner`
  (sequential approve → action, wait for receipts, invalidate queries).
- Display rounding is half-up (ERC-4626 rounds 1 wei in the vault's favour; truncation would show `109.9999`), and a
  "withdraw 110" within 1e-6 of the max becomes redeem-all.

### Contracts
- `MockRWA` — ERC-20 + AccessControl (`ISSUER_ROLE` mints), burnable.
- `RWAVault` — ERC-4626 with `_decimalsOffset = 6` (inflation-attack resistance), `depositYield` (`YIELD_MANAGER_ROLE`),
  simulated KYC (`COMPLIANCE_ROLE`): `maxDeposit`/`maxMint` return 0 for unverified receivers (ERC-4626-conformant), share
  transfers to unverified accounts revert, burns are never gated.
- `Deploy.s.sol` — writes `config/deployments/<chainId>.json` on `--broadcast`; KYC on by default with the issuer verified.

## Testing

| Layer | How |
|---|---|
| Contracts | Foundry unit + fuzz tests (60), including inflation attack and compliance edge cases |
| Packages | Vitest; doctor against a mocked RPC **and** a real Anvil; native helpers with mainnet fixtures + opt-in live test (`PORTALKIT_LIVE_TESTS=1`) |
| Apps | Vitest for parsing/formatting; Playwright smoke tests (`pnpm -F … e2e`) with an injected EIP-1193 wallet that forwards to Anvil |
| Scaffolder | Unit tests on generated files; manual end-to-end runs for both presets (scaffold → test → deploy → build → browser) |
| CI | GitHub Actions: lint, typecheck, Vitest (with Anvil), build; `forge fmt --check`, `forge build`, `forge test` |
