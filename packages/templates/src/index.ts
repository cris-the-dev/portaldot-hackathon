import path from "node:path";
import { fileURLToPath } from "node:url";

/** Template sets shipped in ./files, and where each is copied inside a new project. */
export const TEMPLATE_SETS = {
  base: ".",
  foundry: "contracts",
  web: "web",
} as const;

export type TemplateSet = keyof typeof TEMPLATE_SETS;

/** Absolute path of a template set (works from src/ in tests and from dist/ when published). */
export function templateDir(set: TemplateSet): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../files", set);
}

/** Placeholders replaced in every text file: {{projectName}}, {{portalkitChains}}, {{portalkitCli}}. */
export type TemplateVars = Record<"projectName" | "portalkitChains" | "portalkitCli", string>;

/** Files stored under another name so npm/git don't treat them specially. */
export const RENAMES: Readonly<Record<string, string>> = { _gitignore: ".gitignore" };

/** forge-std tag installed into generated Foundry projects. */
export const FORGE_STD_TAG = "v1.17.0";
