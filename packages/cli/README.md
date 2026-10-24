# @portalkit/cli

## `portalkit doctor`

Checks a network from `config/networks.json` before you deploy:

| Check | Fails when |
|---|---|
| Network config | required values are still `TODO` (e.g. Portaldot V3 today) |
| RPC reachable | `eth_blockNumber` fails |
| chainId matches config | `eth_chainId` ≠ configured chainId |
| Standard Ethereum JSON-RPC | any of `eth_chainId/gasPrice/getBalance/getTransactionCount/getBlockByNumber/call/estimateGas/getCode` fails |
| EIP-1559 & client info | warning only (`eth_feeHistory`, `eth_maxPriorityFeePerGas`, `net_version`, `web3_clientVersion`) |
| Deployer balance | balance of `--address` or `$PRIVATE_KEY` < `--min-balance` (default 0.1); skipped if neither is set |

```bash
portalkit doctor                         # anvil
portalkit doctor -n portaldot-v3 --json  # once V3 values are filled in
portalkit doctor -c ./my-networks.json -n my-chain -a 0x…
```

### Native (Substrate) networks

For `vm: "substrate"` entries (e.g. `portaldot-mainnet`, `portaldot-v2`) doctor checks Portaldot's native side instead:

| Check | Fails when |
|---|---|
| Node reachable | WebSocket RPC down |
| Chain properties match config | node's `ss58Format` / `tokenDecimals` / `tokenSymbol` differ from config (TODO fields → warning showing the node's values) |
| Runtime | (shows `specName` / `specVersion`) |
| Execution environments | Shows whether the node exposes EVM (`eth_*`) and WASM contracts (`contracts_*`): tells you when V3's EVM is live |
| Account balance | `--address <SS58>` free POT < `--min-balance` |

```bash
portalkit doctor -n portaldot-mainnet --address 5GHBWSmwFuzown3aG1edDEGN6tD1qqCmxmMRmWiQ1YnFbBKk
# ✔ Chain properties match config  ss58 42 · 14 decimals · POT
# ✔ Execution environments         EVM (eth_*): not available · WASM contracts: available
# ✔ Account balance                42158.157… POT free · nonce 18
```

Exit code is `1` if any check fails. RPC URLs can be overridden with `PORTALKIT_RPC_URL_<KEY>`.

## `create-portalkit-app`

```bash
create-portalkit-app my-app                       # prompts for name / toolchain when omitted
create-portalkit-app my-app --contracts hardhat   # Hardhat 3 + viem instead of Foundry
```

Generates a pnpm project:

```
my-app/
  contracts/      Foundry (Counter, forge tests, forge script)  or
                  Hardhat 3 (Counter, node:test + viem tests, viem deploy script; networks from networks.json)
  web/            Next.js + wagmi + viem; chains from ../networks.json via @portalkit/chains
  networks.json   snapshot of PortalKit's network config (the project's own source of truth)
  deployments/    <chainId>.json written by the deploy script, read by the web app
```

Scripts: `pnpm contracts:test`, `pnpm deploy:anvil`, `pnpm dev`, `pnpm check` (= `portalkit doctor`;
not named `doctor` because `pnpm doctor` is a pnpm built-in).

Both presets deploy with one command (`pnpm deploy:anvil`) and write the same `deployments/<chainId>.json`.

Options: `--contracts foundry|hardhat`, `--no-git` (skip `git init` + `forge install`), `--no-install` (skip `pnpm install`),
`--portalkit <path>` (development: `pnpm pack` the local PortalKit packages into `.portalkit/` and
point dependencies/overrides at them; works before anything is published to npm).

> The `@portalkit/*` packages are **not published to npm yet**, so for now use `--portalkit <path-to-this-repo>`
> (after `pnpm build`).
