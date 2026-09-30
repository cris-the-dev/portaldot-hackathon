# PortalKit

Toolkit for EVM (Solidity) developers to build and ship dApps on **Portaldot V3** in minutes —
plus **PortalVault**, a tokenized-RWA showcase built with the kit.

> Portaldot Hacker House 2026 · work in progress. Portaldot V3 (EVM) is not public yet,
> so everything runs **Anvil-first**; V3 values are `TODO` in [`config/networks.json`](config/networks.json).
> Open questions: [`docs/v3-findings.md`](docs/v3-findings.md).

## What's inside

| Part | Status |
|---|---|
| `@portalkit/chains` — viem/wagmi chains from `config/networks.json` (TODO-aware) | ✅ |
| `@portalkit/address` — SS58 helpers + pluggable H160↔SS58 strategies | ✅ helpers · ⏳ V3 mapping |
| `portalkit doctor` — RPC, chainId, `eth_*` API, deployer balance | ✅ on Anvil · ⏳ V3 |
| `create-portalkit-app` — Foundry **or** Hardhat 3 + Next.js/wagmi | ✅ (local `--portalkit` mode until npm publish) |
| Dashboard — wallet + add network, deploy wizard, ABI playground, address converter, faucet | ✅ on Anvil |
| PortalVault — MockRWA + ERC-4626 RWAVault, deposit/withdraw/yield/history | ✅ on Anvil |

```
packages/chains     @portalkit/chains
packages/address    @portalkit/address
packages/cli        portalkit doctor + create-portalkit-app
packages/templates  Foundry / Hardhat / Next.js templates
apps/dashboard      Dashboard (Next.js)
apps/vault          PortalVault frontend (Next.js)
contracts/          Foundry: MockRWA, RWAVault (ERC-4626)
config/             networks.json (single source of truth) + deployments/<chainId>.json
docs/               quickstart, v3-findings
```

## Quickstart

Full walkthrough: [`docs/quickstart.md`](docs/quickstart.md).

Requirements: Node ≥ 22 (24 recommended), pnpm, [Foundry](https://book.getfoundry.sh/getting-started/installation).

```bash
git clone <repo> && git -C portalkit submodule update --init && cd portalkit
pnpm install
pnpm build && pnpm test          # packages (turbo)
cd contracts && forge test       # contracts

# Deploy to a local Anvil
anvil &
cp .env.example .env             # PRIVATE_KEY defaults to Anvil account #0
cd contracts && set -a && . ../.env && set +a && forge script script/Deploy.s.sol --rpc-url anvil --broadcast
```
