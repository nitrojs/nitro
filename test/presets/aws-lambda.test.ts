import type {
  ALBEvent,
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
} from "aws-lambda";
import destr from "destr";
import { resolve } from "pathe";
import { describe, expect, it } from "vitest";
import {
  setupTest,
  testNitro,
  type Context,
  type TestHandlerResult,
} from "../tests";
import type { DeepPartial } from "../../src/types/_utils";

/**
 * Enumerates the types of HTTP Lambdas:
 *
 * - `alb-single`: Application Load Balancer without multi-value query/headers enabled.
 * - `alb-multi`: Application Load Balancer with multi-value query/headers enabled.
 * - `rest`: API Gateway REST API.
 * - `http-v2`: API Gateway HTTP API with v2.0 paylaod.
 *
 * Note: API Gateway HTTP API with v1.0 payload is omitted as it's the same as `rest` for practical purposes.
 */
type HttpLambdaType = "alb-single" | "alb-multi" | "rest" | "http-v2";

/**
 * Creates query string parameters with the format of an HTTP Lambda type.
 * @param params The URL query string parameters.
 * @param type The HTTP Lambda type.
 */
function createQueryStringParameters(
  params: URLSearchParams,
  type: HttpLambdaType
) {
  const queryStringParameters: Record<string, string | undefined> | undefined =
    type === "alb-multi" ? undefined : {};
  const multiValueQueryStringParameters:
    | Record<string, string[] | undefined>
    | undefined = type === "alb-single" ? undefined : {};

  const isAlb = type === "alb-single" || type === "alb-multi";
  for (const [rawKey, rawValue] of params) {
    // ALB does not decode query string params
    const key = isAlb ? encodeURIComponent(rawKey) : rawKey;
    const value = isAlb ? encodeURIComponent(rawValue) : rawValue;

    if (type === "alb-single" || type === "rest") {
      // last value wins
      queryStringParameters![key] = value;
    }

    if (type === "alb-multi" || type === "rest") {
      // array with all values
      if (multiValueQueryStringParameters![key]) {
        multiValueQueryStringParameters![key].push(value);
      } else {
        multiValueQueryStringParameters![key] = [value];
      }
    }

    if (type === "http-v2") {
      // comma-separated values
      if (queryStringParameters![key]) {
        queryStringParameters![key] += `,${value}`;
      } else {
        queryStringParameters![key] = value;
      }
    }
  }

  return { queryStringParameters, multiValueQueryStringParameters };
}

/**
 * Creates headers with the format of an HTTP Lambda type.
 * @param rawHeaders The raw HTTP headers.
 * @param type The HTTP Lambda type.
 */
function createHeaders(
  rawHeaders:
    | Record<string, string | (string | undefined)[] | undefined>
    | undefined,
  type: HttpLambdaType
) {
  const headers: Record<string, string | undefined> | undefined =
    type === "alb-multi" ? undefined : {};
  const multiValueHeaders: Record<string, string[] | undefined> | undefined =
    type === "alb-single" ? undefined : {};

  for (const [key, value] of Object.entries(rawHeaders ?? {})) {
    if (type === "alb-single" || type === "rest") {
      if (value === undefined) {
        if (type === "rest") {
          // ALB omits headers without values
          headers![key] = "";
        }
      } else {
        // last value wins
        headers![key] = typeof value === "string" ? value : value.at(-1);
      }
    }

    if (type === "alb-multi" || type === "rest") {
      if (value === undefined) {
        if (type === "rest") {
          // ALB omits headers without values
          multiValueHeaders![key] = [""];
        }
      } else {
        // array with all values, ALB omits headers without values
        multiValueHeaders![key] =
          typeof value === "string"
            ? [value]
            : value
                .filter((x) => x !== undefined || type === "rest")
                .map((x) => x ?? "");
      }
    }

    if (type === "http-v2") {
      // comma-separated values
      headers![key] =
        (typeof value === "string" ? value : value?.join(",")) ?? "";
    }
  }

  return { headers, multiValueHeaders };
}

