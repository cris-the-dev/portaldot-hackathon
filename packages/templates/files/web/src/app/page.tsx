"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { counterAbi } from "@/generated/abis";
import { deployments } from "@/generated/deployments";
import { configuredChains } from "@/lib/wagmi";

const noop = () => () => {};

export default function Home() {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const { address, chainId, isConnected } = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const chain = configuredChains.find((c) => c.id === chainId) ?? configuredChains[0];
  const counter = deployments[chain.id]?.Counter;

  const number = useReadContract({
    address: counter,
    abi: counterAbi,
    functionName: "number",
    chainId: chain.id,
    query: { enabled: Boolean(counter) },
  });
  const write = useWriteContract();
  const [hash, setHash] = useState<`0x${string}`>();
  const receipt = useWaitForTransactionReceipt({ hash, chainId: chain.id });
  const { refetch } = number;
  useEffect(() => {
    if (receipt.isSuccess) void refetch();
  }, [receipt.isSuccess, refetch]);

  const busy = write.isPending || receipt.isLoading;
  const button = "rounded-md bg-pink-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50";

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-12">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">{"{{projectName}}"}</h1>
        {mounted &&
          (isConnected ? (
            <button className="text-sm opacity-70" onClick={() => disconnect.mutate()}>
              {address?.slice(0, 6)}…{address?.slice(-4)} · disconnect
            </button>
          ) : (
            <button
              className={button}
              disabled={!connectors[0]}
              onClick={() => connectors[0] && connect.mutate({ connector: connectors[0], chainId: chain.id })}
            >
              Connect wallet
            </button>
          ))}
      </header>

      <section className="rounded-lg border border-neutral-500/30 p-6">
        <p className="text-sm opacity-70">Network: {chain.name}</p>
        {counter ? (
          <>
            <p className="mt-4 text-5xl font-semibold tabular-nums">{number.data?.toString() ?? "…"}</p>
            <button
              className={`${button} mt-6`}
              disabled={!mounted || !isConnected || busy}
              onClick={() =>
                write.mutate(
                  { address: counter, abi: counterAbi, functionName: "increment", chainId: chain.id },
                  { onSuccess: setHash },
                )
              }
            >
              {busy ? "Confirming…" : "Increment"}
            </button>
            {write.error && <p className="mt-2 text-sm text-red-500">{write.error.message.split("\n")[0]}</p>}
          </>
        ) : (
          <p className="mt-4 text-sm">
            No Counter deployed on this network yet. Run <code>pnpm deploy:anvil</code>, then restart <code>pnpm dev</code>.
          </p>
        )}
      </section>
    </main>
  );
}
