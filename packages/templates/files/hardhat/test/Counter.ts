import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";

describe("Counter", async () => {
  const { viem } = await network.create();
  const [wallet] = await viem.getWalletClients();

  it("increments and emits NumberChanged", async () => {
    const counter = await viem.deployContract("Counter");
    await viem.assertions.emitWithArgs(counter.write.increment(), counter, "NumberChanged", [wallet!.account.address, 1n]);
    assert.equal(await counter.read.number(), 1n);
  });

  it("sets a number", async () => {
    const counter = await viem.deployContract("Counter");
    await counter.write.setNumber([42n]);
    assert.equal(await counter.read.number(), 42n);
  });
});
