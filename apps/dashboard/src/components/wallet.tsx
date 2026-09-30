"use client";

import { useState } from "react";
import { useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain, useWalletClient } from "wagmi";
import { configuredChains } from "@/lib/wagmi";
import { errorMessage, useActiveChain, useMounted } from "@/lib/hooks";
import { Badge, Button } from "./ui";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export function WalletBar() {
  const mounted = useMounted();
  const { address, isConnected } = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();
  const { chain, wrongNetwork } = useActiveChain();
  const [error, setError] = useState<string | null>(null);

  if (!mounted) return <div className="h-8" />;

  const injectedConnector = connectors[0];

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {isConnected && (
        <select
          aria-label="Network"
          className="rounded-md border border-border bg-panel-2 px-2 py-1.5 text-sm"
          value={wrongNetwork ? "" : chain.id}
          onChange={(e) => {
            setError(null);
            // wagmi's injected connector calls wallet_addEthereumChain when the wallet lacks the chain.
            switchChain.mutate({ chainId: Number(e.target.value) }, { onError: (err) => setError(errorMessage(err)) });
          }}
        >
          {wrongNetwork && <option value="">Unsupported network</option>}
          {configuredChains.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      {isConnected && address ? (
        <>
          <Badge tone={wrongNetwork ? "warn" : "ok"}>{short(address)}</Badge>
          <Button variant="ghost" onClick={() => disconnect.mutate()}>
            Disconnect
          </Button>
        </>
      ) : (
        <Button
          disabled={!injectedConnector || connect.isPending}
          onClick={() => {
            if (!injectedConnector) return;
            setError(null);
            connect.mutate(
              { connector: injectedConnector, chainId: chain.id },
              { onError: (err) => setError(errorMessage(err)) },
            );
          }}
        >
          {connect.isPending ? "Connecting…" : "Connect wallet"}
        </Button>
      )}
      {error && <span className="w-full text-right text-xs text-err">{error}</span>}
    </div>
  );
}

/** Explicit "add network to wallet" (EIP-3085 wallet_addEthereumChain) for the active chain. */
export function AddNetworkButton() {
  const { data: walletClient } = useWalletClient();
  const { chain } = useActiveChain();
  const [state, setState] = useState<{ ok?: string; err?: string }>({});
  const mounted = useMounted();
  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="secondary"
        disabled={!walletClient}
        onClick={async () => {
          setState({});
          try {
            await walletClient?.addChain({ chain });
            setState({ ok: `${chain.name} added to your wallet` });
          } catch (err) {
            setState({ err: errorMessage(err) });
          }
        }}
      >
        Add {chain.name} to wallet
      </Button>
      {!walletClient && <span className="text-xs text-muted">Connect a wallet first.</span>}
      {state.ok && <span className="text-xs text-ok">{state.ok}</span>}
      {state.err && <span className="text-xs text-err">{state.err}</span>}
    </div>
  );
}
