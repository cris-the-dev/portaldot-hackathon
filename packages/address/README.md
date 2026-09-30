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

## SS58 prefix note

`ss58-registry.json` in `portaldotVolunteer/Portaldot` is an unmodified upstream Substrate copy and has **no Portaldot entry**.
The V2 runtime source sets `SS58Prefix = 42`, which is what `config/networks.json` records for `portaldot-v2` (not yet verified on a live node).
