# On-chain evidence

Record every deployment and demo transaction on Portaldot here (M1 / M4). Addresses also land in
`config/deployments/<chainId>.json` automatically when `Deploy.s.sol` runs with `--broadcast`.

## Portaldot V3 (EVM)

Deployer `0x55Ae2683ECBa375e737D926e38926430A4dA7d1D` (gas account `5E13fHMRzQL6FLyguBN9CZiU9EPyQMy349WLCv7fq9qVj6My`,
funded from a native `5…` wallet). No EVM explorer yet; tx hashes can be checked with `cast receipt <hash> --rpc-url portaldot_v3`.

| Date | Network (chainId) | Contract / action | Address | Tx hash | Explorer |
|---|---|---|---|---|---|
| 2026-10-22 | Portaldot V3 testnet (420420777) | MockRWA deploy (block 147802, fee 260.56 tPOT) | `0x1ac55f7161efa932aa6963e86fac92b74d45094d` | `0x95a99ede50a69c139ebdec972e867f665fef502cbb55428cae9f82fd90bf0d96` | — |
| 2026-10-23 | Portaldot V3 testnet (420420777) | MockRWA `mint` 1,000 tGOLD → deployer (block 156732, fee 7.70 tPOT) | `0x1ac55f7161efa932aa6963e86fac92b74d45094d` | `0x9150a227c5e151f6bdf2cb32b424a05db9e67d275566e4a44453197602db3280` | — |
| 2026-10-23 | Portaldot V3 testnet (420420777) | `Counter` from `create-portalkit-app` (Foundry), `pnpm deploy:portaldot` (block 157901, fee 62.95 tPOT, 638 B code) | `0x0A030CAB2B53B958740BbFF468C30B9e00694399` | `0x7654fba2dd2547205c0a7abdb8db23a517d0a39220c478d6e78e4359d42ee0a9` | — |
| 2026-10-23 | Portaldot V3 testnet (420420777) | `Counter.increment()` → `number()` = 1, `NumberChanged` emitted (block 157913, fee 3.85 tPOT) | `0x0A030CAB2B53B958740BbFF468C30B9e00694399` | `0xbecf348c7eebd8843e313abe0da283350cd89dec5c6ec8fbfbbeac4b382becb6` | — |
| 2026-10-23 | Portaldot V3 testnet (420420777) | **RWAVault deploy** (block 161010, fee 550.98 tPOT — mostly code storage deposit) | `0xe5378c971cf26453926b941dabf247cf1fd44697` | `0xc5b73bdc7aa3921885c6b0df0ff2c13c0245d3e04ad4d6c4db8c9f5f5cff2943` | — |
| 2026-10-23 | Portaldot V3 testnet (420420777) | RWAVault `setVerified(deployer, true)` — simulated KYC (block 161014) | `0xe5378c971cf26453926b941dabf247cf1fd44697` | `0x48225d99dfa9420e90769990a738888e62b5a280f04fc5bda59d5f98da942b86` | — |
| 2026-10-23 | Portaldot V3 testnet (420420777) | RWAVault `setKycRequired(true)` (block 161016) | `0xe5378c971cf26453926b941dabf247cf1fd44697` | `0xf94945136a8a0548122e0b43f421487ea24af13543ae961072d738dd983b3af8` | — |
| 2026-10-23 | Portaldot V3 testnet (420420777) | MockRWA `approve(vault)` (block 161017) | `0x1ac55f7161efa932aa6963e86fac92b74d45094d` | `0x86382dafd81ea15c0bfd9d45ea1051f836a7769568406fc33d751483fa6601f3` | — |
| 2026-10-23 | Portaldot V3 testnet (420420777) | Vault `deposit` 100 tGOLD (block 161018) | `0xe5378c971cf26453926b941dabf247cf1fd44697` | `0xd10e4293b49f5c49a74a4469c939fc0fc1a19b06933dc89fba1e5f5d1d41e041` | — |
| 2026-10-23 | Portaldot V3 testnet (420420777) | Vault `depositYield` 10 tGOLD → share price 1.1 (block 161019) | `0xe5378c971cf26453926b941dabf247cf1fd44697` | `0x2e3ff73daa71a54427ddc58122ae142ede471400deaf8a905044b08667bf0f36` | — |
| 2026-10-23 | Portaldot V3 testnet (420420777) | Vault `withdraw` 50 tGOLD (block 161021) | `0xe5378c971cf26453926b941dabf247cf1fd44697` | `0xf7bca478e5cc63b03c45a4a4f713ba56fda51145662888b0e305d5814b0e19a4` | — |
| 2026-10-24 | Portaldot V3 testnet (420420777) | **Demo video:** `Counter` deployed through the live dashboard deploy wizard (block 169904, fee 20.47 tPOT — code already on chain, so no code deposit) | `0xb3c1e21c934b4a4040f129483acaf9c7241a1cc0` | `0x3d6ded542abbbe7011cf666c748ad4f431c213d690652efe4d9742682247ee22` | — |
| 2026-10-24 | Portaldot V3 testnet (420420777) | **Demo video:** `increment()` from the ABI playground, `NumberChanged` decoded (block 169906, fee 3.85 tPOT) | `0xb3c1e21c934b4a4040f129483acaf9c7241a1cc0` | `0x578c614f7cf0323c27f2e7ef60136675a82836657e52d5274e25cac38ba460d1` | — |
| 2026-10-24 | Portaldot V3 testnet (420420777) | **Demo video:** PortalVault UI deposit 100 tGOLD (block 169974) | `0xe5378c971cf26453926b941dabf247cf1fd44697` | `0xa7616dde491f8bc375c5a07dcf36b44065dbf513a5ae6dbb81481f38d2ad4d3d` | — |
| 2026-10-24 | Portaldot V3 testnet (420420777) | **Demo video:** PortalVault UI distribute 10 tGOLD yield → share price 1.16875 (block 169976) | `0xe5378c971cf26453926b941dabf247cf1fd44697` | `0x688e378ef4b05d5c281f7727e7f8576fbfd119e960986148348ad5ee616613e2` | — |
| 2026-10-24 | Portaldot V3 testnet (420420777) | **Demo video:** PortalVault UI withdraw 50 tGOLD (block 169978) | `0xe5378c971cf26453926b941dabf247cf1fd44697` | `0xd9719ebd2b9178d77d94816da790ca1ccb36b99dc78896f48eb34df8e9df014e` | — |

