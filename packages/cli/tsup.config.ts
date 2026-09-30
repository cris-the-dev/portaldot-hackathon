import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/portalkit.ts", "src/create-portalkit-app.ts"],
  format: ["esm"],
  // tsup's DTS step injects `baseUrl`, deprecated in TS 6.
  dts: { compilerOptions: { ignoreDeprecations: "6.0" } },
  clean: true,
  sourcemap: true,
  target: "es2022",
});
