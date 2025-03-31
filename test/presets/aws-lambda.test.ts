import type { APIGatewayProxyEvent, APIGatewayProxyEventV2 } from "aws-lambda";
import destr from "destr";
import { resolve } from "pathe";
import { describe } from "vitest";
import { parseURL, parseQuery } from "ufo";
import { setupTest, testNitro } from "../tests";

describe("nitro:preset:aws-lambda-v2", async () => {
  const ctx = await setupTest("aws-lambda");
  testNitro(ctx, async () => {
    const { handler } = await import(resolve(ctx.outDir, "server/index.mjs"));
    return async ({ url, headers, method, body }) => {
      const { pathname, search } = parseURL(url);
      const event = {
        rawPath: pathname,
        headers: headers || {},
        rawQueryString: search.slice(1),
        queryStringParameters: parseQuery(search) as Record<string, string>,
        body: body || "",
        isBase64Encoded: false,
        version: "2",
        routeKey: "",
        requestContext: {
          accountId: "",
          apiId: "",
          domainName: "",
          domainPrefix: "",
          requestId: "",
          routeKey: "",
          stage: "",
          time: "",
          timeEpoch: 0,
          http: {
            path: url.pathname,
            protocol: "http",
            userAgent: "",
            sourceIp: "",
            method: method || "GET",
          },
        },
      } satisfies APIGatewayProxyEventV2;
      const res = await handler(event);
      return makeResponse(res);
    };
  });
});

describe("nitro:preset:aws-lambda-v1", async () => {
  const ctx = await setupTest("aws-lambda");
  testNitro({ ...ctx, lambdaV1: true }, async () => {
    const { handler } = await import(resolve(ctx.outDir, "server/index.mjs"));
    return async ({ url, headers, method, body }) => {
      const { pathname, search } = parseURL(url);
      const event = {
        stageVariables: {},
        resource: "",
        httpMethod: method || "GET",
        path: pathname,
        pathParameters: {},
        queryStringParameters: parseQuery(search) as Record<string, string>,
        multiValueQueryStringParameters: {},
        headers: headers || {},
        multiValueHeaders: {},
        body: body || "",
        isBase64Encoded: false,
        requestContext: {} as any,
      } satisfies APIGatewayProxyEvent;
      const res = await handler(event);
      return makeResponse(res);
    };
  });
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
