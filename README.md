# PortalKit

**Ship Solidity dApps on Portaldot V3 in minutes — and bridge its two worlds (EVM ↔ Substrate) from day one.**
Plus **PortalVault**, a compliance-aware tokenized-RWA vault built entirely with the kit.

> Portaldot Hacker House 2026 · Track: *Ecosystem DApps* or *Modular Cloud & Middleware* (to be confirmed against the official rules).
> Portaldot V3 (EVM) is not public yet (checked 2026-10-02), so the EVM side runs **Anvil-first** with every V3 value as an explicit
> `TODO` in [`config/networks.json`](config/networks.json). The **native side already runs against live Portaldot mainnet**.

---

## The problem

Portaldot V3 adds an EVM next to its Substrate runtime. That should bring in the largest developer pool in crypto — Solidity
developers — but today they hit a wall:

1. **No path in.** Which RPC? Which chainId? Where do I get POT for gas? These were the top complaints from the previous
   Portaldot hacker house. Every team rebuilds the same scaffolding (contracts + wallet + chain config) from scratch.
2. **Two account worlds.** Portaldot users have SS58 accounts (`5Grw…`) with 14-decimal POT on the native side; EVM tools
   speak H160 (`0xf39F…`). Nothing shows a developer both sides at once.
3. **Old, quirky native runtime.** The live chain runs a Substrate 3.0-era runtime (`portaldot` spec 1002) that current
   `@polkadot/api` cannot fully decode — so even "what is this account's POT balance" needs custom work.
4. **Opaque failures.** A wrong chainId, a node without standard `eth_*` methods, or an unfunded deployer show up as cryptic
   transaction errors instead of a clear diagnosis.

## The solution

| | What it is | Why it matters for Portaldot |
|---|---|---|
| **`create-portalkit-app`** | One command scaffolds a working dApp: **Foundry or Hardhat 3** contracts + Next.js/wagmi web app, wired to the project's own `networks.json`; deploy with `pnpm deploy:anvil` | From zero to a dApp you can click in minutes; both presets verified end-to-end |
| **`portalkit doctor`** | Pre-flight checks for a network. **EVM:** RPC alive, chainId matches config, the 9 `eth_*` methods tools rely on, deployer funded. **Native:** node reachable, SS58 prefix / POT decimals / symbol match config, runtime, **whether the node exposes EVM and WASM contracts**, SS58 account balance | Turns cryptic failures into a red line with a reason; **tells you the moment V3's EVM goes live** |
| **`@portalkit/chains`** | viem/wagmi chain definitions generated from one config file; `TODO`-aware (pending networks are reported, never half-built) | Config-driven: filling in V3's values is the only change needed |
| **`@portalkit/address`** | SS58 helpers, **pluggable H160 ↔ SS58 mapping strategies**, and raw-RPC helpers for Portaldot's native side (account decoder verified on mainnet) | The dual-VM foundation; V3's real mapping plugs in without touching callers |
| **Dashboard** | Connect wallet + one-click *add network* · **deploy wizard** (Foundry/Hardhat artifact → auto-generated constructor form) · **ABI playground** (read/write any contract, decoded events) · **address converter** with the **live native POT balance** of any SS58 account · faucet panel · **V3 readiness** monitor | Everything a Solidity dev needs in a browser — no scripts |
| **PortalVault** | `MockRWA` (tokenized gold) + `RWAVault` (ERC-4626): deposit, issuer-distributed yield, withdraw, history · **simulated KYC** (only verified investors hold shares; withdrawals never blocked) | Proves the kit end-to-end and hits Portaldot's tokenized-RWA narrative, compliance included |

### Live on Portaldot today (no V3 needed)

```text
$ portalkit doctor -n portaldot-mainnet --address 5GHBWSmwFuzown3aG1edDEGN6tD1qqCmxmMRmWiQ1YnFbBKk
✔ Network config                 Portaldot Mainnet (native) (substrate) → wss://mainnet.portaldot.io
✔ Node reachable                 Portaldot Mainnet · node 2.0.0 · block #2708129
✔ Chain properties match config  ss58 42 · 14 decimals · POT
✔ Runtime                        portaldot spec 1002
✔ Execution environments         EVM (eth_*): not available · WASM contracts: available
✔ Account balance                42158.157… POT free · nonce 18
```

## Screenshots

| Dashboard — V3 readiness (live mainnet) | Dashboard — native POT account + dual-VM converter |
|---|---|
| ![Dashboard home](docs/images/dashboard-home.png) | ![Address converter](docs/images/dashboard-address.png) |
| **Dashboard — ABI playground (decoded events)** | **Dashboard — deploy wizard** |
| ![ABI playground](docs/images/dashboard-playground.png) | ![Deploy wizard](docs/images/dashboard-deploy.png) |
| **PortalVault — yield raised the share price to 1.1** | **PortalVault — unverified investor (KYC)** |
| ![PortalVault](docs/images/vault.png) | ![KYC gating](docs/images/vault-kyc.png) |

