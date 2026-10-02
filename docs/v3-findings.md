# Portaldot V3 findings

Tracks the open questions in CLAUDE.md §5. **Nothing here is assumed**: each item is either
answered with a source or still open. When an answer lands, update `config/networks.json`
(replace the `"TODO"`) and the code that depends on it.

Last checked: **2026-10-02**

## Status of V3 source

- Official org: https://github.com/portaldotVolunteer (Portaldot, Portaldot-node, DeveloperPlatform, Portaldot-Extension, Whitepaper, …).
- `Portaldot/Cargo.toml` on `main` includes `frame/contracts` (WASM/ink!) but **no `pallet-evm` / Frontier** → V3 (EVM) code is not public yet.
- Dev docs: https://portaldot-dev.readthedocs.io

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
| 1 | EVM implementation (Frontier / pallet-evm?) | ⏳ open | — | doctor, RPC assumptions |
| 2 | Standard Ethereum JSON-RPC (`eth_*`)? endpoint? MetaMask-compatible? | ⏳ open | — | `networks.json` `rpcUrl`, dashboard |
| 3 | EVM chainId; POT decimals on the EVM side | ⏳ open | Native side verified: 14 decimals (mainnet). EVM side unknown. | `networks.json` `chainId`, `nativeDecimals` |
| 4 | H160 ↔ SS58 account mapping | ⏳ open | — | `@portalkit/address` (`pending-v3` strategy) |
| 5 | Precompiles for EVM → WASM/native calls | ⏳ open | — | dual-VM features |
| 6 | Public testnet + faucet? node binary OSes? | ⏳ open | No public testnet found (2026-10-02); V2 binaries Linux/macOS only. | faucet panel, M1 |
| 7 | Block explorer / Blockscout for EVM; verification | ⏳ open | — | `networks.json` `explorer` |
| 8 | Judging rules, submission requirements, best track | ⏳ open | Not published yet; ask organizers on Discord. | M4 |

## SS58 prefix (for `@portalkit/address`)

- **`ss58-registry.json`** (repo root, identical on `main` and `master`) is an unmodified upstream
  Substrate registry: 59 entries (`0:polkadot` … `10041:basilisk`), **no Portaldot / POT entry**.
  It cannot be used to determine Portaldot's prefix.
- **V2 runtime source** — `bin/node/runtime/src/lib.rs`: `spec_name: "portaldot"`,
  `spec_version: 1001`, `pub const SS58Prefix: u16 = 42;` (L189). 42 = generic `substrate` prefix.
  Recorded as `portaldot-v2.ss58Prefix = 42` in `config/networks.json`.
- ✅ **Verified on the live chain (2026-10-02):** mainnet `system_properties.ss58Format = 42` (runtime 1002).
- V3 may change it → `portaldot-v3.ss58Prefix` stays `"TODO"`.

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
