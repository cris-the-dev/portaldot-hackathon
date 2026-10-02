"use client";

import { TODO, getNetwork } from "@portalkit/chains";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { formatUnits, type Address } from "viem";
import { useBalance, useConnection, usePublicClient } from "wagmi";
import { NativeStatusCard } from "@/components/native";
import { Badge, Button, Card, Mono, Notice } from "@/components/ui";
import { AddNetworkButton } from "@/components/wallet";
import { errorMessage, useActiveChain, useMounted } from "@/lib/hooks";
import { networkStatuses } from "@/lib/wagmi";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Build on Portaldot with your EVM tools</h1>
        <p className="text-sm text-muted">
          Connect a wallet, get test funds, deploy a contract, and call it — no Rust required.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <StepsCard />
        <FaucetCard />
      </div>
      <NetworksCard />
      <NativeStatusCard />
    </div>
  );
}

function StepsCard() {
  return (
    <Card title="Getting started">
      <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
        <li>Install an injected wallet (e.g. MetaMask) and click <b>Connect wallet</b>.</li>
        <li>
          Add the network to your wallet:
          <div className="mt-2">
            <AddNetworkButton />
          </div>
        </li>
        <li>Get test funds from the faucet panel.</li>
        <li>
          <Link className="text-accent" href="/deploy">
            Deploy a contract
          </Link>{" "}
          from a Foundry/Hardhat artifact, then call it in the{" "}
          <Link className="text-accent" href="/playground">
            ABI playground
          </Link>
          .
        </li>
      </ol>
    </Card>
  );
}

function FaucetCard() {
  const mounted = useMounted();
  const { chain } = useActiveChain();
  const client = usePublicClient({ chainId: chain.id });
  const { address } = useConnection();
  const balance = useBalance({ address, chainId: chain.id, query: { enabled: Boolean(address) } });
  const [devNode, setDevNode] = useState<{ client: string; accounts: Address[] } | null>(null);
  const [msg, setMsg] = useState<{ ok?: string; err?: string }>({});

  const faucetUrl = findNetworkKey(chain.id)?.faucetUrl;

  // A local Anvil node exposes dev accounts and anvil_setBalance — detect it instead of assuming.
  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    (async () => {
      try {
        // Dev-node methods are outside viem's public-client RPC schema.
        const request = client.request as (args: { method: string; params?: unknown[] }) => Promise<unknown>;
        const version = await request({ method: "web3_clientVersion" });
        if (!String(version).toLowerCase().startsWith("anvil")) return;
        const accounts = await request({ method: "eth_accounts" });
        if (!cancelled) setDevNode({ client: String(version), accounts: accounts as Address[] });
      } catch {
        if (!cancelled) setDevNode(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  const fund = useCallback(async () => {
    if (!client || !address) return;
    setMsg({});
    try {
      const current = await client.getBalance({ address });
      const topUp = 100n * 10n ** BigInt(chain.nativeCurrency.decimals);
      const request = client.request as (args: { method: string; params: unknown[] }) => Promise<unknown>;
      await request({ method: "anvil_setBalance", params: [address, `0x${(current + topUp).toString(16)}`] });
      await balance.refetch();
      setMsg({ ok: `Added 100 ${chain.nativeCurrency.symbol}` });
    } catch (err) {
      setMsg({ err: errorMessage(err) });
    }
  }, [client, address, chain, balance]);

  return (
    <Card title={`Test funds · ${chain.name}`}>
      {mounted && address && balance.data && (
        <p className="mb-3 text-sm">
          Your balance:{" "}
          <b>
            {formatUnits(balance.data.value, balance.data.decimals)} {balance.data.symbol}
          </b>
        </p>
      )}

      {typeof faucetUrl === "string" && faucetUrl !== TODO && (
        <a className="text-sm text-accent" href={faucetUrl} target="_blank" rel="noreferrer">
          Open the official faucet ↗
        </a>
      )}
      {faucetUrl === TODO && <Notice tone="warn">No official faucet announced for this network yet.</Notice>}

      {devNode && (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-muted">
            Local dev node detected (<Mono>{devNode.client}</Mono>). Its {devNode.accounts.length} dev accounts are pre-funded;
            import one of the private keys printed by <Mono>anvil</Mono> at startup, or top up your own wallet:
          </p>
          <div>
            <Button onClick={fund} disabled={!mounted || !address}>
              Fund my wallet +100 {chain.nativeCurrency.symbol}
            </Button>
            {mounted && !address && <p className="mt-1 text-xs text-muted">Connect a wallet first.</p>}
          </div>
          {msg.ok && <p className="text-xs text-ok">{msg.ok}</p>}
          {msg.err && <p className="text-xs text-err">{msg.err}</p>}
          <details>
            <summary className="cursor-pointer text-xs text-muted">Dev accounts</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {devNode.accounts.map((a) => (
                <li key={a}>
                  <Mono>{a}</Mono>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
      {!devNode && faucetUrl == null && (
        <p className="text-sm text-muted">No faucet configured for this network.</p>
      )}
    </Card>
  );
}

function NetworksCard() {
  return (
    <Card title="Networks (config/networks.json)">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-1 pr-4 font-medium">Network</th>
              <th className="py-1 pr-4 font-medium">VM</th>
              <th className="py-1 pr-4 font-medium">Status</th>
              <th className="py-1 font-medium">Still TODO</th>
            </tr>
          </thead>
          <tbody>
            {networkStatuses.map((n) => (
              <tr key={n.key} className="border-t border-border">
                <td className="py-2 pr-4">
                  {n.name} <Mono className="text-muted">{n.key}</Mono>
                </td>
                <td className="py-2 pr-4 uppercase">{n.vm}</td>
                <td className="py-2 pr-4">
                  <Badge tone={n.status === "ready" ? "ok" : "warn"}>{n.status}</Badge>
                </td>
                <td className="py-2 font-mono text-xs text-muted">{n.pending.join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function findNetworkKey(chainId: number) {
  for (const n of networkStatuses) {
    const net = getNetwork(n.key, { env: {} });
    if (net.vm === "evm" && net.chainId === chainId) return net;
  }
  return undefined;
}
