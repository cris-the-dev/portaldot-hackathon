"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getAddress, isAddress, parseEventLogs, type Address } from "viem";
import { usePublicClient } from "wagmi";
import { rwaVaultAbi } from "@/generated/abis";
import type { Deployment } from "@/generated/deployments";
import { useActiveChain } from "@/lib/hooks";
import { useTxRunner, type VaultState } from "@/lib/vault";
import { Badge, Button, Card, Input, Mono, Notice } from "./ui";

/** Verified investors, rebuilt from VerificationUpdated events (last update per account wins). */
function useVerifiedInvestors(d: Deployment) {
  const { chain } = useActiveChain();
  const client = usePublicClient({ chainId: chain.id });
  return useQuery({
    queryKey: ["verified-investors", chain.id, d.RWAVault],
    enabled: Boolean(client),
    refetchInterval: 5_000,
    queryFn: async (): Promise<Address[]> => {
      if (!client) return [];
      const logs = await client.getLogs({ address: d.RWAVault, fromBlock: BigInt(d.deployBlock), toBlock: "latest" });
      const status = new Map<Address, boolean>();
      for (const log of parseEventLogs({ abi: rwaVaultAbi, logs, eventName: "VerificationUpdated" })) {
        status.set(getAddress(log.args.account), log.args.verified);
      }
      return [...status].filter(([, verified]) => verified).map(([account]) => account);
    },
  });
}

/** Compliance tools — only rendered for accounts holding COMPLIANCE_ROLE. */
export function ComplianceCard({ d, state }: { d: Deployment; state: VaultState }) {
  const { chain } = useActiveChain();
  const tx = useTxRunner();
  const [text, setText] = useState("");
  const investors = useVerifiedInvestors(d);
  if (!state.user?.isComplianceManager) return null;

  const target = text.trim();
  const valid = isAddress(target, { strict: false });
  const setVerified = (verified: boolean) =>
    void tx
      .run(
        [
          {
            label: verified ? "Verify" : "Revoke",
            tx: { chainId: chain.id, address: d.RWAVault, abi: rwaVaultAbi, functionName: "setVerified", args: [getAddress(target), verified] },
          },
        ],
        `${verified ? "Verified" : "Revoked"} ${target.slice(0, 6)}…${target.slice(-4)}`,
      )
      .then(() => setText(""));

  const toggleKyc = () =>
    void tx.run(
      [
        {
          label: "Update KYC requirement",
          tx: { chainId: chain.id, address: d.RWAVault, abi: rwaVaultAbi, functionName: "setKycRequired", args: [!state.kycRequired] },
        },
      ],
      state.kycRequired ? "KYC requirement turned off" : "KYC requirement turned on",
    );

  return (
    <Card title="Compliance" actions={<Badge tone="warn">compliance only</Badge>}>
      <div className="flex flex-col gap-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            KYC required: <b>{state.kycRequired ? "on" : "off"}</b>
          </span>
          <Button variant="secondary" disabled={tx.status.busy} onClick={toggleKyc}>
            Turn {state.kycRequired ? "off" : "on"}
          </Button>
        </div>
        <div>
          <p className="mb-2 text-xs text-muted">Verify an investor (simulated KYC) so they can hold vault shares.</p>
          <div className="flex gap-2">
            <Input value={text} placeholder="0x…" spellCheck={false} onChange={(e) => setText(e.target.value)} aria-label="Investor address" />
            <Button variant="secondary" disabled={!valid || tx.status.busy} onClick={() => setVerified(true)}>
              Verify
            </Button>
            <Button variant="ghost" disabled={!valid || tx.status.busy} onClick={() => setVerified(false)}>
              Revoke
            </Button>
          </div>
          {target && !valid && <p className="mt-1 text-xs text-err">Not a valid address</p>}
        </div>
        {tx.status.step && <p className="text-xs text-muted">{tx.status.step}</p>}
        {tx.status.ok && <p className="text-xs text-ok">{tx.status.ok}</p>}
        {tx.status.err && <Notice tone="err">{tx.status.err}</Notice>}
        <details>
          <summary className="cursor-pointer text-xs text-muted">Verified investors ({investors.data?.length ?? 0})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {investors.data?.map((a) => (
              <li key={a}>
                <Mono>{a}</Mono>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </Card>
  );
}
