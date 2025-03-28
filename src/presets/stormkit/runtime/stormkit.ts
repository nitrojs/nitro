import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";
import { normalizeLambdaOutgoingBody } from "../../aws-lambda/runtime/_utils";

import type { Handler } from "aws-lambda";

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

export const handler: Handler<StormkitEvent, StormkitResponse> =
  async function (event, context) {
    const response = await nitroApp.fetch(event.url, {
      h3: { _platform: { stormkit: { event, context } } },
      method: event.method || "GET",
      headers: event.headers,
      body: event.body,
    });

    const { body, isBase64Encoded } =
      await normalizeLambdaOutgoingBody(response);

    return <StormkitResponse>{
      statusCode: response.status,
      headers: normalizeOutgoingHeaders(response.headers),
      [isBase64Encoded ? "buffer" : "body"]: body,
    };
  };

function normalizeOutgoingHeaders(headers: Headers): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [
      k,
      Array.isArray(v) ? v.join(",") : String(v),
    ])
  );
}
