# Portaldot V3 findings

Tracks the open questions in CLAUDE.md §5. **Nothing here is assumed**: each item is either
answered with a source or still open. When an answer lands, update `config/networks.json`
(replace the `"TODO"`) and the code that depends on it.

Last checked: **2026-09-30**

## Status of V3 source

- Official org: https://github.com/portaldotVolunteer (Portaldot, Portaldot-node, DeveloperPlatform, Portaldot-Extension, Whitepaper, …).
- `Portaldot/Cargo.toml` on `main` includes `frame/contracts` (WASM/ink!) but **no `pallet-evm` / Frontier** → V3 (EVM) code is not public yet.
- Dev docs: https://portaldot-dev.readthedocs.io

## Open questions (§5)

| # | Question | Status | Answer / source | Affects |
|---|---|---|---|---|
| 1 | EVM implementation (Frontier / pallet-evm?) | ⏳ open | — | doctor, RPC assumptions |
| 2 | Standard Ethereum JSON-RPC (`eth_*`)? endpoint? MetaMask-compatible? | ⏳ open | — | `networks.json` `rpcUrl`, dashboard |
| 3 | EVM chainId; POT decimals on the EVM side | ⏳ open | — | `networks.json` `chainId`, `nativeDecimals` |
| 4 | H160 ↔ SS58 account mapping | ⏳ open | — | `@portalkit/address` (`pending-v3` strategy) |
| 5 | Precompiles for EVM → WASM/native calls | ⏳ open | — | dual-VM features |
| 6 | Public testnet + faucet? node binary OSes? | ⏳ open | — | faucet panel, M1 |
| 7 | Block explorer / Blockscout for EVM; verification | ⏳ open | — | `networks.json` `explorer` |
| 8 | Judging rules, submission requirements, best track | ⏳ open | — | M4 |

## SS58 prefix (for `@portalkit/address`)

- **`ss58-registry.json`** (repo root, identical on `main` and `master`) is an unmodified upstream
  Substrate registry: 59 entries (`0:polkadot` … `10041:basilisk`), **no Portaldot / POT entry**.
  It cannot be used to determine Portaldot's prefix.
- **V2 runtime source** — `bin/node/runtime/src/lib.rs`: `spec_name: "portaldot"`,
  `spec_version: 1001`, `pub const SS58Prefix: u16 = 42;` (L189). 42 = generic `substrate` prefix.
  Recorded as `portaldot-v2.ss58Prefix = 42` in `config/networks.json`.
- ⚠️ Not verified against a live chain. CLAUDE.md says the live runtime is `portaldot-1002`, newer
  than the `1001` in source. Verify with `system_properties` → `ss58Format` on a running V2 node.
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