describe("nitro:preset:aws-lambda", async () => {
  const additionalTests =
    (options: { type: HttpLambdaType }) =>
    (
      ctx: Context,
      callHandler: (options: any) => Promise<TestHandlerResult>
    ): void => {
      const { type } = options;

      describe("URL-encoded query params", () => {
        it("keeps query params intact", async () => {
          const actual = await callHandler({
            url: "/api/echo?Foo%2Fbar=Val%2Fue",
          });
          expect(actual).toMatchObject({
            data: {
              url: "/api/echo?Foo%2Fbar=Val%2Fue",
            },
          });
        });
      });

      describe("multi-value", () => {
        describe("headers", () => {
          it.skipIf(type !== "alb-single" && type !== "rest")(
            "keeps last value",
            async () => {
              const actual = await callHandler({
                url: "/api/echo",
                headers: { Foo: ["Bar", "Baz"] },
              });
              expect(actual).toMatchObject({
                data: {
                  url: "/api/echo",
                  headers: { foo: "Baz" },
                },
              });
            }
          );

          it.skipIf(type !== "http-v2")(
            "keeps comma-separated values (no spaces)",
            async () => {
              const actual = await callHandler({
                url: "/api/echo",
                headers: { Foo: ["Bar", "Baz"] },
              });
              expect(actual).toMatchObject({
                data: {
                  url: "/api/echo",
                  headers: { foo: "Bar,Baz" },
                },
              });
            }
          );

          it.skipIf(
            type === "alb-single" || type === "http-v2" || type === "rest"
          )("keeps comma-separated values", async () => {
            const actual = await callHandler({
              url: "/api/echo",
              headers: { Foo: ["Bar", "Baz"] },
            });
            expect(actual).toMatchObject({
              data: {
                url: "/api/echo",
                headers: { foo: "Bar, Baz" },
              },
            });
          });
        });

        describe("query string parameters", () => {
          it.skipIf(type !== "alb-single")("keeps last value", async () => {
            const actual = await callHandler({
              url: "/api/echo?Foo=Bar&Foo=Baz",
            });
            expect(actual).toMatchObject({
              data: {
                url: "/api/echo?Foo=Baz",
              },
            });
          });

          it.skipIf(type !== "http-v2")(
            "keeps comma-separated values",
            async () => {
              const actual = await callHandler({
                url: "/api/echo?Foo=Bar&Foo=Baz",
              });
              expect(actual).toMatchObject({
                data: {
                  url: "/api/echo?Foo=Bar,Baz",
                },
              });
            }
          );

          it.skipIf(type === "alb-single" || type === "http-v2")(
            "keeps comma-separated values",
            async () => {
              const actual = await callHandler({
                url: "/api/echo?Foo=Bar&Foo=Baz",
              });
              expect(actual).toMatchObject({
                data: {
                  url: "/api/echo?Foo=Bar&Foo=Baz",
                },
              });
            }
          );
        });
      });

      describe("missing values", () => {
        describe("headers", () => {
          describe("single-value", () => {
            it("omits header", async () => {
              const actual = await callHandler({
                url: "/api/echo",
                headers: { foo: undefined },
              });
              expect(actual).not.toHaveProperty("data.headers.foo");
            });
          });

          describe("multi-value", () => {
            it.skipIf(type !== "http-v2")("keeps empty value", async () => {
              const actual = await callHandler({
                url: "/api/echo",
                headers: { foo: ["1", undefined, "2", "3"] },
              });
              expect(actual).toMatchObject({
                data: {
                  url: "/api/echo",
                  headers: {
                    foo: "1,,2,3",
                  },
                },
              });
            });

            it.skipIf(
              type === "alb-single" || type === "http-v2" || type === "rest"
            )("omits header", async () => {
              const actual = await callHandler({
                url: "/api/echo",
                headers: { foo: ["1", undefined, "2", "3"] },
              });
              expect(actual).toMatchObject({
                data: {
                  url: "/api/echo",
                  headers: {
                    foo: "1, 2, 3",
                  },
                },
              });
            });
          });
        });

        describe("query string parameters", () => {
          describe("single-value", () => {
            it("keeps parameter", async () => {
              const actual = await callHandler({
                url: "/api/echo?foo",
              });
              expect(actual).toMatchObject({
                data: {
                  url: expect.stringMatching(/^\/api\/echo\?foo=?$/),
                },
              });
            });
          });

          describe("multi-value", () => {
            it.skipIf(type !== "http-v2")("keeps empty parameter", async () => {
              const actual = await callHandler({
                url: "/api/echo?foo=1&foo&foo=2&foo=3",
              });
              expect(actual).toMatchObject({
                data: {
                  url: "/api/echo?foo=1,,2,3",
                },
              });
            });

            it.skipIf(type === "alb-single" || type === "http-v2")(
              "keeps empty parameter",
              async () => {
                const actual = await callHandler({
                  url: "/api/echo?foo=1&foo&foo=2&foo=3",
                });
                expect(actual).toMatchObject({
                  data: {
                    url: "/api/echo?foo=1&foo=&foo=2&foo=3",
                  },
                });
              }
            );
          });
        });
      });
    };

  const ctx = await setupTest("aws-lambda");

  // ALB paylod (single-value query/headers)
  const albSingle = "alb-single";
  testNitro(
    ctx,
    async () => {
      const { handler } = await import(resolve(ctx.outDir, "server/index.mjs"));
      return async ({
        url: rawRelativeUrl,
        headers: rawHeaders,
        method,
        body,
      }) => {
        // creating new URL object to parse query easier
        const url = new URL(`https://example.com${rawRelativeUrl}`);
        const { queryStringParameters } = createQueryStringParameters(
          url.searchParams,
          albSingle
        );
        const { headers } = createHeaders(rawHeaders, albSingle);
        const event: Partial<ALBEvent> = {
          httpMethod: method || "GET",
          path: url.pathname,
          queryStringParameters,
          headers,
          body: body || "",
          requestContext: { elb: { targetGroupArn: "some-target" } },
        };
        const res = await handler(event);
        return makeResponse(res);
      };
    },
    additionalTests({ type: albSingle })
  );

  // ALB paylod (multi-value query/headers)
  const albMulti = "alb-multi";
  testNitro(
    ctx,
    async () => {
      const { handler } = await import(resolve(ctx.outDir, "server/index.mjs"));
      return async ({
        url: rawRelativeUrl,
        headers: rawHeaders,
        method,
        body,
      }) => {
        // creating new URL object to parse query easier
        const url = new URL(`https://example.com${rawRelativeUrl}`);
        const { multiValueQueryStringParameters } = createQueryStringParameters(
          url.searchParams,
          albMulti
        );
        const { multiValueHeaders } = createHeaders(rawHeaders, albMulti);
        const event: Partial<ALBEvent> = {
          httpMethod: method || "GET",
          path: url.pathname,
          multiValueQueryStringParameters,
          multiValueHeaders,
          body: body || "",
          requestContext: { elb: { targetGroupArn: "some-target" } },
        };
        const res = await handler(event);
        return makeResponse(res);
      };
    },
    additionalTests({ type: albMulti })
  );

  // Lambda v1 paylod
  const rest = "rest";
  testNitro(
    ctx,
    async () => {
      const { handler } = await import(resolve(ctx.outDir, "server/index.mjs"));
      return async ({
        url: rawRelativeUrl,
        headers: rawHeaders,
        method,
        body,
      }) => {
        // creating new URL object to parse query easier
        const url = new URL(`https://example.com${rawRelativeUrl}`);
        const { queryStringParameters, multiValueQueryStringParameters } =
          createQueryStringParameters(url.searchParams, rest);
        const { headers, multiValueHeaders } = createHeaders(rawHeaders, rest);
        const event: DeepPartial<APIGatewayProxyEvent> = {
          httpMethod: method || "GET",
          path: url.pathname,
          resource: "/my/path",
          queryStringParameters,
          multiValueQueryStringParameters,
          headers,
          multiValueHeaders,
          body: body || "",
          requestContext: {},
        };
        const res = await handler(event);
        return makeResponse(res);
      };
    },
    additionalTests({ type: rest })
  );

  // Lambda v2 paylod
  const httpV2 = "http-v2";
  testNitro(
    ctx,
    async () => {
      const { handler } = await import(resolve(ctx.outDir, "server/index.mjs"));
      return async ({
        url: rawRelativeUrl,
        headers: rawHeaders,
        method,
        body,
      }) => {
        // creating new URL object to parse query easier
        const url = new URL(`https://example.com${rawRelativeUrl}`);
        const { queryStringParameters } = createQueryStringParameters(
          url.searchParams,
          httpV2
        );
        const { headers } = createHeaders(rawHeaders, httpV2);
        const event: Partial<APIGatewayProxyEventV2> = {
          rawPath: url.pathname,
          queryStringParameters,
          headers,
          body: body || "",
          requestContext: {
            ...Object.fromEntries([
              ["accountId"],
              ["apiId"],
              ["domainName"],
              ["domainPrefix"],
            ]),
            http: {
              path: url.pathname,
              protocol: "http",
              ...Object.fromEntries([["userAgent"], ["sourceIp"]]),
              method: method || "GET",
            },
          },
        };
        const res = await handler(event);
        return makeResponse(res);
      };
    },
    additionalTests({ type: httpV2 })
  );
});

const makeResponse = (response: any) => {
  const headers = response.headers;

  // APIgw v2 uses cookies, v1 uses multiValueHeaders
  headers["set-cookie"] =
    response?.cookies ?? response?.multiValueHeaders?.["set-cookie"];

  return {
    data: destr(response.body),
    status: response.statusCode,
    headers,
  };
};
