## The problem
Portaldot V3 adds an EVM (pallet-revive) next to its Substrate runtime, but Solidity developers arriving there hit the
same wall as last season: which RPC and chainId, where test POT comes from, why their `0x` wallet has no balance when
tokens go to a `5…` address, and how to deploy without learning Rust.

## How it works
PortalKit wraps Portaldot V3 in the tools EVM developers already use. One config file (`config/networks.json`) drives
every tool — CLI, wallet setup, Foundry/Hardhat presets, dashboard — so the kit follows the network instead of
hard-coding it.

## Key features
- **`create-portalkit-app`** — scaffolds a Foundry *or* Hardhat + Next.js (wagmi/viem) dApp, deployable in one command.
- **`portalkit doctor`** — checks RPC, chainId, the `eth_*` API, runtime/VM availability and deployer balance on both
  the EVM and the Substrate side.
- **Dashboard** — add Portaldot to MetaMask, deploy any contract from ABI + bytecode with auto-generated constructor
  forms, call any contract in the ABI playground with decoded events.
- **Dual-VM address converter** — maps an EVM `0x` address to the SS58 account that pays its gas, and shows live
  native balances, and **funds it in one click**: sign a native transfer with the Portaldot Extension and testnet
  tokens sent to a `5…` address land where MetaMask spends them.
- **PortalVault** — showcase built with the kit: a tokenized-gold ERC-20 and a compliance-aware (KYC) ERC-4626 vault
  with issuer-distributed yield.

## Tech stack
Solidity 0.8 · Foundry · OpenZeppelin 5 · TypeScript · Next.js · wagmi/viem · @polkadot/util-crypto · pnpm + Turborepo ·
Vitest. Configured for the Portaldot V3 testnet (chainId 420420777).

## Links
- Live dashboard: https://portalkit.cristhedev.com
- Track: Modular Cloud and Middleware
