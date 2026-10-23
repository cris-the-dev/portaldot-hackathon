# {{projectName}}

EVM dApp for Portaldot, scaffolded with [PortalKit](https://github.com/cris-the-dev/portaldot-hackathon).

```
contracts/      {{contractsDescription}}: Counter + tests + deploy script
web/            Next.js + wagmi + viem, chains from ../networks.json
networks.json   chainId / RPC / explorer per network (single source of truth)
deployments/    contract addresses per chainId, written by the deploy script
```

## Quickstart (local Anvil)

```bash
anvil                                   # terminal 1
cp .env.example .env
pnpm contracts:test                     # contract tests
set -a && . ./.env && set +a && pnpm deploy:anvil
pnpm dev                                # http://localhost:3000
pnpm check                              # portalkit doctor: RPC, chainId, eth_*, deployer balance
```

## Portaldot V3 testnet

```bash
pnpm check --network portaldot-v3 --address <deployer 0x…>   # RPC, chainId, balance
set -a && . ./.env && set +a && pnpm deploy:portaldot        # Foundry
```

- Gas is paid from the Substrate account your `0x` address maps to. Testnet tPOT goes to native `5…` addresses:
  move it with **Fund this EVM account** on the PortalKit dashboard's Address page.
- A deploy costs far more than on Ethereum: pallet-revive charges a refundable storage deposit
  (≈ 13 tPOT + 0.08 tPOT per byte of runtime code; this Counter ≈ 63 tPOT).
- `--skip-simulation` is required: Forge's local gas simulation doesn't model revive's deposit, so the node rejects
  the transaction (`1010: Invalid Transaction`); skipping it makes Forge ask the RPC (`eth_estimateGas`).
- Hardhat: `--network portaldot-v3` is configured but not yet verified against V3.
