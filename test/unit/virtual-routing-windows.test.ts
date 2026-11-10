import { describe, expect, it } from "vitest";
import type { Nitro } from "nitro/types";

import { initNitroRouting } from "../../src/routing.ts";
import routing from "../../src/build/virtual/routing.ts";
import routingMeta from "../../src/build/virtual/routing-meta.ts";

function createNitro(): Nitro {
  const nitro = {
    options: {
      dev: false,
      preset: "node-server",
      baseURL: "/",
      routeRules: {},
      routes: {},
      handlers: [],
      virtual: {},
      serveStatic: false,
      publicAssets: [],
    },
    scannedHandlers: [],
  } as unknown as Nitro;
  initNitroRouting(nitro);
  return nitro;
}

function importSpecifiers(code: string): string[] {
  return [...code.matchAll(/(?:from |import\()("(?:[^"\\]|\\.)*")/g)]
    .map((m) => new Function(`return ${m[1]}`)() as string)
    .filter((s) => s.includes("handler"));
}

describe("virtual/routing with late-registered windows handler paths", () => {
  const windowsPath = String.raw`C:\app\.nitro\workflow\handler.mjs`;

  it.each([false, true])("emits a valid import specifier (lazy: %s)", async (lazy) => {
    const nitro = createNitro();
    nitro.options.handlers.push({ route: "/hello", handler: windowsPath, lazy });
    nitro.routing.sync();

    expect(importSpecifiers(await routing(nitro).template())).toEqual([
      "C:/app/.nitro/workflow/handler.mjs",
    ]);
    expect(importSpecifiers(routingMeta(nitro).template())).toEqual([
      "C:/app/.nitro/workflow/handler.mjs?meta",
    ]);
  });

  it("emits a valid import specifier for middleware", async () => {
    const nitro = createNitro();
    nitro.options.handlers.push({ route: "/**", middleware: true, handler: windowsPath });
    nitro.routing.sync();

    expect(importSpecifiers(await routing(nitro).template())).toEqual([
      "C:/app/.nitro/workflow/handler.mjs",
    ]);
  });
});
