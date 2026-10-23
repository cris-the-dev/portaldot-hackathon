import { mkdtemp, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultNetworks } from "@portalkit/chains";
import { CreateError, createProject, validateProjectName } from "../src/create.js";

const tmp = () => mkdtemp(path.join(tmpdir(), "cpa-"));
const offline = { git: false, install: false } as const;

async function listFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join("/"))
    .sort();
}

describe("validateProjectName", () => {
  it("accepts npm-style names and rejects others", () => {
    expect(validateProjectName("my-app")).toBeNull();
    expect(validateProjectName("@scope/my.app_1")).toBeNull();
    expect(validateProjectName("")).toMatch(/required/);
    expect(validateProjectName("My App")).toMatch(/lowercase/);
    expect(validateProjectName(".hidden")).not.toBeNull();
  });
});

describe("createProject", () => {
  it("scaffolds contracts + web + config with placeholders filled", async () => {
    const dir = path.join(await tmp(), "demo");
    const result = await createProject({ dir, ...offline, portalkitVersion: "^0.1.0" });
    expect(result.projectName).toBe("demo");
    expect(result.steps.map((s) => [s.name, s.status])).toEqual([
      ["scaffold", "done"],
      ["git init", "skipped"],
      ["pnpm install", "skipped"],
    ]);

    const files = await listFiles(dir);
    expect(files).toEqual(
      expect.arrayContaining([
        ".gitignore",
        ".env.example",
        "README.md",
        "package.json",
        "pnpm-workspace.yaml",
        "networks.json",
        "deployments/.gitkeep",
        "contracts/foundry.toml",
        "contracts/src/Counter.sol",
        "contracts/test/Counter.t.sol",
        "contracts/script/Deploy.s.sol",
        "web/package.json",
        "web/next.config.ts",
        "web/scripts/sync.mjs",
        "web/src/app/page.tsx",
        "web/src/lib/wagmi.ts",
        "web/src/generated/abis.ts",
      ]),
    );
    expect(files).not.toContain("_gitignore");

    for (const file of files) {
      const text = await readFile(path.join(dir, file), "utf8");
      expect(text, file).not.toMatch(/\{\{\w+\}\}/);
    }

    const pkg = JSON.parse(await readFile(path.join(dir, "package.json"), "utf8"));
    expect(pkg.name).toBe("demo");
    expect(pkg.devDependencies["@portalkit/cli"]).toBe("^0.1.0");
    expect(pkg.scripts.check).toContain("portalkit doctor");
    expect(pkg.scripts.doctor).toBeUndefined(); // `pnpm doctor` is a pnpm built-in
    const web = JSON.parse(await readFile(path.join(dir, "web/package.json"), "utf8"));
    expect(web.name).toBe("demo-web");
    expect(web.dependencies["@portalkit/chains"]).toBe("^0.1.0");
    expect(await readFile(path.join(dir, "web/src/app/page.tsx"), "utf8")).toContain('{"demo"}');

    const networks = JSON.parse(await readFile(path.join(dir, "networks.json"), "utf8"));
    expect(networks).toEqual(defaultNetworks);
  });

  it("scaffolds the Hardhat 3 preset as a workspace package", async () => {
    const dir = path.join(await tmp(), "hh");
    await createProject({ dir, contracts: "hardhat", ...offline, portalkitVersion: "^0.1.0" });
    const files = await listFiles(dir);
    expect(files).toEqual(
      expect.arrayContaining([
        "contracts/package.json",
        "contracts/hardhat.config.ts",
        "contracts/src/Counter.sol",
        "contracts/test/Counter.ts",
        "contracts/scripts/deploy.ts",
      ]),
    );
    expect(files).not.toContain("contracts/foundry.toml");

    const pkg = JSON.parse(await readFile(path.join(dir, "package.json"), "utf8"));
    expect(pkg.scripts["contracts:test"]).toBe("pnpm -C contracts test");
    expect(pkg.scripts["deploy:anvil"]).toBe("pnpm -C contracts deploy:anvil");
    expect(pkg.scripts["deploy:portaldot"]).toBeUndefined();
    const contracts = JSON.parse(await readFile(path.join(dir, "contracts/package.json"), "utf8"));
    expect(contracts.name).toBe("hh-contracts");
    expect(contracts.devDependencies["@portalkit/chains"]).toBe("^0.1.0");

    const ws = await readFile(path.join(dir, "pnpm-workspace.yaml"), "utf8");
    expect(ws).toContain('  - "contracts"\n  - "web"');
    expect(ws).toContain("esbuild: true");
    expect(await readFile(path.join(dir, "README.md"), "utf8")).toContain("Hardhat 3 (viem)");
  });

  it("uses an explicit project name", async () => {
    const dir = path.join(await tmp(), "folder");
    const result = await createProject({ dir, projectName: "@acme/vault", ...offline });
    expect(result.projectName).toBe("@acme/vault");
    expect(JSON.parse(await readFile(path.join(dir, "package.json"), "utf8")).name).toBe("@acme/vault");
  });

  it("refuses a non-empty directory and invalid names", async () => {
    const dir = await tmp();
    await writeFile(path.join(dir, "keep.txt"), "x");
    await expect(createProject({ dir, projectName: "ok", ...offline })).rejects.toThrow(/not empty/);
    await expect(createProject({ dir: path.join(await tmp(), "Bad Name"), ...offline })).rejects.toThrow(CreateError);
  });

  it("accepts an existing empty directory", async () => {
    const dir = path.join(await tmp(), "empty");
    await createProject({ dir, ...offline });
    expect((await stat(path.join(dir, "contracts"))).isDirectory()).toBe(true);
  });
});
