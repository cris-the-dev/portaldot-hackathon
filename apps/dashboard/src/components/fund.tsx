"use client";

import type { ApiOptions, Signer } from "@polkadot/api/types";
import type { SubstrateNetworkConfig } from "@portalkit/chains";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { errorMessage } from "@/lib/hooks";
import { substrateNetworks, useNativeAccount } from "@/lib/native";
import { Button, Card, Input, Label, Mono, Notice } from "./ui";

/** Polkadot-js style extensions (incl. the Portaldot Extension) inject themselves here. */
type InjectedAccount = { address: string; name?: string; source: string; signer: Signer };
type InjectedWeb3 = Record<string, { enable(origin: string): Promise<{ accounts: { get(): Promise<{ address: string; name?: string }[]> }; signer: Signer }> }>;

async function connectExtensions(): Promise<InjectedAccount[]> {
  const injected = (window as unknown as { injectedWeb3?: InjectedWeb3 }).injectedWeb3 ?? {};
  if (Object.keys(injected).length === 0) throw new Error("No Substrate wallet extension found. Install the Portaldot Extension (or polkadot.js) and reload.");
  const lists = await Promise.all(
    Object.entries(injected).map(async ([source, provider]) => {
      const ext = await provider.enable("PortalKit");
      return (await ext.accounts.get()).map((a) => ({ ...a, source, signer: ext.signer }));
    }),
  );
  return lists.flat();
}

type Status = { stage: "signing" | "submitted" | "inBlock" | "finalized"; hash?: string } | { stage: "error"; message: string };

/**
 * Sends native tokens from an extension account (5…) to the Substrate account an EVM address maps to,
 * so testnet tokens handed out to native addresses become spendable gas in MetaMask.
 */
export function FundEvmCard({ ss58 }: { ss58: string }) {
  const [netKey, setNetKey] = useState(substrateNetworks[0]?.key ?? "");
  const net = substrateNetworks.find((n) => n.key === netKey);
  return (
    <Card title="Fund this EVM account from a native (5…) wallet" className="lg:col-span-2">
      {substrateNetworks.length > 1 && (
        <label className="mb-3 block">
          <Label>Native network</Label>
          <select
            className="w-full rounded-md border border-border bg-panel-2 px-2 py-1.5 text-sm"
            value={netKey}
            onChange={(e) => setNetKey(e.target.value)}
          >
            {substrateNetworks.map((n) => (
              <option key={n.key} value={n.key}>
                {n.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {net ? <FundForm key={net.key} net={net} dest={ss58} /> : <p className="text-sm text-muted">No native network with a known wsUrl in config.</p>}
    </Card>
  );
}

function FundForm({ net, dest }: { net: SubstrateNetworkConfig & { key: string }; dest: string }) {
  const queryClient = useQueryClient();
  const [accounts, setAccounts] = useState<InjectedAccount[] | null>(null);
  const [connectError, setConnectError] = useState<string>();
  const [from, setFrom] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<Status>();
  const decimals = typeof net.nativeDecimals === "number" ? net.nativeDecimals : undefined;
  const sender = accounts?.find((a) => a.address === from);
  const balance = useNativeAccount(net, sender?.address);

  let planck: bigint | undefined;
  try {
    planck = decimals !== undefined && amount.trim() ? parseUnits(amount.trim(), decimals) : undefined;
  } catch {
    planck = undefined;
  }
  const busy = status !== undefined && status.stage !== "finalized" && status.stage !== "error";

  async function connect() {
    setConnectError(undefined);
    try {
      const list = await connectExtensions();
      setAccounts(list);
      setFrom(list[0]?.address ?? "");
      if (list.length === 0) setConnectError("The extension shared no accounts with this site.");
    } catch (err) {
      setConnectError(errorMessage(err));
    }
  }

  async function send() {
    if (!sender || !planck) return;
    setStatus({ stage: "signing" });
    // Loaded on demand: @polkadot/api is large and only this card needs it.
    const { ApiPromise, WsProvider } = await import("@polkadot/api");
    // Cast: @polkadot's provider types don't satisfy exactOptionalPropertyTypes.
    const api = await ApiPromise.create({ provider: new WsProvider(net.wsUrl as string), noInitWarn: true } as unknown as ApiOptions);
    try {
      const transfer = api.tx.balances?.transferKeepAlive;
      if (!transfer) throw new Error("This runtime has no balances.transferKeepAlive call.");
      await new Promise<void>((resolve, reject) => {
        transfer(dest, planck)
          .signAndSend(sender.address, { signer: sender.signer }, (result) => {
            const hash = result.txHash.toHex();
            if (result.dispatchError) {
              const e = result.dispatchError;
              const meta = e.isModule ? api.registry.findMetaError(e.asModule) : undefined;
              reject(new Error(meta ? `${meta.section}.${meta.name}: ${meta.docs.join(" ")}` : e.toString()));
            } else if (result.status.isFinalized) {
              setStatus({ stage: "finalized", hash });
              resolve();
            } else if (result.status.isInBlock) {
              setStatus({ stage: "inBlock", hash });
            } else {
              setStatus({ stage: "submitted", hash });
            }
          })
          .catch(reject);
      });
      await queryClient.invalidateQueries({ queryKey: ["native-account"] });
      await queryClient.invalidateQueries({ queryKey: ["balance"] });
    } catch (err) {
      setStatus({ stage: "error", message: errorMessage(err) });
    } finally {
      await api.disconnect();
    }
  }

  if (!accounts) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted">
          Testnet {net.nativeSymbol} is handed out to native <Mono>5…</Mono> addresses. Send some to <Mono>{dest}</Mono> — the
          account this EVM address pays gas from — signing with the Portaldot (or polkadot.js) extension.
        </p>
        <div>
          <Button onClick={connect}>Connect Substrate wallet</Button>
        </div>
        {connectError && <Notice tone="err">{connectError}</Notice>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {connectError && <Notice tone="warn">{connectError}</Notice>}
      {accounts.length > 0 && (
        <>
          <label className="block">
            <Label>From</Label>
            <select
              className="w-full rounded-md border border-border bg-panel-2 px-2 py-1.5 text-sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={`${a.source}:${a.address}`} value={a.address}>
                  {a.name ? `${a.name} — ` : ""}
                  {a.address} ({a.source})
                </option>
              ))}
            </select>
            {balance.data && decimals !== undefined && (
              <span className="text-xs text-muted">
                Free: {formatUnits(balance.data.free, decimals)} {net.nativeSymbol}
              </span>
            )}
          </label>
          <label className="block">
            <Label hint={`Keeps the sender above the existential deposit (transferKeepAlive).`}>Amount ({net.nativeSymbol})</Label>
            <Input value={amount} inputMode="decimal" placeholder="e.g. 100" onChange={(e) => setAmount(e.target.value)} />
          </label>
          <div>
            <Button onClick={send} disabled={!planck || busy}>
              {busy ? "Sending…" : `Send to EVM account`}
            </Button>
          </div>
        </>
      )}
      {status?.stage === "signing" && <Notice>Approve the transfer in your extension…</Notice>}
      {status && "hash" in status && status.hash && (
        <Notice tone={status.stage === "finalized" ? "ok" : "muted"}>
          {status.stage === "finalized" ? "Finalized" : status.stage === "inBlock" ? "In block, waiting for finality" : "Submitted"} ·{" "}
          <Mono>{status.hash}</Mono>
        </Notice>
      )}
      {status?.stage === "error" && <Notice tone="err">{status.message}</Notice>}
    </div>
  );
}
