import { defineConfig } from "tsup";

// config/networks.json is inlined into the bundle, so the published package carries
// the same single source of truth the monorepo uses.
export default defineConfig({
  entry: ["src/index.ts", "src/node.ts"],
  format: ["esm"],
  // tsup's DTS step injects `baseUrl`, deprecated in TS 6.
  dts: { compilerOptions: { ignoreDeprecations: "6.0" } },
  clean: true,
  sourcemap: true,
  target: "es2022",
});
