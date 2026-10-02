# @portalkit/address

SS58 helpers + pluggable **EVM (H160) ↔ Substrate (SS58)** mapping strategies for Portaldot.

```ts
import { encodeSs58, decodeSs58, reencodeSs58, ss58PrefixFor, evmToSubstrate } from "@portalkit/address";

const prefix = ss58PrefixFor("portaldot-v2");       // read from config/networks.json
reencodeSs58("5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", prefix);
```

## Mapping strategies

Portaldot V3's account mapping is **not public yet**, so the only registered strategy is
`pending-v3`, which throws `MappingNotAvailableError` rather than guessing.

TODO(v3): once V3 is released, implement the real `AddressMappingStrategy`, register it in
`strategies`, and add official test vectors (see `docs/v3-findings.md`, item 4).

```ts
import { strategies, type AddressMappingStrategy } from "@portalkit/address";
strategies.register(myV3Strategy);
evmToSubstrate("0x…", { strategy: myV3Strategy.id, ss58Prefix });
```

## Native (Substrate) helpers

Raw-RPC helpers for Portaldot's native side (current `@polkadot/api` cannot fully decode the V2 runtime):

```ts
import { connectSubstrate, getNativeChainInfo, getNativeAccount } from "@portalkit/address";

const rpc = await connectSubstrate("wss://mainnet.portaldot.io");
await getNativeChainInfo(rpc);     // chain, runtime, properties, { evm, wasmContracts }
await getNativeAccount(rpc, ss58); // { nonce, free, reserved, … } — AccountInfo layout verified on spec 1002
rpc.close();
```

## SS58 prefix note

`ss58-registry.json` in `portaldotVolunteer/Portaldot` is an unmodified upstream Substrate copy and has **no Portaldot entry**.
The V2 runtime sets `SS58Prefix = 42`, verified on mainnet via `system_properties` (2026-10-02).
