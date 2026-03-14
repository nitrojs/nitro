import type { APIGatewayProxyEvent, APIGatewayProxyEventV2 } from "aws-lambda";
import type { ServerRequest } from "srvx";
import { stringifyQuery } from "ufo";

// Incoming (AWS => Web)

export function awsRequest(
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
  context: unknown
): ServerRequest {
  const method = awsEventMethod(event);
  const url = awsEventURL(event);
  const headers = awsEventHeaders(event);
  const body = awsEventBody(event);

  const req = new Request(url, { method, headers, body }) as ServerRequest;

  // srvx compatibility
  req.runtime ??= { name: "aws-lambda" };
  // @ts-expect-error (add to srvx types)
  req.runtime.aws ??= { event, context } as any;

  return new Request(url, { method, headers, body });
}

function awsEventMethod(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): string {
  return (
    (event as APIGatewayProxyEvent).httpMethod ||
    (event as APIGatewayProxyEventV2).requestContext?.http?.method ||
    "GET"
  );
}

function awsEventURL(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): URL {
  const hostname =
    event.headers.host || event.headers.Host || event.requestContext?.domainName || ".";

  const path = (event as APIGatewayProxyEvent).path || (event as APIGatewayProxyEventV2).rawPath;

  const query = awsEventQuery(event);

  const protocol =
    (event.headers["X-Forwarded-Proto"] || event.headers["x-forwarded-proto"]) === "http"
      ? "http"
      : "https";

  return new URL(`${path}${query ? `?${query}` : ""}`, `${protocol}://${hostname}`);
}

function awsEventQuery(event: APIGatewayProxyEvent | APIGatewayProxyEventV2) {
  if (typeof (event as APIGatewayProxyEventV2).rawQueryString === "string") {
    return (event as APIGatewayProxyEventV2).rawQueryString;
  }
  const queryObj = {
    ...event.queryStringParameters,
    ...(event as APIGatewayProxyEvent).multiValueQueryStringParameters,
  };
  return stringifyQuery(queryObj);
}

function awsEventHeaders(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): Headers {
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
  return headers;
}

function awsEventBody(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): BodyInit | undefined {
  if (!event.body) {
    return undefined;
  }
  if (event.isBase64Encoded) {
    return Buffer.from(event.body || "", "base64");
  }
  return event.body;
}

// Outgoing (Web => AWS)

export function awsResponseHeaders(response: Response) {
  const headers: Record<string, string> = Object.create(null);
  for (const [key, value] of response.headers) {
    if (value) {
      headers[key] = Array.isArray(value) ? value.join(",") : String(value);
    }
  }

  const cookies = response.headers.getSetCookie();

  return cookies.length > 0
    ? {
        headers,
        cookies, // ApiGateway v2
        multiValueHeaders: { "set-cookie": cookies }, // ApiGateway v1
      }
    : { headers };
}

// AWS Lambda proxy integrations requires base64 encoded buffers
// binaryMediaTypes should be */*
// see https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-payload-encodings.html
export async function awsResponseBody(
  response: Response
): Promise<{ body: string; isBase64Encoded?: boolean }> {
  if (!response.body) {
    return { body: "" };
  }
  const buffer = await toBuffer(response.body as any);
  const contentType = response.headers.get("content-type") || "";
  return isTextType(contentType)
    ? { body: buffer.toString("utf8") }
    : { body: buffer.toString("base64"), isBase64Encoded: true };
}

function isTextType(contentType = "") {
  return /^text\/|\/(javascript|json|xml)|utf-?8/i.test(contentType);
}

function toBuffer(data: ReadableStream): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    data
      .pipeTo(
        new WritableStream({
          write(chunk) {
            chunks.push(chunk);
          },
          close() {
            resolve(Buffer.concat(chunks));
          },
          abort(reason) {
            reject(reason);
          },
        })
      )
      .catch(reject);
  });
}
