# On-chain evidence

Record every deployment and demo transaction on Portaldot here (M1 / M4). Addresses also land in
`config/deployments/<chainId>.json` automatically when `Deploy.s.sol` runs with `--broadcast`.

## Portaldot V3 (EVM)

_Pending — V3 not public as of 2026-10-02 (see [`v3-findings.md`](v3-findings.md))._

| Date | Network (chainId) | Contract / action | Address | Tx hash | Explorer |
|---|---|---|---|---|---|
| | | MockRWA deploy | | | |
| | | RWAVault deploy | | | |
| | | Deposit / yield / withdraw demo | | | |

```bash
# when V3 is configured in config/networks.json
node packages/cli/dist/portalkit.js doctor -n portaldot-v3
cd contracts && PORTALDOT_V3_RPC_URL=<rpc> PRIVATE_KEY=<funded key> \
  forge script script/Deploy.s.sol --rpc-url portaldot_v3 --broadcast
```

## Portaldot mainnet (native, read-only checks)

| Date | Check | Result |
|---|---|---|
| 2026-10-02 | `portalkit doctor -n portaldot-mainnet` | ✅ ss58 42 · 14 decimals · POT · runtime `portaldot` 1002 · EVM not available · WASM contracts available |
| 2026-10-02 | Native account read (`5GHBWSmwFuzown3aG1edDEGN6tD1qqCmxmMRmWiQ1YnFbBKk`) | ✅ free balance + nonce match `system_accountNextIndex` |

## Local (Anvil, chainId 31337)

Deterministic addresses from `Deploy.s.sol` with Anvil key #0: MockRWA `0x5FbDB2315678afecb367f032d93F642f64180aa3`,
RWAVault `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`.
