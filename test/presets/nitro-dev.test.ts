import type { OpenAPI3 } from "../../src/types/openapi-ts.ts";
import { describe, expect, it } from "vitest";
import { describeIf, setupTest, testNitro } from "../tests.ts";

// Nitro dev server does not support the vite builder (use `vite dev`)
const supported = process.env.NITRO_BUILDER !== "vite";

describeIf(supported, "nitro:preset:nitro-dev (serve static)", async () => {
  const ctx = await setupTest("nitro-dev", {
    config: { serveStatic: true },
    outDirSuffix: "-serve-static",
  });

  it("serves public assets via internal fetch", async () => {
    const res = await ctx.fetch("/fetch-public-asset");
    const data = await res.json();
    expect(data.status).toBe(200);
    expect(data.body).toBe("Works!\n");
  });
});

describeIf(supported, "nitro:preset:nitro-dev", async () => {
  const ctx = await setupTest("nitro-dev");
  testNitro(
    ctx,
    () => {
      return async ({ url, headers, method, body }) => {
        const res = await ctx.fetch(url, {
          headers,
          method,
          body,
        });
        return res;
      };
    },
    (_ctx, callHandler) => {
      it.skipIf(process.env.OFFLINE)("returns correct status for devProxy", async () => {
        const { status } = await callHandler({ url: "/proxy/example" });
        expect(status).toBe(200);
      });

      it("compresses only compressible public assets", async () => {
        const css = await callHandler({ url: "/foo.css", headers: { "Accept-Encoding": "br" } });
        expect(css.headers["content-encoding"]).toBe("br");
        const ico = await callHandler({
          url: "/favicon.ico",
          headers: { "Accept-Encoding": "br" },
        });
        expect(ico.status).toBe(200);
        expect(ico.headers["content-encoding"]).toBeUndefined();
      });

      describe("tasks", () => {
        it("GET /_nitro/tasks lists tasks", async () => {
          const { data, status } = await callHandler({ url: "/_nitro/tasks" });
          expect(status).toBe(200);
          expect(data.tasks).toBeTypeOf("object");
          expect(data.tasks.test).toMatchObject({ description: "task to debug" });
          expect(data.tasks["db:migrate"]).toMatchObject({
            description: "Run database migrations",
          });
          expect(data.scheduledTasks).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ cron: "* * * * *", tasks: ["test"] }),
            ])
          );
        });

        it("GET /_nitro/tasks/:name runs a task", async () => {
          const { data, status } = await callHandler({
            url: "/_nitro/tasks/db:migrate",
          });
          expect(status).toBe(200);
          expect(data.result).toBe("Success");
        });

        it("POST /_nitro/tasks/:name runs a task", async () => {
          const { data, status } = await callHandler({
            url: "/_nitro/tasks/db:migrate",
            method: "POST",
          });
          expect(status).toBe(200);
          expect(data.result).toBe("Success");
        });

        it("POST /_nitro/tasks/:name accepts payload", async () => {
          const { data, status } = await callHandler({
            url: "/_nitro/tasks/test",
            method: "POST",
            body: JSON.stringify({ payload: { key: "value" } }),
          });
          expect(status).toBe(200);
          expect(data.result.payload.key).toBe("value");
        });

        it("GET /_nitro/tasks/:name accepts query params as payload", async () => {
          const { data, status } = await callHandler({
            url: "/_nitro/tasks/test?key=value",
          });
          expect(status).toBe(200);
          expect(data.result.payload.key).toBe("value");
        });
      });

      describe("dev error page recovery", () => {
        const page = (dest: string) =>
          ctx.fetch("/500", { headers: { accept: "text/html", "sec-fetch-dest": dest } });
        const reloadState = async (query = "id=none") =>
          (await ctx.fetch(`/_nitro/dev/reload?${query}`)).json() as Promise<{
            id: string;
            v: number;
          }>;

        it("injects the reload script into HTML error page loads only", async () => {
          const res = await page("document");
          expect(res.status).toBe(500);
          const html = await res.text();
          const { id, v } = await reloadState();
          expect(html).toContain(JSON.stringify({ url: "/_nitro/dev/reload", id, v }));
          expect(html.trimEnd().endsWith("</script>")).toBe(true);

          const fetched = await page("empty");
          expect(await fetched.text()).not.toContain("/_nitro/dev/reload");
        });

        it("answers waiting pages once the worker reloads", async () => {
          const { id, v } = await reloadState();
          const waiting = reloadState(`id=${id}&v=${v}`);
          await ctx.nitro!.hooks.callHook("dev:reload");
          expect(await waiting).toEqual({ id, v: v + 1 });
          expect((await ctx.fetch("/api/hello")).status).toBe(200);
        });
      });

      describe("openAPI", () => {
        let spec: OpenAPI3;
        it("/_openapi.json", async () => {
          spec = ((await callHandler({ url: "/_openapi.json" })) as any).data;
          expect(spec.openapi).to.match(/^3\.\d+\.\d+$/);
          expect(spec.info?.title).toBe("Nitro Test Fixture");
          expect(spec.info?.description).toBe("Nitro Test Fixture API");
        });

        it("defineRouteMeta works", () => {
          expect(spec.paths?.["/api/meta/test"]).toMatchInlineSnapshot(`
            {
              "get": {
                "description": "Test route description",
                "parameters": [
                  {
                    "in": "query",
                    "name": "test",
                    "required": true,
                  },
                  {
                    "in": "query",
                    "name": "val",
                    "schema": {
                      "enum": [
                        0,
                        1,
                      ],
                      "type": "integer",
                    },
                  },
                ],
                "responses": {
                  "200": {
                    "content": {
                      "application/json": {
                        "schema": {
                          "$ref": "#/components/schemas/Test",
                        },
                      },
                    },
                    "description": "result",
                  },
                },
                "tags": [
                  "test",
                ],
              },
            }
          `);
        });

        it("named catch-all params", () => {
          expect(spec.paths?.["/api/wildcard/{param}"]?.get?.parameters).toEqual([
            { name: "param", in: "path", required: true, schema: { type: "string" } },
          ]);
        });
      });
    }
  );
});
