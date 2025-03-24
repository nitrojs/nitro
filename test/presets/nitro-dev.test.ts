import type { OpenAPI3 } from "openapi-typescript";
import { describe, expect, it, vi } from "vitest";
import { setupTest, testNitro } from "../tests";
import type test from "node:test";

describe("nitro:preset:nitro-dev", async () => {
  const ctx = await setupTest("nitro-dev", {
    config: {
      experimental: {
        tasks: true,
      },
    },
  });
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
      it("returns correct status for devProxy", async () => {
        const { status } = await callHandler({ url: "/proxy/example" });
        expect(status).toBe(200);
      });

      it("dev storage", async () => {
        const { data } = await callHandler({ url: "/api/storage/dev" });
        expect(data.keys.length).toBeGreaterThan(0);
        expect(data.keys).includes("src:public:favicon.ico");
      });

      describe("openAPI", () => {
        let spec: OpenAPI3;
        it("/_openapi.json", async () => {
          spec = ((await callHandler({ url: "/_openapi.json" })) as any).data;
          expect(spec.openapi).to.match(/^3\.\d+\.\d+$/);
          expect(spec.info.title).toBe("Nitro Test Fixture");
          expect(spec.info.description).toBe("Nitro Test Fixture API");
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

      describe("tasks", () => {
        it("should get the defined tasks", async () => {
          const res = await callHandler({ url: "/_nitro/tasks" });

          expect(res.data).toEqual({
            scheduledTasks: [
              {
                cron: "* * * * *",
                tasks: ["test"],
              },
            ],
            tasks: {
              "db:migrate": {
                description: "Run database migrations",
              },
              "db:seed": {},
              test: {
                description: "task to debug",
              },
              echo: {},
            },
          });
        });

        it("should run a scheduled task", async () => {
          const res = await callHandler({
            url: "/tasks/oneTimeTask",
          });

          // now extract current and after from the response
          const { current, after } = res.data;

          // convert the dates to Date objects
          const currentD = new Date(current);
          const afterD = new Date(after);

          // calculate the difference in seconds
          const diff = (afterD.getTime() - currentD.getTime()) / 1000;

          // expect the difference to be more than 1 seconds as croner runs on the next full second
          expect(diff).toBeGreaterThan(1);
        });
      });
    }
  );
});
