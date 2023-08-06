import "#internal/nitro/virtual/polyfill";
import type {
  HandlerResponse,
  HandlerContext,
  HandlerEvent,
} from "@netlify/functions";
import { withQuery } from "ufo";
import { nitroApp } from "../app";
import {
  normalizeLambdaIncomingHeaders,
  normalizeLambdaOutgoingBody,
  normalizeLambdaOutgoingHeaders,
} from "../utils.lambda";
import { normalizeCookieHeader } from "../utils";

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
    headers: normalizeLambdaIncomingHeaders(event.headers),
    method,
    query,
    body: event.body, // TODO: handle event.isBase64Encoded
  });

  const cookies = normalizeCookieHeader(String(r.headers["set-cookie"]));

  return {
    statusCode: r.status,
    headers: normalizeLambdaOutgoingHeaders(r.headers, true),
    body: normalizeLambdaOutgoingBody(r.body, r.headers),
    multiValueHeaders: {
      ...(cookies.length > 0 ? { "set-cookie": cookies } : {}),
    },
  };
}
