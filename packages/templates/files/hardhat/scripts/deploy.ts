import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { network } from "hardhat";
import { getAddress } from "viem";

// pnpm deploy:anvil  (= hardhat run scripts/deploy.ts --network anvil; env: PRIVATE_KEY)
// Writes ../deployments/<chainId>.json for the web app — same format as the Foundry preset.
const { viem, networkName } = await network.create();
const publicClient = await viem.getPublicClient();
const deployBlock = await publicClient.getBlockNumber();
const counter = await viem.deployContract("Counter");
const chainId = await publicClient.getChainId();

const dir = path.resolve(import.meta.dirname, "../../deployments");
await mkdir(dir, { recursive: true });
const file = path.join(dir, `${chainId}.json`);
const deployment = { chainId, deployBlock: Number(deployBlock), Counter: getAddress(counter.address) };
await writeFile(file, `${JSON.stringify(deployment, null, 2)}\n`);
console.log(`Counter deployed to ${deployment.Counter} on ${networkName} (chainId ${chainId})`);
console.log(`wrote ${file}`);
