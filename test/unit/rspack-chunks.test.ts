import { describe, expect, it } from "vitest";
import { ChunkNames } from "../../src/build/rspack/_chunks.ts";

describe("rspack: chunk names", () => {
  it("matches Windows module paths with route handlers", () => {
    const nitro = {
      options: { builder: "rspack", buildDir: "C:/app/.nitro", tasks: {} },
      routing: {
        routes: { routes: [{ data: [{ route: "/api/echo", handler: "C:/app/routes/echo.ts" }] }] },
      },
    };
    const chunkNames = new ChunkNames(nitro as any, { toId: (resource) => resource });
    const chunk = {
      id: "1",
      name: undefined,
      groupsIterable: [{ getModulePostOrderIndex: () => 0 }],
    };
    const compilation = {
      chunks: [chunk],
      chunkGraph: {
        getNumberOfEntryModules: () => 0,
        getChunkModules: () => [{ resource: String.raw`C:\app\routes\echo.ts` }],
      },
    };
    expect(chunkNames.chunkFileNames(compilation as any).get("1")).toBe("_routes/api/echo.mjs");
  });
});
