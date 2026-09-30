import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  // Project root, so ../networks.json and ../deployments can be imported.
  turbopack: { root: path.join(import.meta.dirname, "..") },
};

export default config;
