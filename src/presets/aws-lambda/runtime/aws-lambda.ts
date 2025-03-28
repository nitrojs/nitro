import "#nitro-internal-pollyfills";
import { withQuery } from "ufo";
import { useNitroApp } from "nitro/runtime";
import {
  normalizeLambdaOutgoingBody,
  normalizeLambdaOutgoingHeaders,
} from "./_utils";

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyResult,
  APIGatewayProxyResultV2,
  Context,
} from "aws-lambda";

const nitroApp = useNitroApp();

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult>;
export async function handler(
  event: APIGatewayProxyEventV2,
  context: Context
): Promise<APIGatewayProxyResultV2>;
export async function handler(
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
  context: Context
): Promise<APIGatewayProxyResult | APIGatewayProxyResultV2> {
  const query = {
    ...event.queryStringParameters,
    ...(event as APIGatewayProxyEvent).multiValueQueryStringParameters,
  };

  const url = withQuery(
    (event as APIGatewayProxyEvent).path ||
      (event as APIGatewayProxyEventV2).rawPath,
    query
  );

  const method =
    (event as APIGatewayProxyEvent).httpMethod ||
    (event as APIGatewayProxyEventV2).requestContext?.http?.method ||
    "get";

  const headers = new Headers();
  for (const [key, value] of Object.entries(event.headers)) {
    if (value) {
      headers.set(key, value);
    }
  }
  if ("cookies" in event && event.cookies) {
    for (const cookie of event.cookies) {
      headers.append("cookie", cookie);
    }
  }

  const response = await nitroApp.fetch(url, {
    h3: {
      context,
      event,
    },
    method,
    headers,
    body: event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64").toString("utf8")
      : event.body,
  });

  // ApiGateway v2 https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html#http-api-develop-integrations-lambda.v2
  const isApiGwV2 = "cookies" in event || "rawPath" in event;
  const { body, isBase64Encoded } = await normalizeLambdaOutgoingBody(response);
  const cookies = response.headers.getSetCookie();
  return {
    ...(cookies.length > 0 && {
      ...(isApiGwV2
        ? { cookies }
        : { multiValueHeaders: { "set-cookie": cookies } }),
    }),
    statusCode: response.status,
    headers: normalizeLambdaOutgoingHeaders(response.headers, true),
    body: body,
    isBase64Encoded,
  };
}
