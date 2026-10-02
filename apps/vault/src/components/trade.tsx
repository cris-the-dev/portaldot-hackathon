"use client";

import { useState } from "react";
import { useConnection } from "wagmi";
import { mockRwaAbi, rwaVaultAbi } from "@/generated/abis";
import type { Deployment } from "@/generated/deployments";
import { AmountError, formatToken, parseAmount } from "@/lib/format";
import { useActiveChain, useMounted } from "@/lib/hooks";
import { useTxRunner, type VaultState } from "@/lib/vault";
import { Button, Card, Input, Notice, cx } from "./ui";

type Mode = "deposit" | "withdraw";

export function TradeCard({ d, state }: { d: Deployment; state: VaultState }) {
  const [mode, setMode] = useState<Mode>("deposit");
  const [text, setText] = useState("");
  const { address, isConnected } = useConnection();
  const { chain, wrongNetwork } = useActiveChain();
  const mounted = useMounted();
  const tx = useTxRunner();
  const { asset, share, assetsPerShare } = state;
  const user = state.user;

  let amount: bigint | undefined;
  let inputError: string | undefined;
  if (text.trim()) {
    try {
      amount = parseAmount(text, asset.decimals);
    } catch (err) {
      inputError = err instanceof AmountError ? err.message : String(err);
    }
  }

  const available = mode === "deposit" ? user?.assetBalance : user?.maxWithdraw;
  // ERC-4626 rounds conversions 1 wei in the vault's favour, so a typed "110" can exceed a
  // 109.999…9 max by dust. Treat anything within 1e-6 of the max as "withdraw everything".
  const dust = 10n ** BigInt(Math.max(0, asset.decimals - 6));
  if (mode === "withdraw" && amount !== undefined && user && amount > user.maxWithdraw && amount - user.maxWithdraw <= dust) {
    amount = user.maxWithdraw;
  }
  if (amount !== undefined && available !== undefined && amount > available) {
    inputError = mode === "deposit" ? `Not enough ${asset.symbol}` : "More than your position";
  }

  // Preview with the current price (same rounding direction as the contract's previews).
  const oneShare = 10n ** BigInt(share.decimals);
  const previewShares = amount !== undefined && assetsPerShare > 0n ? (amount * oneShare) / assetsPerShare : undefined;

  const submit = () => {
    if (!address || amount === undefined || !user) return;
    const base = { chainId: chain.id } as const;
    if (mode === "deposit") {
      const steps = [];
      if (user.allowance < amount) {
        steps.push({
          label: "Approve",
          tx: { ...base, address: d.MockRWA, abi: mockRwaAbi, functionName: "approve", args: [d.RWAVault, amount] } as const,
        });
      }
      steps.push({
        label: "Deposit",
        tx: { ...base, address: d.RWAVault, abi: rwaVaultAbi, functionName: "deposit", args: [amount, address] } as const,
      });
      void tx.run(steps, `Deposited ${formatToken(amount, asset.decimals)} ${asset.symbol}`).then(() => setText(""));
    } else {
      // Withdrawing everything → redeem all shares so no dust is left behind.
      const all = amount === user.maxWithdraw;
      const step = all
        ? { ...base, address: d.RWAVault, abi: rwaVaultAbi, functionName: "redeem", args: [user.shares, address, address] } as const
        : { ...base, address: d.RWAVault, abi: rwaVaultAbi, functionName: "withdraw", args: [amount, address, address] } as const;
      void tx.run([{ label: "Withdraw", tx: step }], `Withdrew ${formatToken(amount, asset.decimals)} ${asset.symbol}`).then(() =>
        setText(""),
      );
    }
  };

  const blocked = !mounted || !isConnected || wrongNetwork;
  const kycBlocked = mode === "deposit" && user !== undefined && !user.canDeposit;

  return (
    <Card>
      <div role="tablist" className="mb-4 grid grid-cols-2 rounded-md bg-panel-2 p-1 text-sm">
        {(["deposit", "withdraw"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            className={cx("rounded px-3 py-1.5 capitalize", mode === m ? "bg-panel font-medium shadow-sm" : "text-muted")}
            onClick={() => {
              setMode(m);
              setText("");
              tx.reset();
            }}
          >
            {m}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="mb-1 flex justify-between text-xs text-muted">
          <span>Amount ({asset.symbol})</span>
          {available !== undefined && (
            <button
              type="button"
              className="text-accent"
              onClick={() => setText(formatToken(available, asset.decimals, asset.decimals).replace(/,/g, ""))}
            >
              {mode === "deposit" ? "Balance" : "Max"}: {formatToken(available, asset.decimals)}
            </button>
          )}
        </span>
        <Input
          inputMode="decimal"
          className="py-2.5 text-lg"
          placeholder="0.0"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={Boolean(inputError)}
        />
      </label>
      {inputError && <p className="mt-1 text-xs text-err">{inputError}</p>}
      {kycBlocked && (
        <Notice tone="warn">
          This vault only accepts KYC-verified investors and your address is not verified yet. Ask the issuer to verify it.
          Withdrawals are never blocked.
        </Notice>
      )}
      {previewShares !== undefined && !inputError && (
        <p className="mt-2 text-xs text-muted">
          ≈ {formatToken(previewShares, share.decimals)} {share.symbol} {mode === "deposit" ? "minted" : "burned"}
        </p>
      )}

      <Button
        className="mt-4 w-full py-2.5"
        disabled={blocked || kycBlocked || tx.status.busy || amount === undefined || Boolean(inputError)}
        onClick={submit}
      >
        {tx.status.busy
          ? "Working…"
          : blocked
            ? "Connect wallet"
            : mode === "deposit" && user && amount !== undefined && user.allowance < amount
              ? `Approve & deposit`
              : mode === "deposit"
                ? "Deposit"
                : "Withdraw"}
      </Button>
      <div className="mt-3 min-h-5 text-xs" aria-live="polite">
        {tx.status.step && <span className="text-muted">{tx.status.step}</span>}
        {tx.status.ok && <span className="text-ok">{tx.status.ok}</span>}
      </div>
      {tx.status.err && <Notice tone="err">{tx.status.err}</Notice>}
    </Card>
  );
}
