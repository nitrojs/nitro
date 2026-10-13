import { defineConfig } from "vitest/config";

process.env.NODE_ENV = "production";

export default defineConfig({
  test: {
    testTimeout: 30_000,
    coverage: {
      reporter: ["text", "clover", "json"],
      include: ["src/**/*.ts", "!src/types/**/*.ts"],
    },
    include: ["test/**/*.test.ts"],
  },
});
