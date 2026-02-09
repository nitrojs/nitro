import "#nitro/virtual/polyfills";
import { useNitroApp } from "nitro/app";
import { joinURL, withQuery } from "ufo";
import type { serveHandler } from "@scaleway/serverless-functions";
import { Buffer } from "node:buffer";

const nitroApp = useNitroApp();

type Event = Parameters<Parameters<typeof serveHandler>[0]>[0];
type Context = Parameters<Parameters<typeof serveHandler>[0]>[1];

export async function handler(event: Event, context: Context) {
  const headers = new Headers(
    Object.fromEntries(
      Object.entries(event.headers!).map(([key, value]) => [key, String(value)])
    )
  );

  const url = withQuery(
    joinURL(
      headers.get("X-Forwarded-Proto") === "http" ? "http://" : "https://",
      headers.get("Host")!,
      event.path
    ),
    event.queryStringParameters ?? {}
  );

  const body = event.isBase64Encoded
    ? Buffer.from(event.body, "base64")
    : event.body;

  const request = new Request(url, {
    method: event.httpMethod,
    headers,
    body:
      event.httpMethod === "GET" || event.httpMethod === "HEAD"
        ? undefined
        : body,
  });
  return nitroApp.fetch(request);
}
