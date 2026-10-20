# On-chain evidence

Record every deployment and demo transaction on Portaldot here (M1 / M4). Addresses also land in
`config/deployments/<chainId>.json` automatically when `Deploy.s.sol` runs with `--broadcast`.

## Portaldot V3 (EVM)

_Pending — testnet live since 2026-10-20; waiting for a funded deployer. Dry-runs (`eth_estimateGas`) of both solc-built
contracts succeed (see [`v3-findings.md`](v3-findings.md))._

| Date | Network (chainId) | Contract / action | Address | Tx hash | Explorer |
|---|---|---|---|---|---|
| | | MockRWA deploy | | | |
| | | RWAVault deploy | | | |
| | | Deposit / yield / withdraw demo | | | |

```bash
node packages/cli/dist/portalkit.js doctor -n portaldot-v3 --address <deployer 0x…>
# PRIVATE_KEY in contracts/.env (never committed)
cd contracts && forge script script/Deploy.s.sol --rpc-url portaldot_v3 --broadcast
```

## Portaldot V3 testnet (read-only checks)

| Date | Check | Result |
|---|---|---|
| 2026-10-20 | `portalkit doctor -n portaldot-v3 --address 0xd9838a86cf83c28ee486544060d1ca4ca2971071` | ✅ chainId 420420777 · 9/9 required `eth_*` · EIP-1559 · balance 182.99 tPOT |
| 2026-10-20 | `portalkit doctor -n portaldot-v3-native --address 5GyuKkF3Hpv6aRwFa5BtcWvXLqGDjGfMLi1f2jFraJ4Zuef5` | ✅ ss58 42 · 14 decimals · tPOT · runtime `portaldot-v3` 3002 · EVM available · WASM contracts available |
| 2026-10-20 | `eth_estimateGas` create of solc-built MockRWA / RWAVault | ✅ accepted (7.1e15 / 1.5e16 gas) |

## Portaldot mainnet (native, read-only checks)

| Date | Check | Result |
|---|---|---|
| 2026-10-02 | `portalkit doctor -n portaldot-mainnet` | ✅ ss58 42 · 14 decimals · POT · runtime `portaldot` 1002 · EVM not available · WASM contracts available |
| 2026-10-02 | Native account read (`5GHBWSmwFuzown3aG1edDEGN6tD1qqCmxmMRmWiQ1YnFbBKk`) | ✅ free balance + nonce match `system_accountNextIndex` |

## Local (Anvil, chainId 31337)

Deterministic addresses from `Deploy.s.sol` with Anvil key #0: MockRWA `0x5FbDB2315678afecb367f032d93F642f64180aa3`,
RWAVault `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`.
