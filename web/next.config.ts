import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page is per-player and changes once a day at most, so the app runs on
  // the request-time model rather than Cache Components.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  turbopack: { root: __dirname },
};

export default nextConfig;
