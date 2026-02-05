import "#nitro/virtual/polyfills";
import { useNitroApp } from "nitro/app";
import { awsResponseBody } from "../../aws-lambda/runtime/_utils.ts";

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

  const { body, isBase64Encoded } = await awsResponseBody(response);

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
