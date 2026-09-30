import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultNetworks } from "@portalkit/chains";
import {
  FORGE_STD_TAG,
  RENAMES,
  templateDir,
  templateLayout,
  type ContractsToolchain,
  type TemplateVars,
} from "@portalkit/templates";

export interface CreateOptions {
  /** Target directory (created; must be empty or missing). */
  dir: string;
  /** npm package name; defaults to the directory name. */
  projectName?: string;
  /** Contracts toolchain (default: foundry). */
  contracts?: ContractsToolchain;
  /**
   * Path to a local PortalKit monorepo. When set, @portalkit/* packages are packed from it instead of
   * taken from npm — for developing PortalKit itself before the packages are published.
   */
  portalkitSource?: string;
  /** Version range for @portalkit/* packages from npm. */
  portalkitVersion?: string;
  /** Run `git init` (+ `forge install forge-std` for Foundry; needs git + Foundry). */
  git?: boolean;
  /** Run `pnpm install` (needs pnpm). */
  install?: boolean;
  log?: (line: string) => void;
}

export interface CreateResult {
  dir: string;
  projectName: string;
  steps: { name: string; status: "done" | "skipped" | "failed"; detail?: string }[];
}

export class CreateError extends Error {
  override name = "CreateError";
}

const TEXT_EXT = new Set([".json", ".md", ".ts", ".tsx", ".mjs", ".css", ".sol", ".toml", ".yaml", ".example", ""]);

/** npm package-name rules (lowercase, url-safe, ≤ 214 chars, not starting with . or _). */
export function validateProjectName(name: string): string | null {
  if (!name) return "Project name is required";
  if (name.length > 214) return "Project name is too long";
  if (!/^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name)) {
    return "Use lowercase letters, digits, '-', '.', '_' (npm package name rules)";
  }
  return null;
}

export async function createProject(options: CreateOptions): Promise<CreateResult> {
  const log = options.log ?? (() => {});
  const dir = path.resolve(options.dir);
  const projectName = options.projectName ?? path.basename(dir);
  const nameError = validateProjectName(projectName);
  if (nameError) throw new CreateError(`Invalid project name "${projectName}": ${nameError}`);
  await assertEmptyDir(dir);

  const contracts = options.contracts ?? "foundry";
  const contractsDescription = contracts === "foundry" ? "Foundry" : "Hardhat 3 (viem)";
  const steps: CreateResult["steps"] = [];
  let vars: TemplateVars;
  let tarballs: Record<string, string> | undefined;
  if (options.portalkitSource) {
    await mkdir(dir, { recursive: true });
    log("Packing local PortalKit packages…");
    tarballs = await packLocalPackages(options.portalkitSource, dir);
    vars = {
      projectName,
      contractsDescription,
      portalkitChains: `file:../.portalkit/${tarballs["@portalkit/chains"]}`,
      portalkitCli: `file:./.portalkit/${tarballs["@portalkit/cli"]}`,
    };
  } else {
    const range = options.portalkitVersion ?? "latest";
    vars = { projectName, contractsDescription, portalkitChains: range, portalkitCli: range };
  }

  // 1. Copy template sets
  for (const [set, dest] of templateLayout(contracts)) {
    await cp(templateDir(set), path.join(dir, dest), { recursive: true });
  }
  await applyTemplate(dir, vars);
  if (contracts === "hardhat") await useHardhatScripts(dir);
  if (tarballs) await writeOverrides(dir, tarballs);

  // 2. Project config: networks.json is a snapshot of PortalKit's config (the project's own single source of truth).
  await writeFile(path.join(dir, "networks.json"), `${JSON.stringify(defaultNetworks, null, 2)}\n`);
  await mkdir(path.join(dir, "deployments"), { recursive: true });
  await writeFile(path.join(dir, "deployments", ".gitkeep"), "");
  steps.push({ name: "scaffold", status: "done", detail: dir });
  log(`Created ${projectName} in ${dir}`);

  // 3. git (+ forge-std for Foundry)
  if (options.git === false) {
    steps.push({ name: "git init", status: "skipped" });
  } else {
    const git = run("git", ["init", "-q", "-b", "main"], dir);
    if (!git.ok) steps.push({ name: "git init", status: "failed", detail: git.detail });
    else if (contracts === "hardhat") steps.push({ name: "git init", status: "done" });
    else {
      log(`Installing forge-std ${FORGE_STD_TAG}…`);
      const forge = run("forge", ["install", `foundry-rs/forge-std@${FORGE_STD_TAG}`], path.join(dir, "contracts"));
      steps.push(
        forge.ok
          ? { name: "git init + forge install forge-std", status: "done" }
          : { name: "forge install forge-std", status: "failed", detail: forge.detail },
      );
    }
  }

  // 4. pnpm install
  if (options.install === false) {
    steps.push({ name: "pnpm install", status: "skipped" });
  } else {
    log("Installing dependencies…");
    const pnpm = run("pnpm", ["install"], dir);
    steps.push(pnpm.ok ? { name: "pnpm install", status: "done" } : { name: "pnpm install", status: "failed", detail: pnpm.detail });
  }

  return { dir, projectName, steps };
}

