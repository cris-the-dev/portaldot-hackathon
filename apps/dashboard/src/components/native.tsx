"use client";

import type { SubstrateNetworkConfig } from "@portalkit/chains";
import { formatUnits } from "viem";
import { errorMessage } from "@/lib/hooks";
import { substrateNetworks, useNativeAccount, useNativeChainInfo } from "@/lib/native";
import { Badge, Card, Mono } from "./ui";

const decimalsOf = (net: SubstrateNetworkConfig) => (typeof net.nativeDecimals === "number" ? net.nativeDecimals : undefined);

/** Live status of Portaldot's native networks: runtime, properties, and whether EVM/WASM are exposed. */
export function NativeStatusCard() {
  return (
    <Card title="Portaldot native networks · V3 readiness">
      <p className="mb-3 text-sm text-muted">
        Read live over Substrate RPC. When V3 enables the EVM, <b>EVM</b> flips to available here and in{" "}
        <Mono>portalkit doctor</Mono>.
      </p>
      <div className="flex flex-col gap-2">
        {substrateNetworks.map((net) => (
          <NativeStatusRow key={net.key} net={net} />
        ))}
      </div>
    </Card>
  );
}

function NativeStatusRow({ net }: { net: SubstrateNetworkConfig & { key: string } }) {
  const info = useNativeChainInfo(net);
  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{net.name}</span>
        <Mono className="text-muted">{net.wsUrl}</Mono>
      </div>
      {info.isLoading && <p className="mt-1 text-xs text-muted">Connecting…</p>}
      {info.isError && <p className="mt-1 text-xs text-muted">Offline — {errorMessage(info.error)}</p>}
      {info.data && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <Badge tone="muted">
            {info.data.specName} {info.data.specVersion}
          </Badge>
          <Badge tone="muted">block #{info.data.bestBlock.toLocaleString()}</Badge>
          <Badge tone="muted">
            ss58 {info.data.properties.ss58Format} · {info.data.properties.tokenDecimals} dec · {info.data.properties.tokenSymbol}
          </Badge>
          <Badge tone={info.data.evm ? "ok" : "warn"}>EVM {info.data.evm ? "available" : "not yet"}</Badge>
          <Badge tone={info.data.wasmContracts ? "ok" : "muted"}>WASM contracts {info.data.wasmContracts ? "available" : "no"}</Badge>
        </div>
      )}
    </div>
  );
}

/** Native POT balance of an SS58 account on every configured native network. */
export function NativeAccountCard({ ss58 }: { ss58: string }) {
  return (
    <Card title="Native POT account (Substrate side)" className="lg:col-span-2">
      <div className="flex flex-col gap-2">
        {substrateNetworks.map((net) => (
          <NativeAccountRow key={net.key} net={net} ss58={ss58} />
        ))}
      </div>
    </Card>
  );
}

function NativeAccountRow({ net, ss58 }: { net: SubstrateNetworkConfig & { key: string }; ss58: string }) {
  const account = useNativeAccount(net, ss58);
  const decimals = decimalsOf(net);
  const fmt = (v: bigint) => (decimals === undefined ? v.toString() : formatUnits(v, decimals));
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border p-3 text-sm">
      <span className="font-medium">{net.name}</span>
      {account.isLoading && <span className="text-xs text-muted">Loading…</span>}
      {account.isError && <span className="text-xs text-muted">Offline — {errorMessage(account.error)}</span>}
      {account.data && (
        <span className="text-right">
          <b className="tabular-nums">
            {fmt(account.data.free)} {net.nativeSymbol}
          </b>
          <span className="ml-2 text-xs text-muted">
            reserved {fmt(account.data.reserved)} · nonce {account.data.nonce}
            {account.data.providers === 0 && " · account not created yet"}
          </span>
        </span>
      )}
    </div>
  );
}
