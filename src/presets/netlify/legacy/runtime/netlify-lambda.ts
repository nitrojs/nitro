import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitropack/runtime";
import {
  normalizeCookieHeader,
  normalizeLambdaIncomingHeaders,
  normalizeLambdaOutgoingBody,
  normalizeLambdaOutgoingHeaders,
} from "nitropack/runtime/internal";

import type {
  HandlerContext,
  HandlerEvent,
  HandlerResponse,
} from "@netlify/functions";
import { withQuery } from "ufo";

const nitroApp = useNitroApp();

// Netlify functions uses lambda v1 https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html#http-api-develop-integrations-lambda.v2
export async function lambda(
  event: HandlerEvent,
  context: HandlerContext
): Promise<HandlerResponse> {
  const query = {
    ...event.queryStringParameters,
    ...event.multiValueQueryStringParameters,
  };
  const url = withQuery(event.path, query);
  const method = event.httpMethod || "get";

  const r = await nitroApp.localCall({
    event,
    url,
    context,
    headers: normalizeLambdaIncomingHeaders(event.headers) as Record<
      string,
      string | string[]
    >,
    method,
    query,
    body: event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64")
      : event.body,
  });

  const cookies = normalizeCookieHeader(String(r.headers["set-cookie"]));
  const awsBody = await normalizeLambdaOutgoingBody(r.body, r.headers);

  return {
    statusCode: r.status,
    headers: normalizeLambdaOutgoingHeaders(r.headers, true),
    body: awsBody.body,
    isBase64Encoded: awsBody.type === "binary",
    ...(cookies.length > 0 && {
      multiValueHeaders: { "set-cookie": cookies },
    }),
  };
}
