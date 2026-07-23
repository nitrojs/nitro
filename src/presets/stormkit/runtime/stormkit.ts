import "#nitro/virtual/polyfills";
import { useNitroApp } from "nitro/app";

import type { Handler } from "aws-lambda";
import type { ServerRequest } from "srvx";

type StormkitEvent = {
  url: string; // e.g. /my/path, /my/path?with=query
  path: string;
  method: string;
  body?: string;
  query?: Record<string, Array<string>>;
  headers?: Record<string, string>;
  rawHeaders?: Array<string>;
};

type StormkitResponse = {
  headers?: Record<string, string>;
  body?: string;
  buffer?: string;
  statusCode: number;
  errorMessage?: string;
  errorStack?: string;
};

const nitroApp = useNitroApp();

export const handler: Handler<StormkitEvent, StormkitResponse> = async function (event, context) {
  const req = new Request(event.url, {
    method: event.method || "GET",
    headers: event.headers,
    body: event.body,
  }) as ServerRequest;

  // srvx compatibility
  req.runtime ??= { name: "stormkit" };
  req.runtime.stormkit ??= { event, context } as any;

  const response = await nitroApp.fetch(req);

  const { body, isBase64Encoded } = await encodeResponseBody(response);

  return {
    statusCode: response.status,
    headers: normalizeOutgoingHeaders(response.headers),
    [isBase64Encoded ? "buffer" : "body"]: body,
  } satisfies StormkitResponse;
};

function normalizeOutgoingHeaders(headers: Headers): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : String(v)])
  );
}

async function encodeResponseBody(
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
