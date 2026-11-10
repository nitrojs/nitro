import { defineConfig } from "vitest/config";

process.env.NODE_ENV = "production";

export default defineConfig({
  // Vite does not set the `bun` export condition on Bun (e.g. for `srvx` and `crossws/server`)
  environments: "Bun" in globalThis ? { ssr: { resolve: { conditions: ["bun"] } } } : undefined,
  test: {
    testTimeout: 30_000,
    coverage: {
      reporter: ["text", "clover", "json"],
      include: ["src/**/*.ts", "!src/types/**/*.ts"],
    },
    include: ["test/**/*.test.ts"],
  },
});
