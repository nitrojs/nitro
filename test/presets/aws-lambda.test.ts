import type { APIGatewayProxyEvent, APIGatewayProxyEventV2 } from "aws-lambda";
import { resolve } from "pathe";
import { describe } from "vitest";
import { parseURL, parseQuery } from "ufo";
import { setupTest, testNitro } from "../tests.ts";

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
      return webResponse(res);
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
      return webResponse(res);
    };
  });
});

function webResponse(awsResponse: any) {
  const headers = new Headers(awsResponse.headers);
  const setCookie =
    awsResponse?.cookies /* v2 */ ?? awsResponse?.multiValueHeaders /* v1 */?.["set-cookie"] ?? [];
  headers.delete("set-cookie");
  for (const cookie of setCookie) {
    if (Array.isArray(cookie)) {
      for (const c of cookie) {
        headers.append("set-cookie", c);
      }
    } else {
      headers.append("set-cookie", cookie);
    }
  }

  const body = awsResponse.isBase64Encoded
    ? Buffer.from(awsResponse.body, "base64")
    : (awsResponse.body as string);

  return new Response(body, {
    status: awsResponse.statusCode,
    headers,
  });
}
