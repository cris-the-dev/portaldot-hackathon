# PortalVault

Tokenized-RWA showcase built with PortalKit: deposit `MockRWA` (e.g. tokenized gold) into the
`RWAVault` ERC-4626 vault, earn issuer-distributed yield, withdraw.

- **Chains** from `config/networks.json` via `@portalkit/chains`.
- **Addresses** from `config/deployments/<chainId>.json`, written by `contracts/script/Deploy.s.sol --broadcast`.
- **ABIs + deployments** are generated into `src/generated/` by `pnpm sync` (runs automatically before `dev`/`build`;
  ABIs refresh only when `contracts/out` exists).

Features: TVL, share price, your position and balance · deposit (auto-approve) / withdraw (withdrawing your whole
position redeems all shares, so no dust is left) · history of your deposits/withdrawals and all yield
distributions from event logs · issuer tools (mint, distribute yield), shown only to role holders.

```bash
anvil
cd contracts && PRIVATE_KEY=<anvil key #0> forge script script/Deploy.s.sol --rpc-url anvil --broadcast
pnpm -F @portalkit/vault-app dev          # http://localhost:3001 — connect with anvil account #0 (issuer)
```

`pnpm -F @portalkit/vault-app e2e`: browser smoke test (mint → deposit → yield → +10% share price → withdraw → history),
needs Chrome, a fresh Anvil with the contracts deployed, and `pnpm build && pnpm start`.
