"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { isAddress, parseEventLogs, type Abi, type AbiFunction, type Address, type Log } from "viem";
import { useConnection, usePublicClient, useWriteContract } from "wagmi";
import { FunctionForm } from "@/components/function-form";
import { Badge, Button, Card, Input, Label, Mono, Notice, Textarea } from "@/components/ui";
import { stringifyResult } from "@/lib/abi-args";
import { ArtifactError, parseArtifact } from "@/lib/artifact";
import { errorMessage, useActiveChain, useMounted } from "@/lib/hooks";
import { recallAbi } from "@/lib/session";

export default function PlaygroundPage() {
  return (
    <Suspense>
      <Playground />
    </Suspense>
  );
}

function Playground() {
  const params = useSearchParams();
  const initialAddress = params.get("address") ?? "";
  const [address, setAddress] = useState(initialAddress);
  const [abiText, setAbiText] = useState(() => (initialAddress ? (recallAbi(initialAddress) ?? "") : ""));

  const parsed = useMemo((): { abi?: Abi; error?: string } => {
    if (!abiText.trim()) return {};
    try {
      return { abi: parseArtifact(abiText).abi };
    } catch (err) {
      return { error: err instanceof ArtifactError ? err.message : String(err) };
    }
  }, [abiText]);

  const validAddress = isAddress(address.trim()) ? (address.trim() as Address) : undefined;
  const functions = (parsed.abi ?? []).filter((x): x is AbiFunction => x.type === "function");
  const reads = functions.filter((f) => f.stateMutability === "view" || f.stateMutability === "pure");
  const writes = functions.filter((f) => !reads.includes(f));

  return (
    <div className="flex flex-col gap-4">
      <Card title="Contract">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <label className="block">
            <Label>Address</Label>
            <Input value={address} placeholder="0x…" spellCheck={false} onChange={(e) => setAddress(e.target.value)} />
            {address && !validAddress && <p className="mt-1 text-xs text-err">Not a valid address</p>}
          </label>
          <label className="block">
            <Label>ABI (or artifact JSON)</Label>
            <Textarea rows={4} value={abiText} spellCheck={false} onChange={(e) => setAbiText(e.target.value)} />
            {parsed.error && <p className="mt-1 text-xs text-err">{parsed.error}</p>}
          </label>
        </div>
      </Card>

      {validAddress && parsed.abi && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title={`Read (${reads.length})`}>
              <div className="flex flex-col gap-2">
                {reads.map((fn, i) => (
                  <FunctionCard key={`${fn.name}-${i}`} fn={fn} address={validAddress} abi={parsed.abi as Abi} mode="read" />
                ))}
                {reads.length === 0 && <p className="text-sm text-muted">No read functions.</p>}
              </div>
            </Card>
            <Card title={`Write (${writes.length})`}>
              <div className="flex flex-col gap-2">
                {writes.map((fn, i) => (
                  <FunctionCard key={`${fn.name}-${i}`} fn={fn} address={validAddress} abi={parsed.abi as Abi} mode="write" />
                ))}
                {writes.length === 0 && <p className="text-sm text-muted">No write functions.</p>}
              </div>
            </Card>
          </div>
          <EventsCard address={validAddress} abi={parsed.abi} />
        </>
      )}
    </div>
  );
}

function signature(fn: AbiFunction): string {
  return `${fn.name}(${fn.inputs.map((i) => i.type).join(", ")})`;
}

