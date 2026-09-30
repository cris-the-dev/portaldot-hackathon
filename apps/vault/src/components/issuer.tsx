"use client";

import { useState } from "react";
import { useConnection } from "wagmi";
import { mockRwaAbi, rwaVaultAbi } from "@/generated/abis";
import type { Deployment } from "@/generated/deployments";
import { AmountError, formatToken, parseAmount } from "@/lib/format";
import { useActiveChain } from "@/lib/hooks";
import { useTxRunner, type VaultState } from "@/lib/vault";
import { Badge, Button, Card, Input, Notice } from "./ui";

/** Issuer tools — only rendered for accounts holding ISSUER_ROLE or YIELD_MANAGER_ROLE. */
export function IssuerCard({ d, state }: { d: Deployment; state: VaultState }) {
  const { address } = useConnection();
  const { chain } = useActiveChain();
  const tx = useTxRunner();
  const [mintText, setMintText] = useState("1000");
  const [yieldText, setYieldText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const user = state.user;
  if (!user || !address || (!user.isIssuer && !user.isYieldManager)) return null;
  const { asset } = state;

  const parse = (text: string) => {
    try {
      setErr(null);
      return parseAmount(text, asset.decimals);
    } catch (e) {
      setErr(e instanceof AmountError ? e.message : String(e));
      return undefined;
    }
  };

  const mint = () => {
    const amount = parse(mintText);
    if (amount === undefined) return;
    void tx.run(
      [{ label: "Mint", tx: { chainId: chain.id, address: d.MockRWA, abi: mockRwaAbi, functionName: "mint", args: [address, amount] } }],
      `Minted ${formatToken(amount, asset.decimals)} ${asset.symbol}`,
    );
  };

  const addYield = () => {
    const amount = parse(yieldText);
    if (amount === undefined) return;
    const steps = [];
    if (user.allowance < amount) {
      steps.push({
        label: "Approve",
        tx: { chainId: chain.id, address: d.MockRWA, abi: mockRwaAbi, functionName: "approve", args: [d.RWAVault, amount] } as const,
      });
    }
    steps.push({
      label: "Distribute yield",
      tx: { chainId: chain.id, address: d.RWAVault, abi: rwaVaultAbi, functionName: "depositYield", args: [amount] } as const,
    });
    void tx.run(steps, `Distributed ${formatToken(amount, asset.decimals)} ${asset.symbol} of yield`).then(() => setYieldText(""));
  };

  return (
    <Card title="Issuer tools" actions={<Badge tone="warn">issuer only</Badge>}>
      <div className="flex flex-col gap-4 text-sm">
        {user.isIssuer && (
          <div>
            <p className="mb-2 text-xs text-muted">Issue new {asset.symbol} to your wallet (tokenizes more of the underlying asset).</p>
            <div className="flex gap-2">
              <Input value={mintText} onChange={(e) => setMintText(e.target.value)} aria-label={`Mint amount (${asset.symbol})`} />
              <Button variant="secondary" disabled={tx.status.busy} onClick={mint}>
                Mint
              </Button>
            </div>
          </div>
        )}
        {user.isYieldManager && (
          <div>
            <p className="mb-2 text-xs text-muted">
              Distribute real-world yield (coupons, lease income) to all holders — raises the share price.
            </p>
            <div className="flex gap-2">
              <Input
                value={yieldText}
                placeholder="10"
                onChange={(e) => setYieldText(e.target.value)}
                aria-label={`Yield amount (${asset.symbol})`}
              />
              <Button variant="secondary" disabled={tx.status.busy} onClick={addYield}>
                Distribute
              </Button>
            </div>
          </div>
        )}
        {err && <p className="text-xs text-err">{err}</p>}
        {tx.status.step && <p className="text-xs text-muted">{tx.status.step}</p>}
        {tx.status.ok && <p className="text-xs text-ok">{tx.status.ok}</p>}
        {tx.status.err && <Notice tone="err">{tx.status.err}</Notice>}
      </div>
    </Card>
  );
}
