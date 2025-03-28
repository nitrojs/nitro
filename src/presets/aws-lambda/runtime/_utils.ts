import type { APIGatewayProxyEventHeaders } from "aws-lambda";

export function normalizeLambdaIncomingHeaders(
  awsHeaders?: APIGatewayProxyEventHeaders
): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(awsHeaders || {})) {
    if (value) {
      headers.set(key, value);
    }
  }
  return headers;
}

export function normalizeLambdaOutgoingHeaders(
  headers: Headers,
  stripCookies = false
) {
  const entries = stripCookies
    ? Object.entries(headers).filter(([key]) => !["set-cookie"].includes(key))
    : Object.entries(headers);

  return Object.fromEntries(
    entries.map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : String(v)])
  );
}

// AWS Lambda proxy integrations requires base64 encoded buffers
// binaryMediaTypes should be */*
// see https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-payload-encodings.html
export async function normalizeLambdaOutgoingBody(
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

export function toBuffer(data: ReadableStream): Promise<Buffer> {
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

// -- Internal --

const TEXT_TYPE_RE = /^text\/|\/(javascript|json|xml)|utf-?8/;

function isTextType(contentType = "") {
  return TEXT_TYPE_RE.test(contentType);
}
