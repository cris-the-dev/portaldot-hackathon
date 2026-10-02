"use client";

import { ComplianceCard } from "@/components/compliance";
import { HistoryCard } from "@/components/history";
import { IssuerCard } from "@/components/issuer";
import { TradeCard } from "@/components/trade";
import { Badge, Card, Mono, Notice } from "@/components/ui";
import { formatToken } from "@/lib/format";
import { errorMessage, useActiveChain, useMounted } from "@/lib/hooks";
import { useDeployment, useVaultState, type VaultState } from "@/lib/vault";

export default function VaultPage() {
  const mounted = useMounted();
  const { chain } = useActiveChain();
  const d = useDeployment();
  const { state, isLoading, error } = useVaultState(d);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Earn yield on tokenized gold</h1>
        <p className="max-w-2xl text-sm text-muted">
          Deposit {state?.asset.symbol ?? "tokenized-RWA"} tokens into an ERC-4626 vault and receive shares. When the issuer
          distributes real-world yield, every share becomes worth more {state?.asset.symbol ?? "tokens"}.
        </p>
      </div>

      {!d && (
        <Notice tone="warn">
          No PortalVault deployment for {chain.name} (chainId {chain.id}). Deploy with{" "}
          <Mono>forge script script/Deploy.s.sol --rpc-url anvil --broadcast</Mono> — addresses are read from{" "}
          <Mono>config/deployments/{chain.id}.json</Mono>.
        </Notice>
      )}
      {d && error && <Notice tone="err">Cannot read the vault on {chain.name}: {errorMessage(error)}</Notice>}
      {d && !error && isLoading && <p className="text-sm text-muted">Loading vault…</p>}

      {d && state && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge tone={state.kycRequired ? "warn" : "muted"}>
              {state.kycRequired ? "KYC-gated: verified investors only" : "Open vault: no KYC required"}
            </Badge>
            {mounted && state.user && state.kycRequired && (
              <Badge tone={state.user.isVerified ? "ok" : "err"}>
                {state.user.isVerified ? "You are verified" : "You are not verified"}
              </Badge>
            )}
          </div>
          <Stats state={state} showUser={mounted} />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
            <div className="flex flex-col gap-4">
              <TradeCard d={d} state={state} />
              <IssuerCard d={d} state={state} />
              <ComplianceCard d={d} state={state} />
            </div>
            <HistoryCard d={d} state={state} />
          </div>
          <p className="text-xs text-muted">
            Vault <Mono>{d.RWAVault}</Mono> · asset <Mono>{d.MockRWA}</Mono> · {chain.name}. Testnet demo, not audited.
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </Card>
  );
}

function Stats({ state, showUser }: { state: VaultState; showUser: boolean }) {
  const { asset, share } = state;
  const price = formatToken(state.assetsPerShare, asset.decimals, 6);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat label="Total value locked" value={`${formatToken(state.totalAssets, asset.decimals, 2)} ${asset.symbol}`} />
      {/* With no shares outstanding the ERC-4626 virtual offset makes the ratio meaningless (e.g. rounding dust
          gives "2"), so show nothing rather than a misleading number. */}
      <Stat
        label="Share price"
        value={state.totalSupply === 0n ? "—" : `${price} ${asset.symbol}`}
        sub={state.totalSupply === 0n ? "empty vault" : `per 1 ${share.symbol}`}
      />
      <Stat
        label="Your position"
        value={showUser && state.user ? `${formatToken(state.user.shareValue, asset.decimals)} ${asset.symbol}` : "—"}
        sub={showUser && state.user ? `${formatToken(state.user.shares, share.decimals, 2)} ${share.symbol}` : "Connect a wallet"}
      />
      <Stat
        label="Wallet balance"
        value={showUser && state.user ? `${formatToken(state.user.assetBalance, asset.decimals)} ${asset.symbol}` : "—"}
      />
    </div>
  );
}
