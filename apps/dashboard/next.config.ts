import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  // Monorepo root, so Turbopack resolves pnpm workspace symlinks.
  turbopack: { root: path.join(import.meta.dirname, "../..") },
  reactStrictMode: true,
};

export default config;
