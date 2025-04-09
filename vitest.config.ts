import { defineConfig } from "vitest/config";

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
