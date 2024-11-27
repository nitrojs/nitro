import type {
  ALBEvent,
  ALBResult,
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyResult,
  APIGatewayProxyResultV2,
  Context,
} from "aws-lambda";
import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitropack/runtime";
import {
  normalizeCookieHeader,
  normalizeLambdaIncomingHeaders,
  normalizeLambdaIncomingQuery,
  normalizeLambdaOutgoingBody,
  normalizeLambdaOutgoingHeaders,
} from "nitropack/runtime/internal";
import { withQuery } from "ufo";

const nitroApp = useNitroApp();

export async function handler(
  event: ALBEvent,
  context: Context
): Promise<ALBResult>;
export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult>;
export async function handler(
  event: APIGatewayProxyEventV2, // `LambdaFunctionURLEvent` is an alias of `APIGatewayProxyEventV2`
  context: Context
): Promise<APIGatewayProxyResultV2>; // `LambdaFunctionURLResult` is an alias of `APIGatewayProxyResultV2`
export async function handler(
  event: ALBEvent | APIGatewayProxyEvent | APIGatewayProxyEventV2,
  context: Context
): Promise<ALBResult | APIGatewayProxyResult | APIGatewayProxyResultV2> {
  const query = normalizeLambdaIncomingQuery(event);
  const url = withQuery(
    (event as ALBEvent | APIGatewayProxyEvent).path ||
      (event as APIGatewayProxyEventV2).rawPath,
    query
  );
  const method =
    (event as ALBEvent | APIGatewayProxyEvent).httpMethod ||
    (event as APIGatewayProxyEventV2).requestContext?.http?.method ||
    "get";

  if ("cookies" in event && event.cookies) {
    event.headers.cookie = event.cookies.join(";");
  }

  const r = await nitroApp.localCall({
    event,
    url,
    context,
    headers: normalizeLambdaIncomingHeaders(event) as Record<
      string,
      string | string[]
    >,
    method,
    query,
    body: event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64").toString("utf8")
      : event.body,
  });

  // ApiGateway v2 https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html#http-api-develop-integrations-lambda.v2
  const isApiGwV2 = "cookies" in event || "rawPath" in event;
  const awsBody = await normalizeLambdaOutgoingBody(r.body, r.headers);
  const cookies = normalizeCookieHeader(r.headers["set-cookie"]);
  return {
    ...(cookies.length > 0 && {
      ...(isApiGwV2
        ? { cookies }
        : { multiValueHeaders: { "set-cookie": cookies } }),
    }),
    statusCode: r.status,
    headers: normalizeLambdaOutgoingHeaders(r.headers, true),
    body: awsBody.body,
    isBase64Encoded: awsBody.type === "binary",
  };
}
