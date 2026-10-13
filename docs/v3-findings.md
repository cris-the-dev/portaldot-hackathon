# Portaldot V3 findings

Tracks the open questions in CLAUDE.md §5. **Nothing here is assumed**: each item is either
answered with a source or still open. When an answer lands, update `config/networks.json`
(replace the `"TODO"`) and the code that depends on it.

Last checked: **2026-10-13**

## Status of V3 source

- Official org: https://github.com/portaldotVolunteer (Portaldot, Portaldot-node, DeveloperPlatform, Portaldot-Extension, Whitepaper, …).
- `Portaldot/Cargo.toml` on `main` includes `frame/contracts` (WASM/ink!) but **no `pallet-evm` / Frontier** → V3 (EVM) code is not public yet.
- Dev docs: https://portaldot-dev.readthedocs.io

## Check of 2026-10-13

- **V3 testnet guide found**: [ItsCogumellum/portaldot-v3-testnet-guide](https://github.com/ItsCogumellum/portaldot-v3-testnet-guide)
  (self-described "official PortaldotV3 Testnet documentation and sample code, provided by the Portaldot team"; English
  translation of *PortaldotV3 Testnet说明文档*; commits 2026-10-02, FAQ 2026-10-07). Hosted on a personal account, so treat as
  semi-official until the organizers confirm.
  - Substrate `wss://testnetv3-node.feso-apps.xyz` · EVM JSON-RPC `https://testnetv3-eth-rpc.feso-apps.xyz` ·
    **chainId 420420777** · **tPOTv3, 14 decimals** · node explorer `https://node-console.feso-apps.xyz/` (polkadot.js-apps style).
  - **EVM = Revive** (`reviveApi` runtime calls, `Revive → call` extrinsic) → pallet-revive, not Frontier. Other teams
    confirm pallet-revive / PolkaVM / `resolc` ([PotScan](https://github.com/yeziR4/potscan)).
  - Tooling documented: MetaMask, Remix ("Injected MetaMask"), Hardhat (solc 0.8.24). **Foundry is untested/undocumented.**
  - **No faucet**: tokens are sent from the node explorer to the account's *mapped Substrate address*.
  - FAQ: testnet chainId is not final for mainnet; mainnet EVM tooling, account-mapping migration and launch date unconfirmed.
- **Testnet offline.** 2026-10-09 announcement (via [PortalPulse](https://github.com/JokerFuFu/portaldot-hacker-house-2026-portalpulse)):
  testnet being upgraded, old RPC info no longer valid, new RPC to be published. On 2026-10-13 all three `*.feso-apps.xyz`
  hosts return NXDOMAIN → `rpcUrl`/`wsUrl` stay `TODO` (override with `PORTALKIT_RPC_URL_PORTALDOT_V3` when announced).
- **Account mapping verified offline** from the guide's example `0xf7eC65d11e35375A250e474059a917B537804142` ↔
  `5Hfmuhj1AHrTBJiC9zUPnJo1cfG2G52LLMwofSigBnjtto8Y`: the SS58 decodes to
  `f7ec65d11e35375a250e474059a917b537804142` + `ee`×12 — exactly pallet-revive's rule (AccountId32 = H160 ++ 0xEE×12), prefix 42.
  Implemented as the `revive` strategy in `@portalkit/address` with this vector. The reverse for *native* accounts
  (upstream: `keccak256(AccountId32)[12..]`) is not confirmed for Portaldot → the strategy refuses instead of guessing.
- **Contracts compile for PolkaVM**: `forge flatten` + `resolc` 1.4.0 (`@parity/resolc`) builds `MockRWA` (35.9 KB) and
  `RWAVault` (75.7 KB) blobs (`PVM` magic header) without source changes. Whether Portaldot's revive also accepts plain EVM
  (solc) bytecode, and its code-size limit, are unknown until the testnet is back.
- **Build period**: 2026-10-13 16:00 UTC → 2026-11-06 04:00 UTC; demo day 2026-11-07/08
  ([KuCoin](https://www.kucoin.com/news/community/PORTAL/6ac1973d38a26400079273b5)). `portaldotVolunteer/Portaldot` still
  has no V3 code (last push 2026-06-25).

## Check of 2026-10-02

- **V3 code still not public.** `portaldotVolunteer/Portaldot`, `Portaldot-node`, `DeveloperPlatform` only have a `main`
  branch and no tags; `Portaldot` was last pushed 2026-06-25; `Cargo.toml` still has no `pallet-evm`/Frontier; no new repo in the org.
  Public statements only say V3 repos will be published "in early October" and the Hacker House starts Oct 14
  ([invitation](https://github.com/dzmbs/xprime/issues/7), [KuCoin news](https://www.kucoin.com/news/trends/USDT/6abbb998dbfa120007cad8bc)).
- **Live mainnet, queried directly** (`wss://mainnet.portaldot.io`, read-only RPC):
  `system_properties` → `ss58Format: 42`, `tokenDecimals: 14`, `tokenSymbol: "POT"`; runtime `portaldot` specVersion **1002**
  (`implName: substrate-node`); node `2.0.0`; 93 RPC methods, **no `eth_*`/`net_*`/`web3_*`** (`eth_chainId` → "Method not found");
  `contracts_*` RPC present (pallet-contracts from Substrate 3.0, ink! 3.x). Recorded as `portaldot-mainnet` in `config/networks.json`.
  → the V2 SS58 prefix 42 is now **verified**; native POT has **14 decimals** (the EVM-side value for V3 is still unknown).
- **No public testnet found.** `wss://testnet.portaldot.io`, `wss://rpc.portaldot.io`, `wss://testnet-rpc.portaldot.io` do not answer;
  community tooling documents only mainnet + local dev node (`portaldot_dev --dev`, Alice starts with 50,000 POT)
  ([portaldot-ink-toolchain](https://github.com/finfreedom/portaldot-ink-toolchain)).
- **Known V2 tooling quirks** (same source): current `@polkadot/api` cannot decode `system.events` on this chain; Python SDK needs
  `type_registry_preset="legacy"`; `contracts_call` accepts only five fields.
- **Submission rules:** not published yet. A search result claiming "deploying to the Portaldot testnet is a submission requirement"
  comes from a post about a different event (Hacker House Goa) and is **not** treated as a Portaldot rule.
- **Other teams:** e.g. *Potdo* — AI copilot turning plain English into native Substrate transactions
  ([repo](https://github.com/edycutjong/portaldot-hackathon-2026-potdo-edycu)). Native/Substrate side, no EVM → no overlap with PortalKit.

## Open questions (§5)

| # | Question | Status | Answer / source | Affects |
|---|---|---|---|---|
| 1 | EVM implementation (Frontier / pallet-evm?) | 🟡 likely | **pallet-revive** (Revive extrinsics/runtime API in the testnet guide; PolkaVM + `resolc` per other teams). Plain-EVM bytecode support unknown. | doctor, templates, deploy wizard |
| 2 | Standard Ethereum JSON-RPC (`eth_*`)? endpoint? MetaMask-compatible? | 🟡 documented | Yes per guide (MetaMask/Remix/Hardhat); endpoint withdrawn 2026-10-09, new one pending. | `networks.json` `rpcUrl`, dashboard |
| 3 | EVM chainId; POT decimals on the EVM side | 🟡 testnet | Testnet: chainId **420420777**, tPOTv3, **14 decimals** (guide). Not final for mainnet. | `networks.json` `chainId`, `nativeDecimals` |
| 4 | H160 ↔ SS58 account mapping | ✅ H160→SS58 | `H160 ++ 0xEE×12` (guide vector, decoded). Native SS58→H160 unconfirmed. | `@portalkit/address` (`revive` strategy) |
| 5 | Precompiles for EVM → WASM/native calls | ⏳ open | — | dual-VM features |
| 6 | Public testnet + faucet? node binary OSes? | 🟡 | Testnet exists but offline since 2026-10-09 (upgrade); no faucet (send from node explorer). | faucet panel, M1 |
| 7 | Block explorer / Blockscout for EVM; verification | 🟡 | Only a Substrate node explorer (node-console); no EVM explorer/verification documented. | `networks.json` `explorer` |
| 8 | Judging rules, submission requirements, best track | ⏳ open | Not published yet; ask organizers on Discord. | M4 |

## SS58 prefix (for `@portalkit/address`)

- **`ss58-registry.json`** (repo root, identical on `main` and `master`) is an unmodified upstream
  Substrate registry: 59 entries (`0:polkadot` … `10041:basilisk`), **no Portaldot / POT entry**.
  It cannot be used to determine Portaldot's prefix.
- **V2 runtime source** — `bin/node/runtime/src/lib.rs`: `spec_name: "portaldot"`,
  `spec_version: 1001`, `pub const SS58Prefix: u16 = 42;` (L189). 42 = generic `substrate` prefix.
  Recorded as `portaldot-v2.ss58Prefix = 42` in `config/networks.json`.
- ✅ **Verified on the live chain (2026-10-02):** mainnet `system_properties.ss58Format = 42` (runtime 1002).
- V3 testnet: the guide's mapped address `5Hfmuhj1…` is encoded with prefix 42 → `portaldot-v3.ss58Prefix = 42`.

## How to verify on a running node

```bash
# Substrate side (V2 or V3 node)
curl -s -H 'Content-Type: application/json' \
  -d '{"id":1,"jsonrpc":"2.0","method":"system_properties","params":[]}' http://127.0.0.1:9944
# -> ss58Format, tokenDecimals, tokenSymbol

# EVM side (V3, once available)
cast chain-id --rpc-url <V3_RPC>
cast client   --rpc-url <V3_RPC>
```
