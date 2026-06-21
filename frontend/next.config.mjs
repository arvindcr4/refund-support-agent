import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to this app so Next doesn't pick up an unrelated
  // parent lockfile (e.g. ~/pnpm-lock.yaml) when inferring the root.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
