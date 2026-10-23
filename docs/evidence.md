# On-chain evidence

Record every deployment and demo transaction on Portaldot here (M1 / M4). Addresses also land in
`config/deployments/<chainId>.json` automatically when `Deploy.s.sol` runs with `--broadcast`.

## Portaldot V3 (EVM)

Deployer `0x55Ae2683ECBa375e737D926e38926430A4dA7d1D` (gas account `5E13fHMRzQL6FLyguBN9CZiU9EPyQMy349WLCv7fq9qVj6My`,
funded from a native `5…` wallet). RWAVault is pending more tPOT (~560 tPOT storage deposit, see
[`v3-findings.md`](v3-findings.md)). No EVM explorer yet; tx hashes can be checked with `cast receipt <hash> --rpc-url portaldot_v3`.

| Date | Network (chainId) | Contract / action | Address | Tx hash | Explorer |
|---|---|---|---|---|---|
| 2026-10-22 | Portaldot V3 testnet (420420777) | MockRWA deploy (block 147802, fee 260.56 tPOT) | `0x1ac55f7161efa932aa6963e86fac92b74d45094d` | `0x95a99ede50a69c139ebdec972e867f665fef502cbb55428cae9f82fd90bf0d96` | — |
| 2026-10-23 | Portaldot V3 testnet (420420777) | MockRWA `mint` 1,000 tGOLD → deployer (block 156732, fee 7.70 tPOT) | `0x1ac55f7161efa932aa6963e86fac92b74d45094d` | `0x9150a227c5e151f6bdf2cb32b424a05db9e67d275566e4a44453197602db3280` | — |
| 2026-10-23 | Portaldot V3 testnet (420420777) | `Counter` from `create-portalkit-app` (Foundry), `pnpm deploy:portaldot` (block 157901, fee 62.95 tPOT, 638 B code) | `0x0A030CAB2B53B958740BbFF468C30B9e00694399` | `0x7654fba2dd2547205c0a7abdb8db23a517d0a39220c478d6e78e4359d42ee0a9` | — |
| 2026-10-23 | Portaldot V3 testnet (420420777) | `Counter.increment()` → `number()` = 1, `NumberChanged` emitted (block 157913, fee 3.85 tPOT) | `0x0A030CAB2B53B958740BbFF468C30B9e00694399` | `0xbecf348c7eebd8843e313abe0da283350cd89dec5c6ec8fbfbbeac4b382becb6` | — |
| | | RWAVault deploy | | | |
| | | Deposit / yield / withdraw demo | | | |

```bash
node packages/cli/dist/portalkit.js doctor -n portaldot-v3 --address <deployer 0x…>
# PRIVATE_KEY in contracts/.env (never committed)
cd contracts && forge script script/Deploy.s.sol --rpc-url portaldot_v3 --broadcast --legacy --skip-simulation
```

## Portaldot V3 testnet (native transfers)

| Date | Action | Tx hash |
|---|---|---|
| 2026-10-22 | 300 tPOT `5HWHon…6Byra` → `5E13fHMR…Vj6My` (deployer's mapped account; shows as 299.9 tPOT via `eth_getBalance`) | `0xc0c8e69d6cde82520f4738089a2b5c702689e6a20c565ba8d2d43af3ce251c16` (block `0x0b6398…d2e4`) |
| 2026-10-23 | 100 tPOT `5HWHon…6Byra` → `5E13fHMR…Vj6My` **through the live dashboard** (Address page → *Fund this EVM account*; signer injected in place of the extension, keystore kept local) — [screenshot](images/fund-evm-account-v3.png) | `0x663b2523790bbafc59f733bc01953f08b441ca6acf2db528bf46ad52e7cdf380` |

## Portaldot V3 testnet (read-only checks)

| Date | Check | Result |
|---|---|---|
| 2026-10-20 | `portalkit doctor -n portaldot-v3 --address 0xd9838a86cf83c28ee486544060d1ca4ca2971071` | ✅ chainId 420420777 · 9/9 required `eth_*` · EIP-1559 · balance 182.99 tPOT |
| 2026-10-20 | `portalkit doctor -n portaldot-v3-native --address 5GyuKkF3Hpv6aRwFa5BtcWvXLqGDjGfMLi1f2jFraJ4Zuef5` | ✅ ss58 42 · 14 decimals · tPOT · runtime `portaldot-v3` 3002 · EVM available · WASM contracts available |
| 2026-10-23 | `portalkit doctor -n portaldot-v3 --address 0x55Ae…7d1D` | ✅ all required checks · block #156735 in 817 ms (earlier `eth_getBlockByNumber` timeout was transient) |
| 2026-10-20 | `eth_estimateGas` create of solc-built MockRWA / RWAVault | ✅ accepted (7.1e15 / 1.5e16 gas) |

## Portaldot mainnet (native, read-only checks)

| Date | Check | Result |
|---|---|---|
| 2026-10-02 | `portalkit doctor -n portaldot-mainnet` | ✅ ss58 42 · 14 decimals · POT · runtime `portaldot` 1002 · EVM not available · WASM contracts available |
| 2026-10-02 | Native account read (`5GHBWSmwFuzown3aG1edDEGN6tD1qqCmxmMRmWiQ1YnFbBKk`) | ✅ free balance + nonce match `system_accountNextIndex` |

## Local (Anvil, chainId 31337)

Deterministic addresses from `Deploy.s.sol` with Anvil key #0: MockRWA `0x5FbDB2315678afecb367f032d93F642f64180aa3`,
RWAVault `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`.
