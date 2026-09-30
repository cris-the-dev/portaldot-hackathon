import { getAddress, isAddress, isHex, type AbiParameter } from "viem";

export class ArgError extends Error {
  override name = "ArgError";
}

const ARRAY_RE = /^(.*)\[(\d*)\]$/;
const INT_RE = /^(u?)int(\d*)$/;
const BYTES_N_RE = /^bytes(\d+)$/;

/**
 * Parse a user-typed form value into the JS value viem expects for an ABI parameter.
 * Scalars are typed as plain text; arrays and tuples are typed as JSON
 * (e.g. `["0xabc…", "0xdef…"]`, `{"to": "0x…", "amount": "1"}` or `["0x…", "1"]`).
 */
export function parseArg(param: AbiParameter, raw: string): unknown {
  const text = raw.trim();
  if (isComposite(param.type)) {
    if (text === "") throw new ArgError(`${label(param)}: expected JSON for ${param.type}`);
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new ArgError(`${label(param)}: invalid JSON for ${param.type}`);
    }
    return coerce(param, json);
  }
  return coerce(param, text);
}

/** Parse every input of a function/constructor. */
export function parseArgs(params: readonly AbiParameter[], raws: readonly string[]): unknown[] {
  return params.map((p, i) => parseArg(p, raws[i] ?? ""));
}

/** Placeholder text shown in the input for a parameter. */
export function placeholderFor(param: AbiParameter): string {
  const { type } = param;
  if (ARRAY_RE.test(type)) return `JSON array, e.g. [${example(type.replace(ARRAY_RE, "$1"))}]`;
  if (type === "tuple") return `JSON object or array: ${componentsOf(param).map((c) => c.name || c.type).join(", ")}`;
  return example(type);
}

/** JSON-safe rendering of call results (bigint → string). */
export function stringifyResult(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v), 2) ?? String(value);
}

// ---------------------------------------------------------------------------

function coerce(param: AbiParameter, value: unknown): unknown {
  const { type } = param;
  const arr = ARRAY_RE.exec(type);
  if (arr) {
    if (!Array.isArray(value)) throw new ArgError(`${label(param)}: expected an array`);
    const [, inner = "", len] = arr;
    if (len && value.length !== Number(len)) {
      throw new ArgError(`${label(param)}: expected ${len} items, got ${value.length}`);
    }
    return value.map((v, i) => coerce({ ...param, type: inner, name: `${param.name ?? ""}[${i}]` }, v));
  }

  if (type === "tuple") {
    const components = componentsOf(param);
    if (Array.isArray(value)) {
      if (value.length !== components.length) {
        throw new ArgError(`${label(param)}: expected ${components.length} tuple items, got ${value.length}`);
      }
      return components.map((c, i) => coerce(c, value[i]));
    }
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      if (components.some((c) => !c.name)) {
        throw new ArgError(`${label(param)}: tuple has unnamed fields, pass a JSON array`);
      }
      return Object.fromEntries(components.map((c) => [c.name, coerce(c, obj[c.name as string])]));
    }
    throw new ArgError(`${label(param)}: expected a JSON object or array`);
  }

  const int = INT_RE.exec(type);
  if (int) return parseInteger(param, value, int[1] === "u", Number(int[2] || 256));

  if (type === "address") {
    const s = asString(param, value);
    if (!isAddress(s, { strict: false })) throw new ArgError(`${label(param)}: not a valid address`);
    return getAddress(s);
  }

  if (type === "bool") {
    const s = asString(param, value).toLowerCase();
    if (value === true || s === "true" || s === "1") return true;
    if (value === false || s === "false" || s === "0") return false;
    throw new ArgError(`${label(param)}: expected true or false`);
  }

  if (type === "string") return asString(param, value);

  if (type === "bytes") {
    const s = asString(param, value);
    if (!isHex(s, { strict: true }) || s.length % 2 !== 0) throw new ArgError(`${label(param)}: expected 0x-hex bytes`);
    return s;
  }

  const bytesN = BYTES_N_RE.exec(type);
  if (bytesN) {
    const n = Number(bytesN[1]);
    const s = asString(param, value);
    if (!isHex(s, { strict: true }) || s.length !== 2 + n * 2) {
      throw new ArgError(`${label(param)}: expected ${n} bytes of 0x-hex (${2 + n * 2} chars)`);
    }
    return s;
  }

  throw new ArgError(`${label(param)}: unsupported type ${type}`);
}

function parseInteger(param: AbiParameter, value: unknown, unsigned: boolean, bits: number): bigint {
  let n: bigint;
  if (typeof value === "bigint") n = value;
  else if (typeof value === "number" && Number.isSafeInteger(value)) n = BigInt(value);
  else {
    const s = asString(param, value).replace(/_/g, "");
    if (!/^-?(\d+|0x[0-9a-fA-F]+)$/.test(s)) throw new ArgError(`${label(param)}: expected an integer`);
    n = s.startsWith("-") ? -BigInt(s.slice(1)) : BigInt(s);
  }
  const min = unsigned ? 0n : -(2n ** BigInt(bits - 1));
  const max = unsigned ? 2n ** BigInt(bits) - 1n : 2n ** BigInt(bits - 1) - 1n;
  if (n < min || n > max) throw new ArgError(`${label(param)}: out of range for ${param.type}`);
  return n;
}

function asString(param: AbiParameter, value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  throw new ArgError(`${label(param)}: expected a ${param.type}`);
}

function isComposite(type: string): boolean {
  return ARRAY_RE.test(type) || type === "tuple";
}

function componentsOf(param: AbiParameter): readonly AbiParameter[] {
  return "components" in param ? param.components : [];
}

function label(param: AbiParameter): string {
  return param.name ? `${param.name} (${param.type})` : param.type;
}

function example(type: string): string {
  if (INT_RE.test(type)) return "123";
  if (type === "address") return "0x…";
  if (type === "bool") return "true / false";
  if (type === "bytes" || BYTES_N_RE.test(type)) return "0x…";
  if (type === "string") return "text";
  return type;
}
