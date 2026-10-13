import type { OpenAPI3 } from "../../src/types/openapi-ts.ts";
import { describe, expect, it } from "vitest";
import { setupTest, testNitro } from "../tests.ts";

describe("nitro:preset:nitro-dev", async () => {
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
      });
    }
  );
});
