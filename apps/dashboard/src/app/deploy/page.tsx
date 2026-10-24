"use client";

import Link from "next/link";
import { useMemo, useState, type ChangeEvent } from "react";
import { encodeDeployData, formatUnits, getAddress, type Abi, type Hash } from "viem";

type AbiConstructor = Extract<Abi[number], { type: "constructor" }>;
import { useConnection, useDeployContract, usePublicClient, useWaitForTransactionReceipt } from "wagmi";
import { FunctionForm } from "@/components/function-form";
import { Card, Label, Mono, Notice, Textarea } from "@/components/ui";
import { ArtifactError, parseArtifact, parseBytecode, type ParsedArtifact } from "@/lib/artifact";
import { errorMessage, useActiveChain, useMounted } from "@/lib/hooks";
import { rememberAbi } from "@/lib/session";

export default function DeployPage() {
  const mounted = useMounted();
  const { isConnected, address } = useConnection();
  const { chain, wrongNetwork } = useActiveChain();
  const [artifactText, setArtifactText] = useState("");
  const [bytecodeText, setBytecodeText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [hash, setHash] = useState<Hash | undefined>();
  const [sendError, setSendError] = useState<string | null>(null);

  const [estimate, setEstimate] = useState<{ gas: bigint; gasPrice: bigint; balance: bigint } | null>(null);
  const [estimating, setEstimating] = useState(false);

  const publicClient = usePublicClient({ chainId: chain.id });
  const deploy = useDeployContract();
  const receipt = useWaitForTransactionReceipt({ hash, chainId: chain.id });

  const parsed = useMemo((): { artifact?: ParsedArtifact; error?: string } => {
    if (!artifactText.trim()) return {};
    try {
      return { artifact: parseArtifact(artifactText) };
    } catch (err) {
      return { error: err instanceof ArtifactError ? err.message : String(err) };
    }
  }, [artifactText]);

  const bytecode = useMemo((): { value?: `0x${string}`; error?: string } => {
    const raw = bytecodeText.trim() || parsed.artifact?.bytecode;
    if (!raw) return {};
    try {
      return { value: parseBytecode(raw) };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }, [bytecodeText, parsed.artifact?.bytecode]);

  const ctor = parsed.artifact?.abi.find((x): x is AbiConstructor => x.type === "constructor");
  const deployedAddress = receipt.data?.contractAddress ? getAddress(receipt.data.contractAddress) : undefined;
  const explorer = chain.blockExplorers?.default.url;

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setArtifactText(await file.text());
    setBytecodeText("");
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,420px)]">
      <div className="flex flex-col gap-4">
        <Card title="1 · Contract artifact">
          <p className="mb-3 text-sm text-muted">
            Upload a Foundry (<Mono>out/X.sol/X.json</Mono>) or Hardhat artifact, or paste an ABI and bytecode.
          </p>
          <input
            type="file"
            accept=".json,application/json"
            onChange={onFile}
            className="mb-3 block text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-panel-2 file:px-3 file:py-1.5 file:text-sm file:text-fg"
          />
          {fileName && <p className="mb-2 text-xs text-muted">Loaded {fileName}</p>}
          <label className="block">
            <Label>ABI or artifact JSON</Label>
            <Textarea
              rows={8}
              value={artifactText}
              spellCheck={false}
              placeholder='[{"type":"constructor","inputs":[…]}, …]'
              onChange={(e) => setArtifactText(e.target.value)}
            />
          </label>
          {parsed.error && <p className="mt-1 text-xs text-err">{parsed.error}</p>}
          <label className="mt-3 block">
            <Label hint={parsed.artifact?.bytecode ? "from artifact — paste to override" : undefined}>
              Creation bytecode
            </Label>
            <Textarea
              rows={3}
              value={bytecodeText}
              spellCheck={false}
              placeholder={parsed.artifact?.bytecode ? `${parsed.artifact.bytecode.slice(0, 42)}…` : "0x6080…"}
              onChange={(e) => setBytecodeText(e.target.value)}
            />
          </label>
          {bytecode.error && <p className="mt-1 text-xs text-err">{bytecode.error}</p>}
        </Card>

        {parsed.artifact && (
          <Card title="2 · Constructor & deploy">
            {mounted && !isConnected && <Notice tone="warn">Connect a wallet to deploy.</Notice>}
            {mounted && wrongNetwork && <Notice tone="warn">Switch your wallet to a configured network.</Notice>}
            {!ctor?.inputs.length && <p className="mb-2 text-sm text-muted">No constructor arguments.</p>}
            <FunctionForm
              key={artifactText}
              inputs={ctor?.inputs ?? []}
              payable={ctor?.stateMutability === "payable"}
              submitLabel={`Deploy to ${chain.name}`}
              busy={estimating || deploy.isPending || (Boolean(hash) && receipt.isLoading)}
              disabled={!mounted || !isConnected || wrongNetwork || !bytecode.value}
              onSubmit={async (args, value) => {
                if (!parsed.artifact || !bytecode.value || !publicClient || !address) return;
                setSendError(null);
                setHash(undefined);
                setEstimate(null);
                // Estimate first: on Portaldot V3 (pallet-revive) creation cost is dominated by a storage deposit,
                // so wallets often fail with an opaque "insufficient funds" — show the real number instead.
                setEstimating(true);
                try {
                  const data = encodeDeployData({ abi: parsed.artifact.abi, bytecode: bytecode.value, args });
                  const [gas, gasPrice, balance] = await Promise.all([
                    publicClient.estimateGas({ account: address, data, value }),
                    publicClient.getGasPrice(),
                    publicClient.getBalance({ address }),
                  ]);
                  setEstimate({ gas, gasPrice, balance });
                  if (gas * gasPrice + (value ?? 0n) > balance) return;
                } catch (err) {
                  setSendError(`Gas estimation failed: ${errorMessage(err)}`);
                  return;
                } finally {
                  setEstimating(false);
                }
                deploy.mutate(
                  { abi: parsed.artifact.abi, bytecode: bytecode.value, args, value, chainId: chain.id },
                  { onSuccess: setHash, onError: (err) => setSendError(errorMessage(err)) },
                );
              }}
            />
          </Card>
        )}
      </div>

      <Card title="Result" className="h-fit">
        {!hash && !sendError && !estimate && <p className="text-sm text-muted">The transaction and contract address show up here.</p>}
        {estimate && <CostEstimate {...estimate} symbol={chain.nativeCurrency.symbol} decimals={chain.nativeCurrency.decimals} />}
        {sendError && <Notice tone="err">{sendError}</Notice>}
        {hash && (
          <dl className="flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted">Transaction</dt>
              <dd>
                <Mono>{hash}</Mono>
                {explorer && (
                  <a className="ml-2 text-xs text-accent" href={`${explorer}/tx/${hash}`} target="_blank" rel="noreferrer">
                    explorer ↗
                  </a>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Status</dt>
              <dd>
                {receipt.isLoading && "Waiting for confirmation…"}
                {receipt.isError && <span className="text-err">{errorMessage(receipt.error)}</span>}
                {receipt.data &&
                  (receipt.data.status === "success" ? (
                    <span className="text-ok">Deployed in block {receipt.data.blockNumber.toString()}</span>
                  ) : (
                    <span className="text-err">Reverted</span>
                  ))}
              </dd>
            </div>
            {deployedAddress && parsed.artifact && (
              <div>
                <dt className="text-xs text-muted">Contract address</dt>
                <dd className="flex flex-col gap-2">
                  <Mono>{deployedAddress}</Mono>
                  <Link
                    href={`/playground?address=${deployedAddress}`}
                    onClick={() => parsed.artifact && rememberAbi(deployedAddress, parsed.artifact.abi)}
                    className="text-sm text-accent"
                  >
                    Open in ABI playground →
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        )}
      </Card>
    </div>
  );
}

function CostEstimate({ gas, gasPrice, balance, symbol, decimals }: { gas: bigint; gasPrice: bigint; balance: bigint; symbol: string; decimals: number }) {
  const cost = gas * gasPrice;
  const fmt = (v: bigint) => `${Number(formatUnits(v, decimals)).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${symbol}`;
  return (
    <dl className="mb-3 flex flex-col gap-1 text-sm">
      <dt className="text-xs text-muted">Estimated cost (upper bound)</dt>
      <dd>
        <b className="tabular-nums">{fmt(cost)}</b>
        <span className="ml-2 text-xs text-muted">
          {gas.toLocaleString()} gas × {gasPrice.toLocaleString()} wei · balance {fmt(balance)}
        </span>
      </dd>
      <dd className="text-xs text-muted">
        Most of this is the storage deposit for uploading new code — re-deploying bytecode already on chain costs far less.
      </dd>
      {cost > balance && (
        <dd>
          <Notice tone="err">
            Not enough {symbol}: short by {fmt(cost - balance)}. On Portaldot, fund this account from a native wallet on
            the{" "}
            <Link href="/address" className="underline">
              Address page
            </Link>
            .
          </Notice>
        </dd>
      )}
    </dl>
  );
}