## Quickstart

Requirements: Node ≥ 22 (24 recommended), pnpm, [Foundry](https://book.getfoundry.sh/getting-started/installation).

```bash
git clone git@github.com:cris-the-dev/portaldot-hackathon.git portalkit
cd portalkit && git submodule update --init
pnpm install && pnpm build

anvil                                                   # terminal 1
cd contracts && PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  forge script script/Deploy.s.sol --rpc-url anvil --broadcast   # Anvil dev key #0 — local only
cd .. && pnpm -F @portalkit/dashboard dev               # http://localhost:3000
pnpm -F @portalkit/vault-app dev                        # http://localhost:3001

node packages/cli/dist/portalkit.js doctor -n portaldot-mainnet   # native checks against live mainnet
```

Full walkthrough (scaffolding a new app, dashboard tour, vault demo, V3 day checklist): [`docs/quickstart.md`](docs/quickstart.md).

## Architecture

```mermaid
flowchart LR
  cfg["config/networks.json<br/>(single source of truth)"] --> chains["@portalkit/chains<br/>viem/wagmi chains, TODO-aware"]
  chains --> cli["@portalkit/cli<br/>doctor · create-portalkit-app"]
  chains --> dash["Dashboard"]
  chains --> vault["PortalVault"]
  addr["@portalkit/address<br/>SS58 · H160↔SS58 strategies · native RPC"] --> cli
  addr --> dash
  tpl["@portalkit/templates<br/>Foundry · Hardhat 3 · Next.js"] --> cli
  contracts["contracts/<br/>MockRWA · RWAVault"] -->|"Deploy.s.sol writes"| dep["config/deployments/&lt;chainId&gt;.json"]
  dep --> vault
  dash -->|"eth_* (EVM)"| evm[("Anvil today<br/>Portaldot V3 EVM")]
  vault --> evm
  cli --> evm
  dash -->|"Substrate RPC"| native[("Portaldot native<br/>mainnet · local node")]
  cli --> native
```

Design rules: **config-driven** (no hardcoded chainId/RPC/addresses), **TODO-aware** (unknown V3 values are explicit and reported,
never guessed), **Anvil-first**, **strategy pattern** for anything V3 hasn't specified yet (H160 ↔ SS58 mapping).
Details: [`docs/architecture.md`](docs/architecture.md).

## Repository

```
packages/chains     @portalkit/chains      viem/wagmi chains from config
packages/address    @portalkit/address     SS58, mapping strategies, native RPC helpers
packages/cli        @portalkit/cli         portalkit doctor + create-portalkit-app
packages/templates  @portalkit/templates   Foundry / Hardhat 3 / Next.js templates
apps/dashboard      Dashboard (Next.js 16, wagmi 3)
apps/vault          PortalVault frontend (Next.js 16, wagmi 3)
contracts/          Foundry: MockRWA, RWAVault (ERC-4626 + KYC), deploy script
config/             networks.json + deployments/<chainId>.json
docs/               quickstart, architecture, v3-findings, video script, evidence
```

**Quality:** 60 Foundry tests (incl. fuzzing and an inflation-attack scenario) · 88 Vitest tests + 1 opt-in live mainnet test ·
browser E2E smoke tests for the dashboard and vault · CI on every push (lint, typecheck, tests, `forge fmt`/`build`/`test`).

## Status & roadmap

| | Status |
|---|---|
| Kit, dashboard, vault on Anvil | ✅ done, E2E-tested |
| Native side on Portaldot mainnet (doctor, native account view, V3 readiness) | ✅ live |
| V3 EVM values in `networks.json` | ⏳ V3 not public ([findings](docs/v3-findings.md)) |
| Real H160 ↔ SS58 strategy | ⏳ waits for V3's account mapping |
| Contracts deployed on Portaldot V3 testnet + tx evidence | ⏳ [`docs/evidence.md`](docs/evidence.md) |
| `npx create-portalkit-app` | ⏳ packages ready; npm publish pending (works today via `--portalkit <path>`) |

**On V3 day:** fill `portaldot-v3` in `config/networks.json` → `portalkit doctor -n portaldot-v3` → implement the mapping
strategy → deploy → record evidence. If V3 ships an EVM ↔ native/WASM precompile, the dashboard grows a true **dual-VM view**
(one account, both balances, calls across VMs).

**After the hackathon:** publish the npm packages, contract verification + explorer links once Portaldot has an EVM explorer,
ink!/WASM templates next to Solidity ones, and a hosted dashboard for the community.

## Team

_TBD — names and roles._

## License

_TBD_ — the packages currently declare MIT in `package.json`; add a `LICENSE` file once decided.
