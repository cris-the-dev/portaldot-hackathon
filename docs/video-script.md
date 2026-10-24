# Demo video script (~3 min)

Target: judges who know Portaldot but not PortalKit. Show, don't tell. Record at 1280×800, terminal font ≥ 16 px.
Replace the Anvil scenes with Portaldot V3 testnet once it exists (same steps, `-n portaldot-v3`).

| Time | Scene | On screen | Voice-over |
|---|---|---|---|
| 0:00–0:15 | Hook | Title card "PortalKit" → split screen: Solidity logo / Portaldot logo | "Portaldot V3 brings an EVM. Millions of Solidity developers could build here, if they knew where to start." |
| 0:15–0:35 | Problem | Three quick captions: *Which RPC? Which chainId? Where's POT?* · `5Grw…` vs `0xf39F…` · cryptic tx error | "Last season the top complaints were RPCs, faucets and opaque errors. And Portaldot has two account worlds that no tool shows together." |
| 0:35–1:05 | Scaffold | `create-portalkit-app demo --contracts foundry` → `pnpm contracts:test` → `pnpm deploy:anvil` → `pnpm dev` → click **Increment** | "One command gives you contracts, tests, a deploy script and a wired-up web app. Foundry or Hardhat. Here it is running." |
| 1:05–1:25 | Doctor (native, live) | `portalkit doctor -n portaldot-mainnet --address …`, all green, highlight *EVM: not available* | "Doctor checks a network before you deploy. This is live Portaldot mainnet: properties match, runtime 1002, and it tells you EVM isn't on yet. The day V3 ships, this line turns green." |
| 1:25–2:05 | Dashboard | Connect → **Add network** → Deploy: drop `MockRWA.json`, auto form, deploy → Playground: `name()`, `mint`, decoded `Transfer` → Address: paste SS58 → live mainnet POT balance | "No scripts: drop an artifact, get a form, deploy. Call any function, see decoded events. Paste a Portaldot address and see its real POT balance on mainnet, the bridge between both worlds." |
| 2:05–2:45 | PortalVault | Deposit 100 tGOLD → issuer **Distribute 10** → share price 1 → 1.1 → withdraw 110 → switch wallet: *You are not verified*, deposit disabled | "Built with the kit: a tokenized-gold vault. Yield raises the share price. And like real RWAs, only KYC-verified investors can hold shares, but nobody's funds are ever locked." |
| 2:45–3:00 | Close | Architecture diagram → repo URL → "Ready for V3 day one" | "Config-driven, tested, and ready to flip to V3 the day it lands. PortalKit." |

## Pre-flight checklist
- [ ] Fresh Anvil + `forge script script/Deploy.s.sol --broadcast`; MetaMask activity data cleared.
- [ ] Dashboard (`:3000`) and vault (`:3001`) running from production builds (`pnpm build && pnpm start`).
- [ ] `contracts/out/MockRWA.sol/MockRWA.json` ready to drag in.
- [ ] Second wallet account (Anvil #1) imported for the KYC scene.
- [ ] Mainnet reachable: `portalkit doctor -n portaldot-mainnet` is green.
