#!/usr/bin/env node
import { Command } from "commander";
import { loadNetworksFromFile } from "@portalkit/chains/node";
import { runDoctor } from "./doctor.js";
import { formatReport } from "./format.js";

const program = new Command()
  .name("portalkit")
  .description("PortalKit developer tools for Portaldot EVM");

program
  .command("doctor")
  .description("Check that a network's RPC is alive, matches config, speaks eth_*, and the deployer is funded")
  .option("-n, --network <key>", "network key from networks.json", "anvil")
  .option("-c, --config <path>", "path to a networks.json (default: bundled config)")
  .option("-a, --address <address>", "account to check the balance of (default: account of $PRIVATE_KEY)")
  .option("--min-balance <amount>", "minimum native balance, in whole units", "0.1")
  .option("--json", "print the report as JSON")
  .action(async (opts: { network: string; config?: string; address?: string; minBalance: string; json?: boolean }) => {
    const report = await runDoctor({
      network: opts.network,
      minBalance: opts.minBalance,
      ...(opts.address ? { address: opts.address } : {}),
      ...(opts.config ? { config: await loadNetworksFromFile(opts.config) } : {}),
    });
    console.log(opts.json ? JSON.stringify(report, null, 2) : formatReport(report));
    process.exitCode = report.ok ? 0 : 1;
  });

program.parseAsync().catch((err: unknown) => {
  console.error((err as Error).message);
  process.exitCode = 1;
});
