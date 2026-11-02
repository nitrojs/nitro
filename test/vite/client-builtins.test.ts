import { describe, expect, it } from "vitest";
import { nitro } from "../../src/build/vite/plugin.ts";
import { createServer, resolveConfig } from "vite";

describe("vite: client builtin aliases (#4853)", () => {
  it.each(["cloudflare-module", "cloudflare-pages", "cloudflare-durable", "deno"] as const)(
    "does not leak node: aliases into shared resolve.alias for preset: %s",
    async (preset) => {
      const config = await resolveConfig(
        {
          plugins: [nitro({ preset })],
          logLevel: "silent",
        },
        "build"
      );

      const rawAliases = config.resolve.alias;
      const aliases: Array<{ find: string | RegExp; replacement: string }> = Array.isArray(
        rawAliases
      )
        ? (rawAliases as any)
        : Object.entries(rawAliases || {}).map(([find, replacement]) => ({
            find,
            replacement:
              typeof replacement === "string" ? replacement : (replacement as any).replacement,
          }));

      const nodeAliases = aliases.filter(
        (a) => typeof a.replacement === "string" && a.replacement.startsWith("node:")
      );

      expect(nodeAliases).toEqual([]);
    }
  );

  it("resolves node: aliases in server environments", async () => {
    const server = await createServer({
      plugins: [nitro({ preset: "cloudflare-module" })],
      logLevel: "silent",
    });
    try {
      const nitroEnv = server.environments.nitro;
      const resolved = await nitroEnv.pluginContainer.resolveId("events");
      expect(resolved?.id).toBe("node:events");
      expect(resolved?.external).toBe(true);

      const bufferResolved = await nitroEnv.pluginContainer.resolveId("buffer/");
      expect(bufferResolved?.id).toBe("node:buffer");
      expect(bufferResolved?.external).toBe(true);
    } finally {
      await server.close();
    }
  });

  it("preserves non-node aliases in shared resolve.alias", async () => {
    const config = await resolveConfig(
      {
        plugins: [
          nitro({
            preset: "cloudflare-module",
            alias: {
              "~/custom": "/path/to/custom",
            },
          }),
        ],
        logLevel: "silent",
      },
      "build"
    );

    const rawAliases = config.resolve.alias;
    const aliases: Array<{ find: string | RegExp; replacement: string }> = Array.isArray(rawAliases)
      ? (rawAliases as any)
      : Object.entries(rawAliases || {}).map(([find, replacement]) => ({
          find,
          replacement:
            typeof replacement === "string" ? replacement : (replacement as any).replacement,
        }));

    const customAlias = aliases.find((a) => a.find === "~/custom");
    expect(customAlias?.replacement).toBe("/path/to/custom");
  });
});
