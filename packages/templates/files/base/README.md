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

Portaldot V3 values in `networks.json` are `TODO` until V3 is public; fill them in and run
`pnpm check --network portaldot-v3`, then deploy to it (Foundry: `--rpc-url portaldot_v3`, Hardhat: `--network portaldot-v3`).
