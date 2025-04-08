import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";
import { normalizeLambdaOutgoingBody } from "nitro/runtime/internal";

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
    const response = await nitroApp.localCall({
      event,
      url: event.url,
      context,
      headers: event.headers,
      method: event.method || "GET",
      query: event.query,
      body: event.body,
    });

    const awsBody = await normalizeLambdaOutgoingBody(
      response.body,
      response.headers
    );

    return <StormkitResponse>{
      statusCode: response.status,
      headers: normalizeOutgoingHeaders(response.headers),
      [awsBody.type === "text" ? "body" : "buffer"]: awsBody.body,
    };
  };

function normalizeOutgoingHeaders(
  headers: Record<string, number | string | string[] | undefined>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [
      k,
      Array.isArray(v) ? v.join(",") : String(v),
    ])
  );
}
