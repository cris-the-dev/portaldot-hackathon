import path from "node:path";
import { fileURLToPath } from "node:url";

export type TemplateSet = "base" | "foundry" | "hardhat" | "web";
export type ContractsToolchain = "foundry" | "hardhat";
export const CONTRACTS_TOOLCHAINS: readonly ContractsToolchain[] = ["foundry", "hardhat"];

/** Which template sets make up a project, and where each is copied inside it. */
export function templateLayout(contracts: ContractsToolchain): [TemplateSet, string][] {
  return [
    ["base", "."],
    [contracts, "contracts"],
    ["web", "web"],
  ];
}

/** Absolute path of a template set (works from src/ in tests and from dist/ when published). */
export function templateDir(set: TemplateSet): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../files", set);
}

/** Placeholders replaced in every text file, e.g. {{projectName}}. */
export type TemplateVars = Record<"projectName" | "portalkitChains" | "portalkitCli" | "contractsDescription", string>;

/** Files stored under another name so npm/git don't treat them specially. */
export const RENAMES: Readonly<Record<string, string>> = { _gitignore: ".gitignore" };

/** forge-std tag installed into generated Foundry projects. */
export const FORGE_STD_TAG = "v1.17.0";
