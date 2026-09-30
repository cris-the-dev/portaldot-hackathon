# @portalkit/chains

viem/wagmi chain definitions for Portaldot, generated from [`config/networks.json`](../../config/networks.json) — the single source of truth. Nothing is hardcoded.

```ts
import { getEvmChain, getEvmChains, listNetworks } from "@portalkit/chains";

const anvil = getEvmChain("anvil");      // viem Chain
const ready = getEvmChains();             // every EVM network that is fully configured
listNetworks();                           // [{ key, vm, status: "ready" | "pending", pending: [...] }]
```

- Any value may be `"TODO"`. An EVM network with `chainId`, `rpcUrl` or `nativeDecimals` still TODO is **pending**: `getEvmChain` throws `NetworkNotConfiguredError` listing the missing fields. Optional TODOs (`wsUrl`, `explorer`, `ss58Prefix`) are just omitted.
- Env overrides: `PORTALKIT_RPC_URL_<KEY>` / `PORTALKIT_WS_URL_<KEY>` (key upper-cased, `-` → `_`), e.g. `PORTALKIT_RPC_URL_PORTALDOT_V3`.
- Node only: `import { loadNetworksFromFile } from "@portalkit/chains/node"`.