```bash
node packages/cli/dist/portalkit.js doctor -n portaldot-v3 --address <deployer 0x…>
# PRIVATE_KEY in contracts/.env (never committed)
cd contracts && forge script script/Deploy.s.sol --rpc-url portaldot_v3 --broadcast --legacy --skip-simulation
```

## Portaldot V3 testnet (native transfers)

| Date | Action | Tx hash |
|---|---|---|
| 2026-10-22 | 300 tPOT `5HWHon…6Byra` → `5E13fHMR…Vj6My` (deployer's mapped account; shows as 299.9 tPOT via `eth_getBalance`) | `0xc0c8e69d6cde82520f4738089a2b5c702689e6a20c565ba8d2d43af3ce251c16` (block `0x0b6398…d2e4`) |
| 2026-10-23 | 650 tPOT `5HWHon…6Byra` → `5E13fHMR…Vj6My` through the live dashboard Fund card (for the RWAVault deploy) | `0x23c492ffa6253e8345ae9bb1ce8cfc8001d0dcac7589aa5f8a0ee950ec6d6aef` |
| 2026-10-23 | 100 tPOT `5HWHon…6Byra` → `5E13fHMR…Vj6My` **through the live dashboard** (Address page → *Fund this EVM account*; signer injected in place of the extension, keystore kept local) — [screenshot](images/fund-evm-account-v3.png) | `0x663b2523790bbafc59f733bc01953f08b441ca6acf2db528bf46ad52e7cdf380` |

## Portaldot V3 testnet (read-only checks)

| Date | Check | Result |
|---|---|---|
| 2026-10-20 | `portalkit doctor -n portaldot-v3 --address 0xd9838a86cf83c28ee486544060d1ca4ca2971071` | ✅ chainId 420420777 · 9/9 required `eth_*` · EIP-1559 · balance 182.99 tPOT |
| 2026-10-20 | `portalkit doctor -n portaldot-v3-native --address 5GyuKkF3Hpv6aRwFa5BtcWvXLqGDjGfMLi1f2jFraJ4Zuef5` | ✅ ss58 42 · 14 decimals · tPOT · runtime `portaldot-v3` 3002 · EVM available · WASM contracts available |
| 2026-10-23 | `portalkit doctor -n portaldot-v3 --address 0x55Ae…7d1D` | ✅ all required checks · block #156735 in 817 ms (earlier `eth_getBlockByNumber` timeout was transient) |
| 2026-10-20 | `eth_estimateGas` create of solc-built MockRWA / RWAVault | ✅ accepted (7.1e15 / 1.5e16 gas) |
| 2026-10-24 | `eth_estimateGas` of the MockRWA create, original bytecode vs. one metadata byte changed | 2.42e15 gas (≈79 tPOT; code hash already on chain) vs. 8.08e15 gas (≈283 tPOT; new code hash) — the code storage deposit is charged once per code hash |

## Portaldot mainnet (native, read-only checks)

| Date | Check | Result |
|---|---|---|
| 2026-10-02 | `portalkit doctor -n portaldot-mainnet` | ✅ ss58 42 · 14 decimals · POT · runtime `portaldot` 1002 · EVM not available · WASM contracts available |
| 2026-10-02 | Native account read (`5GHBWSmwFuzown3aG1edDEGN6tD1qqCmxmMRmWiQ1YnFbBKk`) | ✅ free balance + nonce match `system_accountNextIndex` |

## Local (Anvil, chainId 31337)

Deterministic addresses from `Deploy.s.sol` with Anvil key #0: MockRWA `0x5FbDB2315678afecb367f032d93F642f64180aa3`,
RWAVault `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`.
