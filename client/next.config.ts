import path from "node:path";
import type { NextConfig } from "next";

const repositoryRoot = path.resolve(__dirname, "..");

const nextConfig: NextConfig = {
  turbopack: {
    root: repositoryRoot,
    rules: { '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' } },
  },
  outputFileTracingRoot: repositoryRoot,
};

export default nextConfig;
