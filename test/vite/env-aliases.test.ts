import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "pathe";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { InlineConfig } from "vite";
import { nitro } from "../../src/vite.ts";

const { createBuilder, createServer } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

describe("vite: nitro aliases in host environments", () => {
  let rootDir: string;
  let appFile: string;
  let serverFile: string;
  let nitroOnlyFile: string;
  let ssrEntry: string;

  const createConfig = (): InlineConfig => ({
    root: rootDir,
    configFile: false,
    logLevel: "warn",
    resolve: { alias: { "#x": appFile } },
    environments: {
      client: {},
      ssr: { build: { rollupOptions: { input: ssrEntry } } },
    },
    plugins: [
      nitro({
        preset: "standard",
        serverDir: "./",
        output: { dir: join(rootDir, ".output") },
        alias: { "#x": serverFile, "#late": serverFile, "#nitro-only": nitroOnlyFile },
      }),
      { name: "late-alias", config: () => ({ resolve: { alias: { "#late": appFile } } }) },
    ],
  });

  beforeAll(() => {
    rootDir = realpathSync(mkdtempSync(join(tmpdir(), "nitro-env-aliases-")));
    mkdirSync(join(rootDir, "app"), { recursive: true });
    mkdirSync(join(rootDir, "api"), { recursive: true });
    appFile = join(rootDir, "app/x-app.ts");
    serverFile = join(rootDir, "app/x-server.ts");
    nitroOnlyFile = join(rootDir, "app/nitro-only.ts");
    ssrEntry = join(rootDir, "app/entry-server.ts");
    writeFileSync(appFile, `export const side = "app";`);
    writeFileSync(serverFile, `export const side = "server";`);
    writeFileSync(nitroOnlyFile, `export const side = "nitro-only";`);
    writeFileSync(
      ssrEntry,
      `import { side } from "#x";\nexport default { fetch: () => new Response(side) };`
    );
    writeFileSync(
      join(rootDir, "api/x.ts"),
      `import { side } from "#x";\nexport default () => side;`
    );
  });

  afterAll(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  describe("dev", () => {
    let server: Awaited<ReturnType<typeof createServer>>;

    beforeAll(async () => {
      server = await createServer(createConfig());
    }, 30_000);

    afterAll(async () => {
      await server?.close();
    });

    test.each([
      ["client", "app"],
      ["ssr", "app"],
      ["nitro", "server"],
    ] as const)("resolves a conflicting alias in the %s environment", async (env, side) => {
      for (const id of ["#x", "#late"]) {
        const resolved = await server.environments[env].pluginContainer.resolveId(id, ssrEntry);
        expect(resolved?.id).toBe(side === "app" ? appFile : serverFile);
      }
    });

    test("resolves a nitro-only alias in every environment", async () => {
      for (const env of ["client", "ssr", "nitro"]) {
        const resolved = await server.environments[env].pluginContainer.resolveId(
          "#nitro-only",
          ssrEntry
        );
        expect(resolved?.id).toBe(nitroOnlyFile);
      }
    });
  });

  test("resolves a conflicting alias per environment in production", async () => {
    const builder = await createBuilder(createConfig());
    await builder.buildApp();
    const { fetch } = await import(join(rootDir, ".output/server/index.mjs")).then(
      (m) => m.default
    );
    const ssr = await fetch(new Request("http://localhost/"));
    expect(await ssr.text()).toBe("app");
    const api = await fetch(new Request("http://localhost/api/x"));
    expect(await api.text()).toBe("server");
  }, 60_000);
});
