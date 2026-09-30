# PortalKit Dashboard

Next.js app for EVM developers on Portaldot. Chains come from `config/networks.json` via
`@portalkit/chains`; networks still marked `TODO` (Portaldot V3 today) are listed as *pending*.

| Page | What it does |
|---|---|
| **Get started** `/` | Connect an injected wallet, add the network (`wallet_addEthereumChain`), test funds: official faucet if configured; on a local Anvil node, dev accounts + "fund my wallet" (`anvil_setBalance`). Network status table. |
| **Deploy** `/deploy` | Upload a Foundry/Hardhat artifact or paste ABI + bytecode → constructor form generated from the ABI → deploy → tx hash, contract address, link to the playground. |
| **Playground** `/playground` | Address + ABI → forms for every read/write function, results, decoded receipt events, and decoded historical logs. |
| **Address** `/address` | EVM checksum; SS58 decode/re-encode for every configured prefix; dual-VM mapping via `@portalkit/address` strategies (`pending-v3` until V3 publishes its mapping). |

```bash
pnpm -F @portalkit/dashboard dev        # http://localhost:3000
anvil                                   # in another terminal
```

Argument syntax: scalars as plain text (`123`, `0x…`, `true`), arrays/tuples as JSON
(`["0x…","0x…"]`, `{"to":"0x…","amount":"1"}`).

## Tests

- `pnpm -F @portalkit/dashboard test`: unit tests for ABI argument parsing and artifact loading.
- `pnpm -F @portalkit/dashboard e2e`: browser smoke test (connect → add network → fund → deploy MockRWA →
  read/write → events → address converter → mobile layout). Needs Chrome, `anvil`, `pnpm build && pnpm start`,
  and `forge build` in `contracts/`. Uses an injected test wallet that forwards to Anvil.
