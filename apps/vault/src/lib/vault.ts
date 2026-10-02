"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { zeroAddress, type Address } from "viem";
import { useConnection, usePublicClient, useReadContracts, useWriteContract } from "wagmi";
import { mockRwaAbi, rwaVaultAbi } from "@/generated/abis";
import { deployments, type Deployment } from "@/generated/deployments";
import { errorMessage, useActiveChain } from "./hooks";

/** The PortalVault deployment on the active chain, from config/deployments/<chainId>.json. */
export function useDeployment(): Deployment | undefined {
  const { chain } = useActiveChain();
  return deployments[chain.id];
}

export interface VaultState {
  asset: { symbol: string; decimals: number };
  share: { symbol: string; decimals: number };
  totalAssets: bigint;
  totalSupply: bigint;
  /** Assets (base units) redeemable for one whole share. */
  assetsPerShare: bigint;
  /** Simulated compliance: only verified accounts may receive shares. */
  kycRequired: boolean;
  user?: {
    assetBalance: bigint;
    shares: bigint;
    shareValue: bigint;
    maxWithdraw: bigint;
    allowance: bigint;
    isIssuer: boolean;
    isYieldManager: boolean;
    isComplianceManager: boolean;
    isVerified: boolean;
    /** False when KYC is required and this account is not verified. */
    canDeposit: boolean;
  };
}

/** All on-chain reads for the vault page: static metadata first, then live values polled every 5s. */
export function useVaultState(d: Deployment | undefined): { state: VaultState | undefined; isLoading: boolean; error: Error | null } {
  const { chain } = useActiveChain();
  const { address } = useConnection();
  const user: Address = address ?? zeroAddress;
  const rwa = { address: d?.MockRWA ?? zeroAddress, abi: mockRwaAbi, chainId: chain.id } as const;
  const vault = { address: d?.RWAVault ?? zeroAddress, abi: rwaVaultAbi, chainId: chain.id } as const;

  const meta = useReadContracts({
    allowFailure: false,
    query: { enabled: Boolean(d) },
    contracts: [
      { ...rwa, functionName: "symbol" },
      { ...rwa, functionName: "decimals" },
      { ...vault, functionName: "symbol" },
      { ...vault, functionName: "decimals" },
      { ...rwa, functionName: "ISSUER_ROLE" },
      { ...vault, functionName: "YIELD_MANAGER_ROLE" },
      { ...vault, functionName: "COMPLIANCE_ROLE" },
    ],
  });
  const [assetSymbol, assetDecimals, shareSymbol, shareDecimals, issuerRole, yieldRole, complianceRole] = meta.data ?? [];
  const oneShare = shareDecimals === undefined ? 0n : 10n ** BigInt(shareDecimals);

  const live = useReadContracts({
    allowFailure: false,
    query: { enabled: Boolean(d && meta.data), refetchInterval: 5_000 },
    contracts: [
      { ...vault, functionName: "totalAssets" },
      { ...vault, functionName: "totalSupply" },
      { ...vault, functionName: "convertToAssets", args: [oneShare] },
      { ...rwa, functionName: "balanceOf", args: [user] },
      { ...vault, functionName: "balanceOf", args: [user] },
      { ...vault, functionName: "maxWithdraw", args: [user] },
      { ...rwa, functionName: "allowance", args: [user, vault.address] },
      { ...rwa, functionName: "hasRole", args: [issuerRole ?? `0x${"00".repeat(32)}`, user] },
      { ...vault, functionName: "hasRole", args: [yieldRole ?? `0x${"00".repeat(32)}`, user] },
      { ...vault, functionName: "hasRole", args: [complianceRole ?? `0x${"00".repeat(32)}`, user] },
      { ...vault, functionName: "kycRequired" },
      { ...vault, functionName: "isVerified", args: [user] },
    ],
  });

  let state: VaultState | undefined;
  if (meta.data && live.data && assetSymbol !== undefined && assetDecimals !== undefined && shareSymbol !== undefined && shareDecimals !== undefined) {
    const [
      totalAssets,
      totalSupply,
      assetsPerShare,
      assetBalance,
      shares,
      maxWithdraw,
      allowance,
      isIssuer,
      isYieldManager,
      isComplianceManager,
      kycRequired,
      isVerified,
    ] = live.data;
    state = {
      asset: { symbol: assetSymbol, decimals: assetDecimals },
      share: { symbol: shareSymbol, decimals: shareDecimals },
      totalAssets,
      totalSupply,
      assetsPerShare,
      kycRequired,
      ...(address
        ? {
            user: {
              assetBalance,
              shares,
              // maxWithdraw == convertToAssets(balanceOf) for this vault (no withdrawal limits).
              shareValue: maxWithdraw,
              maxWithdraw,
              allowance,
              isIssuer,
              isYieldManager,
              isComplianceManager,
              isVerified,
              canDeposit: !kycRequired || isVerified,
            },
          }
        : {}),
    };
  }

  return { state, isLoading: meta.isLoading || live.isLoading, error: meta.error ?? live.error };
}

type WriteParams = Parameters<ReturnType<typeof useWriteContract>["mutateAsync"]>[0];

/** Send a sequence of transactions, wait for each receipt, then refresh every query. */
export function useTxRunner() {
  const { chain } = useActiveChain();
  const client = usePublicClient({ chainId: chain.id });
  const write = useWriteContract();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<{ busy: boolean; step?: string; ok?: string; err?: string }>({ busy: false });

  const run = async (steps: { label: string; tx: WriteParams }[], done: string) => {
    if (!client) return;
    setStatus({ busy: true });
    try {
      for (const { label, tx } of steps) {
        setStatus({ busy: true, step: `${label}: confirm in wallet…` });
        const hash = await write.mutateAsync(tx);
        setStatus({ busy: true, step: `${label}: waiting for confirmation…` });
        const receipt = await client.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error(`${label} reverted (${hash})`);
      }
      setStatus({ busy: false, ok: done });
    } catch (err) {
      setStatus({ busy: false, err: errorMessage(err) });
    } finally {
      await queryClient.invalidateQueries();
    }
  };

  return { run, status, reset: () => setStatus({ busy: false }) };
}
