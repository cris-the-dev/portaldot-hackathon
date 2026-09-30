import { readFile } from "node:fs/promises";
import { parseNetworksConfig } from "./index.js";
import type { NetworksConfig } from "./schema.js";

/** Load and validate a networks.json from disk (Node only — used by the CLI / `portalkit doctor`). */
export async function loadNetworksFromFile(path: string): Promise<NetworksConfig> {
  const text = await readFile(path, "utf8");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse ${path}: ${(err as Error).message}`, { cause: err });
  }
  return parseNetworksConfig(raw);
}
