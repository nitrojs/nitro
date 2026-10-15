import { fileURLToPath } from "node:url";
import { nitro } from "nitro/vite";
import { parseSync } from "rolldown/utils";
import { describe, expect, test } from "vitest";

const { createServer, version } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

describe.each([false, true])("vite:client (bundledDev=%s)", (bundledDev) => {
  test.skipIf(bundledDev && Number(version.split(".")[0]) < 8)(
    "serves valid client modules for a CSS import",
    async () => {
      const server = await createServer({
        root: fileURLToPath(new URL("../fixture/vite-client", import.meta.url)),
        configFile: false,
        logLevel: "warn",
        experimental: { bundledDev },
        optimizeDeps: { exclude: ["vite/dist/client/client.mjs"] },
        environments: {
          client: {
            build: {
              rollupOptions: {
                input: fileURLToPath(new URL("../fixture/vite-client/main.js", import.meta.url)),
              },
              rolldownOptions: {
                experimental: { devMode: { lazy: false } },
              },
            },
          },
        },
        plugins: [
          nitro({
            renderer: false,
            vite: { path: import.meta.resolve(process.env.NITRO_VITE_PKG || "vite") },
          }),
        ],
      });

      try {
        await server.listen(0);
        const serverURL = server.resolvedUrls!.local[0]!;
        const entryURL = new URL(bundledDev ? "assets/main.js" : "main.js", serverURL);
        await expect
          .poll(async () => (await fetch(entryURL)).status, { timeout: 10_000 })
          .toBe(200);
        const modules = new Set([entryURL.href]);
        const sources: string[] = [];

        for (const url of modules) {
          const response = await fetch(url);
          expect(response.status, url).toBe(200);
          const code = await response.text();
          const parsed = parseSync("client.mjs", code);
          expect(parsed.errors, url).toEqual([]);
          sources.push(code);

          for (const statement of parsed.program.body) {
            if (
              (statement.type === "ImportDeclaration" ||
                statement.type === "ExportAllDeclaration" ||
                statement.type === "ExportNamedDeclaration") &&
              statement.source
            ) {
              modules.add(new URL(statement.source.value, url).href);
            }
          }
        }

        expect(sources.join("\n")).toContain("rebeccapurple");
        expect(sources.join("\n")).toContain("updateStyle");
      } finally {
        await server.close();
      }
    }
  );
});
