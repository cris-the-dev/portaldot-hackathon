"use client";

import { useQuery } from "@tanstack/react-query";
import { parseEventLogs } from "viem";
import { useConnection, usePublicClient } from "wagmi";
import { rwaVaultAbi } from "@/generated/abis";
import type { Deployment } from "@/generated/deployments";
import { formatToken, sortHistory, type HistoryEntry } from "@/lib/format";
import { errorMessage, useActiveChain } from "@/lib/hooks";
import type { VaultState } from "@/lib/vault";
import { Badge, Card, Mono, Notice } from "./ui";

const KIND_LABEL = { deposit: "Deposit", withdraw: "Withdraw", yield: "Yield" } as const;

/** Your deposits/withdrawals plus every yield distribution, read from vault event logs. */
export function HistoryCard({ d, state }: { d: Deployment; state: VaultState }) {
  const { chain } = useActiveChain();
  const client = usePublicClient({ chainId: chain.id });
  const { address } = useConnection();
  const explorer = chain.blockExplorers?.default.url;

  const history = useQuery({
    queryKey: ["vault-history", chain.id, d.RWAVault, address],
    enabled: Boolean(client),
    refetchInterval: 5_000,
    queryFn: async (): Promise<HistoryEntry[]> => {
      if (!client) return [];
      const logs = await client.getLogs({ address: d.RWAVault, fromBlock: BigInt(d.deployBlock), toBlock: "latest" });
      const entries: HistoryEntry[] = [];
      for (const log of parseEventLogs({ abi: rwaVaultAbi, logs })) {
        const base = { blockNumber: log.blockNumber, logIndex: log.logIndex, transactionHash: log.transactionHash };
        if (log.eventName === "YieldDeposited") entries.push({ ...base, kind: "yield", assets: log.args.assets });
        const mine = (a: string) => address !== undefined && a.toLowerCase() === address.toLowerCase();
        if (log.eventName === "Deposit" && mine(log.args.owner)) {
          entries.push({ ...base, kind: "deposit", assets: log.args.assets, shares: log.args.shares });
        }
        if (log.eventName === "Withdraw" && mine(log.args.owner)) {
          entries.push({ ...base, kind: "withdraw", assets: log.args.assets, shares: log.args.shares });
        }
      }
      return sortHistory(entries);
    },
  });

  return (
    <Card title="History">
      {history.error && <Notice tone="err">{errorMessage(history.error)}</Notice>}
      {history.data?.length === 0 && (
        <p className="text-sm text-muted">No activity yet{address ? "" : " — connect a wallet to see your deposits"}.</p>
      )}
      {history.data && history.data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1 pr-4 font-medium">Type</th>
                <th className="py-1 pr-4 text-right font-medium">{state.asset.symbol}</th>
                <th className="py-1 pr-4 text-right font-medium">{state.share.symbol}</th>
                <th className="py-1 pr-4 font-medium">Block</th>
                <th className="py-1 font-medium">Tx</th>
              </tr>
            </thead>
            <tbody>
              {history.data.map((h) => (
                <tr key={`${h.transactionHash}-${h.logIndex}`} className="border-t border-border">
                  <td className="py-2 pr-4">
                    <Badge tone={h.kind === "yield" ? "ok" : h.kind === "deposit" ? "muted" : "warn"}>{KIND_LABEL[h.kind]}</Badge>
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {h.kind === "withdraw" ? "−" : "+"}
                    {formatToken(h.assets, state.asset.decimals)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-muted">
                    {h.shares === undefined ? "—" : formatToken(h.shares, state.share.decimals, 2)}
                  </td>
                  <td className="py-2 pr-4 tabular-nums">{h.blockNumber.toString()}</td>
                  <td className="py-2">
                    {explorer ? (
                      <a className="text-accent" href={`${explorer}/tx/${h.transactionHash}`} target="_blank" rel="noreferrer">
                        <Mono>{h.transactionHash.slice(0, 10)}…</Mono>
                      </a>
                    ) : (
                      <Mono className="text-muted">{h.transactionHash.slice(0, 10)}…</Mono>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
