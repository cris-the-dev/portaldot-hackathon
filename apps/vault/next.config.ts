import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  // Monorepo root, so Turbopack resolves pnpm workspace symlinks.
  turbopack: { root: path.join(import.meta.dirname, "../..") },
  reactStrictMode: true,
  // Served under a sub-path in production (deploy/compose.yml sets BASE_PATH=/vault).
  basePath: process.env.BASE_PATH ?? "",
};

export default config;
