import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    // Tests run against an in-memory Postgres (PGlite) with the migrations applied.
    env: { PGLITE_DIR: "memory://" },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
