// E2E smoke test: dashboard against a local Anvil, with an injected fake EIP-1193 wallet
// (Anvil signs for its unlocked dev accounts). Needs: anvil on :8545, `pnpm start` on :3000,
// Chrome installed, and `forge build` in contracts/.  Run: pnpm -F @portalkit/dashboard e2e
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import path from "node:path";

const APP = process.env.APP ?? "http://localhost:3000";
const ARTIFACT = process.env.ARTIFACT ?? path.resolve(import.meta.dirname, "../../../contracts/out/MockRWA.sol/MockRWA.json");
const SHOTS = process.env.SHOTS ?? path.resolve(import.meta.dirname, "screenshots");
const ANVIL = "http://127.0.0.1:8545";
mkdirSync(SHOTS, { recursive: true });

const fakeWallet = (rpc) => {
  const listeners = {};
  let id = 0;
  const call = async (method, params = []) => {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    });
    const json = await res.json();
    if (json.error) throw Object.assign(new Error(json.error.message), { code: json.error.code });
    return json.result;
  };
  window.__walletCalls = [];
  window.ethereum = {
    isMetaMask: false,
    async request({ method, params }) {
      window.__walletCalls.push(method);
      if (method === "eth_requestAccounts") return (await call("eth_accounts")).slice(0, 1);
      if (method === "eth_accounts") return (await call("eth_accounts")).slice(0, 1);
      if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
      if (method === "wallet_requestPermissions" || method === "wallet_getPermissions") return [{ parentCapability: "eth_accounts" }];
      return call(method, params);
    },
    on(e, fn) { (listeners[e] ??= []).push(fn); },
    removeListener(e, fn) { listeners[e] = (listeners[e] ?? []).filter((f) => f !== fn); },
  };
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
await page.addInitScript(fakeWallet, ANVIL);
const shot = (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
const step = (s) => console.log(`• ${s}`);

// Home + connect + fund
await page.goto(APP);
await page.getByRole("button", { name: "Connect wallet" }).click();
await page.getByText(/0xf39F…2266/).waitFor();
step("connected");
await page.getByRole("button", { name: /Add Anvil \(local\) to wallet/ }).click();
await page.getByText("Anvil (local) added to your wallet").waitFor();
step("addChain → wallet_addEthereumChain called: " + (await page.evaluate(() => window.__walletCalls.includes("wallet_addEthereumChain"))));
await page.getByText(/Local dev node detected/).waitFor();
await page.getByRole("button", { name: /Fund my wallet/ }).click();
await page.getByText("Added 100 ETH").waitFor();
step("funded via anvil_setBalance");
await shot("1-home");

// Deploy MockRWA from a Foundry artifact
await page.getByRole("link", { name: "Deploy", exact: true }).click();
await page.locator('input[type="file"]').setInputFiles(ARTIFACT);
await page.getByPlaceholder("text").first().fill("Tokenized Gold");
await page.getByPlaceholder("text").nth(1).fill("tGOLD");
await page.getByPlaceholder("0x…").fill("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
await page.getByRole("button", { name: /Deploy to Anvil/ }).click();
await page.getByText(/Deployed in block/).waitFor({ timeout: 30000 });
const address = (await page.locator("dt:has-text('Contract address') + dd code").innerText()).trim();
step(`deployed MockRWA at ${address}`);
if (address !== "0x5FbDB2315678afecb367f032d93F642f64180aa3") throw new Error("address not checksummed: " + address);
await shot("2-deploy");

// Playground: read name(), write mint(), load events
await page.getByRole("link", { name: /Open in ABI playground/ }).click();
await page.getByText(/^Read \(/).waitFor();
await page.getByRole("button", { name: /^name\(\)/ }).click();
await page.getByRole("button", { name: "Query" }).first().click();
await page.locator("pre", { hasText: "Tokenized Gold" }).waitFor();
step("read name() = Tokenized Gold");
await page.getByRole("button", { name: /^mint\(address, uint256\)/ }).click();
const mintCard = page.locator("div.rounded-md", { has: page.getByRole("button", { name: /^mint\(address, uint256\)/ }) });
await mintCard.getByPlaceholder("0x…").fill("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
await mintCard.getByPlaceholder("123").fill("5000000000000000000");
await mintCard.getByRole("button", { name: "Send transaction" }).click();
await mintCard.getByText("Transfer").first().waitFor({ timeout: 30000 });
step("write mint() → decoded Transfer event in receipt");
await page.getByRole("button", { name: "Load events" }).click();
const events = page.locator("section").filter({ has: page.getByRole("button", { name: "Load events" }) });
await events.getByText("RoleGranted").first().waitFor();
await events.getByText("Transfer", { exact: true }).waitFor({ timeout: 5000 });
step("loaded + decoded historical events");
await shot("3-playground");

// Address converter
await page.getByRole("link", { name: "Address", exact: true }).click();
await page.getByPlaceholder("0x… or 5…").fill("5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY");
await page.getByText("Substrate · SS58 (prefix 42)").waitFor();
await page.getByText(/native Substrate account/).waitFor();
step("SS58 decoded; revive refuses to guess a native account's H160");
// V3 testnet guide vector: MetaMask address -> mapped Substrate account (H160 ++ 0xEE×12)
await page.getByPlaceholder("0x… or 5…").fill("0xf7eC65d11e35375A250e474059a917B537804142");
await page.getByText("5Hfmuhj1AHrTBJiC9zUPnJo1cfG2G52LLMwofSigBnjtto8Y").first().waitFor();
await page.getByRole("button", { name: "Connect Substrate wallet" }).waitFor();
await page.getByText(/gas for this EVM account is paid from/).waitFor();
step("EVM → SS58 via revive matches the V3 guide vector; fund card shown");
await shot("4-address");

// Mobile width: no horizontal overflow
await page.setViewportSize({ width: 390, height: 844 });
for (const route of ["/", "/deploy", "/playground", "/address"]) {
  await page.goto(APP + route);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  step(`mobile ${route}: horizontal overflow ${overflow}px`);
}
await shot("5-mobile-address");

await browser.close();
console.log(errors.length ? `\nBrowser errors:\n${errors.join("\n")}` : "\nNo browser errors.");