function FunctionCard({ fn, address, abi, mode }: { fn: AbiFunction; address: Address; abi: Abi; mode: "read" | "write" }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok?: string; err?: string; logs?: DecodedLog[] } | null>(null);
  const { chain, wrongNetwork } = useActiveChain();
  const client = usePublicClient({ chainId: chain.id });
  const { isConnected } = useConnection();
  const mounted = useMounted();
  const write = useWriteContract();

  const run = async (args: unknown[], value: bigint | undefined) => {
    if (!client) return;
    setBusy(true);
    setResult(null);
    try {
      if (mode === "read") {
        const out = await client.readContract({ address, abi, functionName: fn.name, args });
        setResult({ ok: stringifyResult(out) });
      } else {
        const hash = await write.mutateAsync({ address, abi, functionName: fn.name, args, value, chainId: chain.id });
        const receipt = await client.waitForTransactionReceipt({ hash });
        const logs = decodeLogs(abi, receipt.logs);
        setResult(
          receipt.status === "success"
            ? { ok: `✔ ${hash} (block ${receipt.blockNumber})`, logs }
            : { err: `Reverted: ${hash}` },
        );
      }
    } catch (err) {
      setResult({ err: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const needsWallet = mode === "write" && (!mounted || !isConnected || wrongNetwork);

  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Mono className="text-fg">{signature(fn)}</Mono>
        <span className="flex items-center gap-2">
          {fn.stateMutability === "payable" && <Badge tone="warn">payable</Badge>}
          {fn.outputs.length > 0 && <span className="text-[11px] text-muted">→ {fn.outputs.map((o) => o.type).join(", ")}</span>}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-border px-3 py-3">
          {needsWallet && <p className="text-xs text-warn">Connect a wallet on a configured network to send transactions.</p>}
          <FunctionForm
            inputs={fn.inputs}
            payable={fn.stateMutability === "payable"}
            submitLabel={mode === "read" ? "Query" : "Send transaction"}
            busy={busy}
            disabled={needsWallet}
            onSubmit={run}
          />
          {result?.ok && <pre className="overflow-x-auto rounded bg-panel-2 p-2 font-mono text-xs whitespace-pre-wrap break-all">{result.ok}</pre>}
          {result?.err && <Notice tone="err">{result.err}</Notice>}
          {result?.logs && result.logs.length > 0 && <LogList logs={result.logs} />}
        </div>
      )}
    </div>
  );
}

interface DecodedLog {
  key: string;
  eventName: string;
  args: unknown;
  blockNumber: bigint | null;
  transactionHash: string | null;
}

function decodeLogs(abi: Abi, logs: Log[]): DecodedLog[] {
  return parseEventLogs({ abi, logs, strict: false }).map((l) => ({
    key: `${l.transactionHash}-${l.logIndex}`,
    eventName: l.eventName,
    args: l.args,
    blockNumber: l.blockNumber,
    transactionHash: l.transactionHash,
  }));
}

function LogList({ logs }: { logs: DecodedLog[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {logs.map((l) => (
        <li key={l.key} className="rounded-md border border-border p-2">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge tone="ok">{l.eventName}</Badge>
            {l.blockNumber !== null && <span className="text-[11px] text-muted">block {l.blockNumber.toString()}</span>}
            {l.transactionHash && <Mono className="text-muted">{l.transactionHash}</Mono>}
          </div>
          <pre className="overflow-x-auto font-mono text-xs whitespace-pre-wrap break-all">{stringifyResult(l.args)}</pre>
        </li>
      ))}
    </ul>
  );
}

function EventsCard({ address, abi }: { address: Address; abi: Abi }) {
  const { chain } = useActiveChain();
  const client = usePublicClient({ chainId: chain.id });
  const [range, setRange] = useState("5000");
  const [state, setState] = useState<{ logs?: DecodedLog[]; undecoded?: number; err?: string; busy?: boolean }>({});

  const load = async () => {
    if (!client) return;
    setState({ busy: true });
    try {
      // cacheTime 0: viem otherwise reuses a block number up to one polling interval old.
      const latest = await client.getBlockNumber({ cacheTime: 0 });
      const span = BigInt(Math.max(1, Number(range) || 5000));
      const fromBlock = latest > span ? latest - span : 0n;
      const raw = await client.getLogs({ address, fromBlock, toBlock: latest });
      const logs = decodeLogs(abi, raw).reverse();
      setState({ logs, undecoded: raw.length - logs.length });
    } catch (err) {
      setState({ err: errorMessage(err) });
    }
  };

  return (
    <Card
      title="Events"
      actions={
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-muted">
            last
            <Input className="w-20 py-1" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Block range" />
            blocks
          </label>
          <Button variant="secondary" onClick={load} disabled={state.busy}>
            {state.busy ? "Loading…" : "Load events"}
          </Button>
        </div>
      }
    >
      {state.err && <Notice tone="err">{state.err}</Notice>}
      {state.logs && state.logs.length === 0 && <p className="text-sm text-muted">No events in range.</p>}
      {state.logs && state.logs.length > 0 && <LogList logs={state.logs} />}
      {state.undecoded ? <p className="mt-2 text-xs text-muted">{state.undecoded} log(s) not in this ABI.</p> : null}
      {!state.logs && !state.err && <p className="text-sm text-muted">Fetch and decode this contract&apos;s logs.</p>}
    </Card>
  );
}
