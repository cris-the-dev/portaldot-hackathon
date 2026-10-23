"use client";

import {
  MappingNotAvailableError,
  REVIVE_STRATEGY_ID,
  decodeSs58,
  detectAddressKind,
  encodeSs58,
  evmToSubstrate,
  strategies,
  substrateToEvm,
} from "@portalkit/address";
import { TODO, getNetwork } from "@portalkit/chains";
import { useMemo, useState } from "react";
import { getAddress } from "viem";
import { FundEvmCard } from "@/components/fund";
import { NativeAccountCard } from "@/components/native";
import { Badge, Card, Input, Label, Mono, Notice } from "@/components/ui";
import { networkStatuses } from "@/lib/wagmi";

/** Networks with a known SS58 prefix, straight from config/networks.json. */
const PREFIXED = networkStatuses.flatMap((n) => {
  const prefix = getNetwork(n.key, { env: {} }).ss58Prefix;
  return typeof prefix === "number" ? [{ key: n.key, name: n.name, prefix }] : [];
});
const PENDING_PREFIX = networkStatuses.filter((n) => getNetwork(n.key, { env: {} }).ss58Prefix === TODO);

export default function AddressPage() {
  const [input, setInput] = useState("");
  const [customPrefix, setCustomPrefix] = useState("");
  const [strategyId, setStrategyId] = useState(strategies.ids()[0] ?? "");
  const value = input.trim();
  const kind = value ? detectAddressKind(value) : null;

  const decoded = useMemo(() => (kind === "ss58" ? decodeSs58(value) : null), [kind, value]);
  const custom = Number(customPrefix);
  const customValid = customPrefix !== "" && Number.isInteger(custom) && custom >= 0 && custom <= 16383;

  const mapping = useMemo((): { ok?: string; pending?: string; err?: string } | null => {
    if (!kind || kind === "unknown") return null;
    const prefix = PREFIXED[0]?.prefix;
    try {
      if (kind === "evm") {
        if (prefix === undefined) return { err: "No network with a known ss58Prefix in config." };
        return { ok: evmToSubstrate(value, { strategy: strategyId, ss58Prefix: prefix }) };
      }
      return { ok: substrateToEvm(value, { strategy: strategyId }) };
    } catch (err) {
      if (err instanceof MappingNotAvailableError) return { pending: err.message };
      return { err: (err as Error).message };
    }
  }, [kind, value, strategyId]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Address" className="lg:col-span-2">
        <label className="block">
          <Label>EVM (0x…) or Substrate (SS58) address</Label>
          <Input value={input} spellCheck={false} placeholder="0x… or 5…" onChange={(e) => setInput(e.target.value)} />
        </label>
        {kind && (
          <div className="mt-2">
            {kind === "evm" && <Badge tone="ok">EVM · H160</Badge>}
            {kind === "ss58" && <Badge tone="ok">Substrate · SS58 (prefix {decoded?.prefix})</Badge>}
            {kind === "unknown" && <Badge tone="err">Not a valid EVM or SS58 address</Badge>}
          </div>
        )}
      </Card>

      {kind === "ss58" && <NativeAccountCard ss58={value} />}

      <Card title="Same-VM formats">
        {kind === "evm" && (
          <dl className="text-sm">
            <dt className="text-xs text-muted">Checksummed (EIP-55)</dt>
            <dd>
              <Mono>{getAddress(value)}</Mono>
            </dd>
          </dl>
        )}
        {kind === "ss58" && decoded && (
          <dl className="flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted">AccountId32 (public key)</dt>
              <dd>
                <Mono>{decoded.accountId}</Mono>
              </dd>
            </div>
            {PREFIXED.map((n) => (
              <div key={n.key}>
                <dt className="text-xs text-muted">
                  {n.name} · prefix {n.prefix}
                </dt>
                <dd>
                  <Mono>{encodeSs58(decoded.accountId, n.prefix)}</Mono>
                </dd>
              </div>
            ))}
            <div>
              <dt className="text-xs text-muted">Custom prefix</dt>
              <dd className="flex flex-col gap-1">
                <Input
                  className="w-28"
                  value={customPrefix}
                  placeholder="0–16383"
                  onChange={(e) => setCustomPrefix(e.target.value)}
                  aria-label="Custom SS58 prefix"
                />
                {customValid && <Mono>{encodeSs58(decoded.accountId, custom)}</Mono>}
              </dd>
            </div>
          </dl>
        )}
        {(!kind || kind === "unknown") && <p className="text-sm text-muted">Enter an address above.</p>}
        {PENDING_PREFIX.length > 0 && (
          <p className="mt-3 text-xs text-muted">
            SS58 prefix still TODO for: {PENDING_PREFIX.map((n) => n.name).join(", ")}.
          </p>
        )}
      </Card>

      <Card title="Dual-VM mapping (EVM ↔ Substrate)">
        <label className="mb-3 block">
          <Label>Mapping strategy</Label>
          <select
            className="w-full rounded-md border border-border bg-panel-2 px-2 py-1.5 text-sm"
            value={strategyId}
            onChange={(e) => setStrategyId(e.target.value)}
          >
            {strategies.list().map((s) => (
              <option key={s.id} value={s.id}>
                {s.id} — {s.description}
              </option>
            ))}
          </select>
        </label>
        {mapping?.ok && (
          <dl className="text-sm">
            <dt className="text-xs text-muted">{kind === "evm" ? "Substrate account" : "EVM account"}</dt>
            <dd>
              <Mono>{mapping.ok}</Mono>
            </dd>
          </dl>
        )}
        {mapping?.ok && kind === "evm" && strategyId === REVIVE_STRATEGY_ID && (
          <Notice>
            On Portaldot V3, gas for this EVM account is paid from the Substrate account above: send native tokens
            there (below, with the Portaldot Extension) and they show up in MetaMask.
          </Notice>
        )}
        {mapping?.pending && <Notice tone="warn">{mapping.pending}</Notice>}
        {mapping?.err && <Notice tone="err">{mapping.err}</Notice>}
        {!mapping && <p className="text-sm text-muted">Enter an address to map it across VMs.</p>}
      </Card>

      {mapping?.ok && kind === "evm" && strategyId === REVIVE_STRATEGY_ID && (
        <>
          <NativeAccountCard ss58={mapping.ok} />
          <FundEvmCard ss58={mapping.ok} />
        </>
      )}
    </div>
  );
}
