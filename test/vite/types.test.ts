import { existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "pathe";
import type { ViteDevServer } from "vite";
import { describe, test, expect, beforeAll, afterAll } from "vitest";

const { createServer, createBuilder } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

const rootDir = fileURLToPath(new URL("./app-fixture", import.meta.url));
const typesDir = join(rootDir, "node_modules/.nitro/types");

const DECLARATION_FILES = [
  "nitro.d.ts",
  "nitro-routes.d.ts",
  "nitro-config.d.ts",
  "nitro-imports.d.ts",
];

const expectDeclarationFiles = () => {
  for (const file of DECLARATION_FILES) {
    expect(existsSync(join(typesDir, file)), `${file} should exist`).toBe(true);
  }
};

describe("vite:types (dev)", () => {
  let server: ViteDevServer;
  const originalCwd = process.cwd();

  beforeAll(async () => {
    rmSync(typesDir, { recursive: true, force: true });
    process.chdir(rootDir);
    server = await createServer({ root: rootDir });
  }, 30_000);

  afterAll(async () => {
    await server?.close();
    process.chdir(originalCwd);
  });

  test("generates all nitro type declaration files", expectDeclarationFiles);
});

describe("vite:types (prod)", () => {
  const originalCwd = process.cwd();

  beforeAll(async () => {
    rmSync(typesDir, { recursive: true, force: true });
    process.chdir(rootDir);
    const builder = await createBuilder({ root: rootDir, logLevel: "warn" });
    await builder.buildApp();
  }, 30_000);

  afterAll(() => {
    process.chdir(originalCwd);
  });

  test("generates all type declaration files", expectDeclarationFiles);
});
