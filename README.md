# PortalKit

Toolkit for EVM (Solidity) developers to build and ship dApps on **Portaldot V3** in minutes —
plus **PortalVault**, a tokenized-RWA showcase built with the kit.

> Portaldot Hacker House 2026 · work in progress (milestone M0). Portaldot V3 (EVM) is not public yet,
> so everything runs **Anvil-first**; V3 values are `TODO` in [`config/networks.json`](config/networks.json).
> Open questions: [`docs/v3-findings.md`](docs/v3-findings.md).

## Layout

```
packages/chains     @portalkit/chains   — viem chains from config/networks.json
packages/address    @portalkit/address  — SS58 helpers + H160↔SS58 strategy skeleton
packages/cli        create-portalkit-app + portalkit doctor   (placeholder)
packages/templates  scaffold templates                        (placeholder)
apps/dashboard      deploy wizard, ABI playground, converter  (placeholder)
apps/vault          PortalVault frontend                      (placeholder)
contracts/          Foundry: MockRWA, RWAVault (ERC-4626)
config/networks.json  single source of truth for chain config
```

## Quickstart

Requirements: Node ≥ 20, pnpm, [Foundry](https://book.getfoundry.sh/getting-started/installation).

```bash
git clone --recurse-submodules <repo> && cd portalkit
pnpm install
pnpm build && pnpm test          # packages (turbo)
cd contracts && forge test       # contracts

# Deploy to a local Anvil
anvil &
cp .env.example .env             # PRIVATE_KEY defaults to Anvil account #0
cd contracts && set -a && . ../.env && set +a && forge script script/Deploy.s.sol --rpc-url anvil --broadcast
```
