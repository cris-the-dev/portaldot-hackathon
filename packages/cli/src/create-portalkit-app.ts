#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import prompts from "prompts";
import { CONTRACTS_TOOLCHAINS, type ContractsToolchain } from "@portalkit/templates";
import { CreateError, createProject, validateProjectName } from "./create.js";

const program = new Command()
  .name("create-portalkit-app")
  .description("Scaffold an EVM dApp for Portaldot: Foundry contracts + Next.js/wagmi web app")
  .argument("[dir]", "directory to create")
  .option("--contracts <toolchain>", `contracts toolchain: ${CONTRACTS_TOOLCHAINS.join(" | ")}`)
  .option("--no-git", "skip git init (and forge-std install)")
  .option("--no-install", "skip pnpm install")
  .option("--portalkit <path>", "link @portalkit/* packages from a local PortalKit checkout (development)")
  .action(async (dirArg: string | undefined, opts: { contracts?: string; git: boolean; install: boolean; portalkit?: string }) => {
    let dir = dirArg;
    if (!dir) {
      const answer = await prompts(
        {
          type: "text",
          name: "dir",
          message: "Project name",
          initial: "my-portalkit-app",
          validate: (v: string) => validateProjectName(path.basename(v)) ?? true,
        },
        { onCancel: () => process.exit(1) },
      );
      dir = String(answer.dir);
    }

    let contracts = opts.contracts as ContractsToolchain | undefined;
    if (contracts && !CONTRACTS_TOOLCHAINS.includes(contracts)) {
      throw new CreateError(`--contracts must be one of: ${CONTRACTS_TOOLCHAINS.join(", ")}`);
    }
    if (!contracts) {
      const answer = await prompts(
        {
          type: "select",
          name: "contracts",
          message: "Contracts toolchain",
          choices: [
            { title: "Foundry", description: "forge test / forge script (recommended)", value: "foundry" },
            { title: "Hardhat 3", description: "TypeScript + viem tests and scripts", value: "hardhat" },
          ],
        },
        { onCancel: () => process.exit(1) },
      );
      contracts = answer.contracts as ContractsToolchain;
    }

    const result = await createProject({
      dir,
      contracts,
      git: opts.git,
      install: opts.install,
      ...(opts.portalkit ? { portalkitSource: opts.portalkit } : {}),
      log: (line) => console.log(pc.dim(line)),
    });

    console.log();
    for (const s of result.steps) {
      const icon = s.status === "done" ? pc.green("✔") : s.status === "skipped" ? pc.dim("-") : pc.yellow("!");
      console.log(`${icon} ${s.name}${s.detail && s.status === "failed" ? pc.dim(` — ${s.detail}`) : ""}`);
    }
    const rel = path.relative(process.cwd(), result.dir) || ".";
    console.log(`
${pc.bold("Next steps")}
  cd ${rel}
  anvil                                            ${pc.dim("# in another terminal")}
  cp .env.example .env
  pnpm contracts:test
  set -a && . ./.env && set +a && pnpm deploy:anvil
  pnpm dev
`);
    if (result.steps.some((s) => s.status === "failed")) process.exitCode = 1;
  });

program.parseAsync().catch((err: unknown) => {
  console.error(pc.red(err instanceof CreateError ? err.message : String(err)));
  process.exitCode = 1;
});