/** Local PortalKit packages that generated projects depend on (directly or transitively). */
const LOCAL_PACKAGES = ["chains", "templates", "cli"] as const;

/**
 * Local mode: `pnpm pack` each package (this rewrites `workspace:*` like a real publish) into
 * <project>/.portalkit and point dependencies + pnpm overrides at the tarballs.
 */
async function packLocalPackages(source: string, dir: string): Promise<Record<string, string>> {
  const dest = path.join(dir, ".portalkit");
  await mkdir(dest, { recursive: true });
  const tarballs: Record<string, string> = {};
  for (const pkg of LOCAL_PACKAGES) {
    const pkgDir = path.join(path.resolve(source), "packages", pkg);
    const res = run("pnpm", ["pack", "--pack-destination", dest], pkgDir);
    if (!res.ok) throw new CreateError(`pnpm pack failed in ${pkgDir}: ${res.detail}`);
    const { name, version } = JSON.parse(await readFile(path.join(pkgDir, "package.json"), "utf8")) as {
      name: string;
      version: string;
    };
    tarballs[name] = `${name.replace("@", "").replace("/", "-")}-${version}.tgz`;
  }
  return tarballs;
}

async function writeOverrides(dir: string, tarballs: Record<string, string>): Promise<void> {
  const file = path.join(dir, "pnpm-workspace.yaml");
  const lines = Object.entries(tarballs).map(
    ([name, tgz]) => `  "${name}": "file:${path.join(dir, ".portalkit", tgz).replace(/\\/g, "/")}"`,
  );
  await writeFile(file, `${await readFile(file, "utf8")}overrides:\n${lines.join("\n")}\n`);
}

/** Hardhat's contracts/ is a pnpm workspace package; root scripts delegate to it. */
async function useHardhatScripts(dir: string): Promise<void> {
  const file = path.join(dir, "package.json");
  const pkg = JSON.parse(await readFile(file, "utf8")) as { scripts: Record<string, string> };
  pkg.scripts["contracts:build"] = "pnpm -C contracts build";
  pkg.scripts["contracts:test"] = "pnpm -C contracts test";
  pkg.scripts["deploy:anvil"] = "pnpm -C contracts deploy:anvil";
  await writeFile(file, `${JSON.stringify(pkg, null, 2)}\n`);
  const ws = path.join(dir, "pnpm-workspace.yaml");
  const yaml = (await readFile(ws, "utf8")).replace('  - "web"\n', '  - "contracts"\n  - "web"\n');
  // Hardhat → tsx → esbuild, whose postinstall only verifies its platform binary. pnpm 11 blocks
  // dependency build scripts unless approved, which would fail `pnpm install`.
  await writeFile(ws, `${yaml}# esbuild (via Hardhat/tsx): postinstall verifies its native binary\nallowBuilds:\n  esbuild: true\n`);
}

async function assertEmptyDir(dir: string): Promise<void> {
  try {
    const info = await stat(dir);
    if (!info.isDirectory()) throw new CreateError(`${dir} exists and is not a directory`);
    if ((await readdir(dir)).length > 0) throw new CreateError(`${dir} is not empty`);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

/** Rename special files and replace {{placeholders}} in every text file. */
async function applyTemplate(dir: string, vars: TemplateVars): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    let file = path.join(entry.parentPath, entry.name);
    const renamed = RENAMES[entry.name];
    if (renamed) {
      const target = path.join(entry.parentPath, renamed);
      await rename(file, target);
      file = target;
    }
    if (!TEXT_EXT.has(path.extname(file))) continue;
    const text = await readFile(file, "utf8");
    const replaced = text.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
      key in vars ? vars[key as keyof TemplateVars] : match,
    );
    if (replaced !== text) await writeFile(file, replaced);
  }
}

function run(cmd: string, args: string[], cwd: string): { ok: true } | { ok: false; detail: string } {
  // Windows needs a shell to run pnpm.cmd; pass one quoted command string (args are ours, not user input).
  const res =
    process.platform === "win32"
      ? spawnSync([cmd, ...args].map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)).join(" "), {
          cwd,
          encoding: "utf8",
          shell: true,
        })
      : spawnSync(cmd, args, { cwd, encoding: "utf8" });
  if (res.error) return { ok: false as const, detail: `${cmd} not found (${res.error.message})` };
  if (res.status !== 0) return { ok: false as const, detail: (res.stderr || res.stdout).trim().split("\n").slice(-3).join(" ") };
  return { ok: true } as const;
}
