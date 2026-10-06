import { promises as fsp } from "node:fs";
import { Miniflare } from "miniflare";
import { resolve } from "pathe";
import { afterAll, describe, expect, it } from "vitest";

import { setupTest } from "../tests.ts";

describe("nitro:preset:cloudflare-durable", async () => {
  for (const bindingName of ["$DurableObject", "MyCustomDO"]) {
    const ctx = await setupTest("cloudflare-durable", {
      outDirSuffix: `-${bindingName}`,
      config: {
        features: { websocket: true },
        handlers: [
          { route: "/durable-websocket", handler: "./server/handlers/durable-websocket.ts" },
        ],
        cloudflare: bindingName === "$DurableObject" ? {} : { durable: { bindingName } },
      },
    });
    const config = JSON.parse(
      await fsp.readFile(resolve(ctx.outDir, "server/wrangler.json"), "utf8")
    );
    it(`generates the binding and migration for ${bindingName}`, () => {
      expect(config.durable_objects.bindings).toEqual([
        { name: bindingName, class_name: "$DurableObject" },
      ]);
      expect(config.migrations).toEqual([{ tag: "v1", new_sqlite_classes: ["$DurableObject"] }]);
    });
    const mf = new Miniflare({
      modules: true,
      scriptPath: resolve(ctx.outDir, "server/index.mjs"),
      modulesRules: [{ type: "CompiledWasm", include: ["**/*.wasm"] }],
      compatibilityDate: "2026-08-01",
      compatibilityFlags: ["nodejs_compat"],
      durableObjects: Object.fromEntries(
        config.durable_objects.bindings.map((binding: { name: string; class_name: string }) => [
          binding.name,
          { className: binding.class_name, useSQLite: true },
        ])
      ),
      bindings: ctx.env,
    });
    afterAll(() => mf.dispose());

    it(`routes WebSockets through ${bindingName}`, async () => {
      const sockets: NonNullable<Awaited<ReturnType<typeof mf.dispatchFetch>>["webSocket"]>[] = [];
      async function connect(query: string) {
        const response = await mf.dispatchFetch(`http://localhost/durable-websocket${query}`, {
          headers: { Upgrade: "websocket" },
        });
        expect(response.status).toBe(101);
        const socket = response.webSocket!;
        sockets.push(socket);
        const count = new Promise<string>((resolve) => {
          socket.addEventListener("message", (event) => resolve(String(event.data)), {
            once: true,
          });
        });
        socket.accept();
        return count;
      }
      try {
        expect(await connect("?room=alpha")).toBe("1");
        expect(await connect("?room=alpha")).toBe("2");
        expect(await connect("?room=beta")).toBe("3");
        expect(await connect("")).toBe("4");
      } finally {
        for (const socket of sockets) socket.close();
      }
    });
  }
});
