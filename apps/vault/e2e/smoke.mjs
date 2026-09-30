// E2E smoke test: PortalVault against a local Anvil, with an injected fake EIP-1193 wallet
// (Anvil signs for its unlocked dev account #0, which is the issuer after Deploy.s.sol).
// Needs: anvil on :8545 with contracts deployed (forge script … --broadcast), `pnpm start` on :3001,
// Chrome installed.  Run: pnpm -F @portalkit/vault-app e2e
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const APP = process.env.APP ?? "http://localhost:3001";
const SHOTS = process.env.SHOTS ?? path.resolve(import.meta.dirname, "screenshots");
const ANVIL = "http://127.0.0.1:8545";
mkdirSync(SHOTS, { recursive: true });

const fakeWallet = (rpc) => {
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
  window.ethereum = {
    async request({ method, params }) {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return (await call("eth_accounts")).slice(0, 1);
      if (method === "wallet_switchEthereumChain" || method === "wallet_addEthereumChain") return null;
      if (method === "wallet_requestPermissions" || method === "wallet_getPermissions") return [{ parentCapability: "eth_accounts" }];
      return call(method, params);
    },
    on() {},
    removeListener() {},
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
const stat = async (label) => (await page.locator("section", { hasText: label }).locator("p").nth(1).innerText()).trim();
const price = async () => Number((await stat("Share price")).split(" ")[0].replace(/,/g, ""));

await page.goto(APP);
await page.getByText("Total value locked").waitFor();
step(`vault loaded, share price ${await stat("Share price")} (empty)`);
await page.getByRole("button", { name: "Connect wallet" }).first().click();
await page.getByText("Issuer tools").waitFor();
step("connected as issuer");

// Issuer mints tGOLD to self
await page.getByRole("button", { name: "Mint", exact: true }).click();
await page.getByText(/Minted 1,000 tGOLD/).waitFor({ timeout: 30000 });
step(`minted → wallet ${await stat("Wallet balance")}`);

// Deposit 100 (approve + deposit)
await page.getByPlaceholder("0.0").fill("100");
await page.getByText(/pvtGOLD minted/).waitFor();
await page.getByRole("button", { name: /Approve & deposit/ }).click();
await page.getByText(/Deposited 100 tGOLD/).waitFor({ timeout: 30000 });
await page.waitForFunction(() => document.body.innerText.includes("100 tGOLD"));
step(`deposited → position ${await stat("Your position")}`);
const before = await price();

// Distribute 10 yield → price up 10%
await page.getByLabel(/Yield amount/).fill("10");
await page.getByRole("button", { name: "Distribute" }).click();
await page.getByText(/Distributed 10 tGOLD of yield/).waitFor({ timeout: 30000 });
await page.waitForFunction((b) => {
  const el = [...document.querySelectorAll("section")].find((s) => s.innerText.includes("Share price"));
  return el && Number(el.querySelectorAll("p")[1].innerText.split(" ")[0]) > b;
}, before);
const after = await price();
step(`yield distributed: share price ${before} → ${after}, position ${await stat("Your position")}`);
if (Math.abs(after / before - 1.1) > 1e-9) throw new Error(`expected +10% share price, got ${before} → ${after}`);
await shot("1-after-yield");

// Withdraw everything by typing the displayed amount "110" (real max is 110 - 1 wei → must snap to redeem-all)
await page.getByRole("tab", { name: "withdraw" }).click();
await page.getByPlaceholder("0.0").fill("110");
await page.getByRole("button", { name: "Withdraw", exact: true }).click();
await page.getByText(/Withdrew 110 tGOLD/).waitFor({ timeout: 30000 });
await page.waitForFunction(() => {
  const el = [...document.querySelectorAll("section")].find((s) => s.innerText.includes("Your position"));
  return el && el.querySelectorAll("p")[1].innerText.startsWith("0 ");
});
if ((await stat("Share price")) !== "—") throw new Error("empty vault should not show a share price");
step(`withdrew all → position ${await stat("Your position")}, wallet ${await stat("Wallet balance")}`);

// History: deposit, yield, withdraw
const history = page.locator("section", { hasText: "History" });
for (const kind of ["Deposit", "Yield", "Withdraw"]) await history.getByText(kind, { exact: true }).first().waitFor();
step(`history rows: ${await history.locator("tbody tr").count()}`);
await shot("2-after-withdraw");

await page.setViewportSize({ width: 390, height: 844 });
await page.reload();
await page.getByText("Total value locked").waitFor();
step(`mobile: horizontal overflow ${await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)}px`);
await shot("3-mobile");

await browser.close();
console.log(errors.length ? `\nBrowser errors:\n${errors.join("\n")}` : "\nNo browser errors.");
if (errors.length) process.exitCode = 1;
