import { promises as fsp } from "node:fs";
import { resolve } from "pathe";
import destr from "destr";
import { describe, it, expect } from "vitest";
import { Handler, APIGatewayEvent } from "aws-lambda";
import { getPresetTmpDir, setupTest, testNitro } from "../tests";

describe("nitro:preset:netlify", async () => {
  const ctx = await setupTest("netlify", {
    config: {
      output: {
        publicDir: resolve(getPresetTmpDir("netlify"), "dist"),
      },
    },
  });
  testNitro(
    ctx,
    async () => {
      const { handler } = (await import(
        resolve(ctx.outDir, "server/server.mjs")
      )) as { handler: Handler };
      return async ({ url: rawRelativeUrl, headers, method, body }) => {
        // creating new URL object to parse query easier
        const url = new URL(`https://example.com${rawRelativeUrl}`);
        const queryStringParameters = Object.fromEntries(
          url.searchParams.entries()
        );
        const event: Partial<APIGatewayEvent> = {
          resource: "/my/path",
          path: url.pathname,
          headers: headers || {},
          httpMethod: method || "GET",
          queryStringParameters,
          body: body || "",
        };
        const res = await handler(event, {} as any, () => {});
        const resHeaders = { ...res.headers, ...res.multiValueHeaders };
        return {
          data: destr(res.body),
          status: res.statusCode,
          headers: resHeaders,
        };
      };
    },
    () => {
      it("should add route rules - redirects", async () => {
        const redirects = await fsp.readFile(
          resolve(ctx.outDir, "../dist/_redirects"),
          "utf8"
        );
        /* eslint-disable no-tabs */
        expect(redirects).toMatchInlineSnapshot(`
        "/rules/nested/override	/other	302
        /rules/redirect/obj	https://nitro.unjs.io/	301
        /rules/nested/*	/base	302
        /rules/redirect	/base	302
        /*	/.netlify/functions/server 200"
      `);
        /* eslint-enable no-tabs */
      });
      it("should add route rules - headers", async () => {
        const headers = await fsp.readFile(
          resolve(ctx.outDir, "../dist/_headers"),
          "utf8"
        );
        /* eslint-disable no-tabs */
        expect(headers).toMatchInlineSnapshot(`
"/rules/headers
  cache-control: s-maxage=60
/rules/cors
  access-control-allow-origin: *
  access-control-allow-methods: GET
  access-control-allow-headers: *
  access-control-max-age: 0
/rules/nested/*
  x-test: test
/build/*
  cache-control: public, max-age=3600, immutable
"`);
        /* eslint-enable no-tabs */
      });
    }
  );
});
