"use client";

import { useState, type FormEvent } from "react";
import { parseUnits, type AbiParameter } from "viem";
import { ArgError, parseArgs, placeholderFor } from "@/lib/abi-args";
import { useActiveChain } from "@/lib/hooks";
import { Button, Input, Label } from "./ui";

export interface FunctionFormProps {
  inputs: readonly AbiParameter[];
  payable?: boolean;
  submitLabel: string;
  busy?: boolean;
  disabled?: boolean;
  onSubmit: (args: unknown[], value: bigint | undefined) => void;
}

/** Form auto-generated from ABI inputs. Values are parsed/validated by `parseArgs` on submit. */
export function FunctionForm({ inputs, payable, submitLabel, busy, disabled, onSubmit }: FunctionFormProps) {
  const [values, setValues] = useState<string[]>(() => inputs.map(() => ""));
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { chain } = useActiveChain();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const args = parseArgs(inputs, values);
      let wei: bigint | undefined;
      if (payable && value.trim()) {
        try {
          wei = parseUnits(value.trim(), chain.nativeCurrency.decimals);
        } catch {
          throw new ArgError(`value: not a valid ${chain.nativeCurrency.symbol} amount`);
        }
      }
      onSubmit(args, wei);
    } catch (err) {
      setError(err instanceof ArgError ? err.message : String(err));
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      {inputs.map((input, i) => (
        <label key={i} className="block">
          <Label hint={input.type}>{input.name || `arg${i}`}</Label>
          <Input
            value={values[i] ?? ""}
            placeholder={placeholderFor(input)}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => setValues((v) => v.map((old, j) => (j === i ? e.target.value : old)))}
          />
        </label>
      ))}
      {payable && (
        <label className="block">
          <Label hint={chain.nativeCurrency.symbol}>value (payable)</Label>
          <Input value={value} placeholder="0.0" onChange={(e) => setValue(e.target.value)} />
        </label>
      )}
      {error && <p className="text-xs text-err">{error}</p>}
      <div>
        <Button type="submit" disabled={busy || disabled}>
          {busy ? "Working…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
