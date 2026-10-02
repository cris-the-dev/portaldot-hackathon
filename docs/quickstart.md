# PortalKit quickstart

Everything below runs on a local **Anvil** node today. Portaldot V3 (EVM) is not public yet; its
values are `TODO` in `config/networks.json` and the tools report it as *pending* until they are filled in
(see [`v3-findings.md`](v3-findings.md)).

## 0. Requirements

Node ≥ 22 (24 recommended), pnpm, [Foundry](https://book.getfoundry.sh/getting-started/installation) (for `anvil`, and `forge` if you pick the Foundry preset), Git.

```bash
git clone git@github.com:cris-the-dev/portaldot-hackathon.git portalkit
cd portalkit && git submodule update --init
pnpm install && pnpm build
```

## 1. Start a new dApp — `create-portalkit-app`

```bash
cd ..
node portalkit/packages/cli/dist/create-portalkit-app.js my-dapp --portalkit ./portalkit
#   --contracts foundry | hardhat   (prompted if omitted)
cd my-dapp
```

> `--portalkit <path>` packs the local PortalKit packages because they are not on npm yet.
> Once published this becomes `npx create-portalkit-app my-dapp`.

```bash
anvil                                              # terminal 1
cp .env.example .env                               # Anvil dev key #0 — local only
pnpm contracts:test
set -a && . ./.env && set +a && pnpm deploy:anvil  # writes deployments/31337.json
pnpm check                                         # portalkit doctor
pnpm dev                                           # http://localhost:3000 → connect, Increment
```

## 2. Check a network — `portalkit doctor`

```bash
portalkit doctor                        # anvil: RPC, chainId, eth_* API, deployer balance
portalkit doctor --network portaldot-v3 # fails with the list of TODO values until V3 is configured
portalkit doctor --network portaldot-mainnet --address <SS58>
                                        # native side, live: ss58/decimals/symbol vs config, runtime,
                                        # EVM/WASM availability, POT balance
```

## 3. Deploy and call any contract — Dashboard

```bash
pnpm -F @portalkit/dashboard dev        # http://localhost:3000
```

1. **Get started**: connect wallet → *Add network to wallet* → *Fund my wallet* (Anvil).
2. **Deploy**: upload `contracts/out/MockRWA.sol/MockRWA.json` → fill `name_`, `symbol_`, `admin` → Deploy.
3. **Playground** (linked from the deploy result): query `name()`, send `mint(...)`, see the decoded `Transfer`
   event, *Load events*.
4. **Address**: paste an SS58 or 0x address → re-encodings per configured prefix and, for SS58, the **live
   native POT balance** on Portaldot mainnet; the H160↔SS58 mapping reports *pending-v3*.
5. The home page's **V3 readiness** card reads mainnet live and shows whether EVM is available yet.

## 4. Showcase — PortalVault (tokenized RWA, ERC-4626)

```bash
anvil
cd contracts && PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  forge script script/Deploy.s.sol --rpc-url anvil --broadcast      # writes config/deployments/31337.json
pnpm -F @portalkit/vault-app dev        # http://localhost:3001, connect as Anvil account #0 (issuer)
```

Mint tGOLD (issuer tools) → deposit → *Distribute* yield → share price rises → withdraw → history.

KYC is on by default (only the issuer is verified). To try another wallet, verify its address in the **Compliance** panel
first — unverified wallets see deposits disabled (withdrawals are never blocked). Deploy with `KYC_REQUIRED=false` for an open vault.

## 5. When Portaldot V3 is released

1. Fill every `TODO` of `portaldot-v3` in `config/networks.json` (chainId, rpcUrl, decimals, explorer, faucet, ss58Prefix).
2. `portalkit doctor --network portaldot-v3` must pass.
3. Implement the real H160↔SS58 strategy in `@portalkit/address` (see its README).
4. Deploy: `forge script script/Deploy.s.sol --rpc-url portaldot_v3 --broadcast` (set `PORTALDOT_V3_RPC_URL`),
   record the tx hashes in `docs/evidence.md`.
