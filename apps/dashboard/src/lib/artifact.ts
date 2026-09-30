import { isHex, type Abi, type Hex } from "viem";

export interface ParsedArtifact {
  abi: Abi;
  /** Creation bytecode, if the input had any. */
  bytecode?: Hex;
  /** Contract name, if the artifact carries one. */
  name?: string;
}

export class ArtifactError extends Error {
  override name = "ArtifactError";
}

/**
 * Accepts, as text:
 *  - a Foundry artifact  (`out/X.sol/X.json`: `{ abi, bytecode: { object } }`)
 *  - a Hardhat artifact  (`{ contractName, abi, bytecode: "0x…" }`)
 *  - a bare ABI array
 */
export function parseArtifact(text: string): ParsedArtifact {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ArtifactError("Not valid JSON");
  }

  if (Array.isArray(json)) return { abi: parseAbi(json) };

  if (!json || typeof json !== "object") throw new ArtifactError("Expected an ABI array or an artifact object");
  const obj = json as Record<string, unknown>;
  if (!("abi" in obj)) throw new ArtifactError('Artifact has no "abi" field');

  const abi = parseAbi(obj.abi);
  const rawBytecode =
    typeof obj.bytecode === "string"
      ? obj.bytecode
      : obj.bytecode && typeof obj.bytecode === "object"
        ? (obj.bytecode as Record<string, unknown>).object
        : undefined;
  const name = typeof obj.contractName === "string" ? obj.contractName : undefined;

  const result: ParsedArtifact = { abi };
  if (typeof rawBytecode === "string" && rawBytecode.replace(/^0x/, "") !== "") {
    result.bytecode = parseBytecode(rawBytecode);
  }
  if (name) result.name = name;
  return result;
}

/** Validate and normalise creation bytecode (adds the 0x prefix if missing). */
export function parseBytecode(raw: string): Hex {
  const text = raw.trim();
  const hex = (text.startsWith("0x") ? text : `0x${text}`) as Hex;
  if (hex === "0x") throw new ArtifactError("Bytecode is empty (abstract contract or interface?)");
  if (/__\$[0-9a-f]{34}\$__/.test(hex)) {
    throw new ArtifactError("Bytecode has unlinked library placeholders; link libraries first");
  }
  if (!isHex(hex, { strict: true }) || hex.length % 2 !== 0) throw new ArtifactError("Bytecode is not valid hex");
  return hex;
}

function parseAbi(value: unknown): Abi {
  if (!Array.isArray(value)) throw new ArtifactError("ABI must be an array");
  for (const [i, item] of value.entries()) {
    if (!item || typeof item !== "object" || typeof (item as { type?: unknown }).type !== "string") {
      throw new ArtifactError(`ABI item #${i} has no "type"`);
    }
  }
  return value as Abi;
}
