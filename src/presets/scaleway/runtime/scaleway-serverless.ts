import "#nitro/virtual/polyfills";
import { useNitroApp } from "nitro/app";
import { joinURL, withQuery } from "ufo";
import type { serveHandler } from "@scaleway/serverless-functions";

const nitroApp = useNitroApp();

type Event = Parameters<Parameters<typeof serveHandler>[0]>[0];
type Context = Parameters<Parameters<typeof serveHandler>[0]>[1];

export async function handler(event: Event, context: Context) {
  const headers = Object.fromEntries(
    Object.entries(event.headers!).map(([key, value]) => [key, String(value)])
  );

  const url = withQuery(
    joinURL(
      headers?.["X-Forwarded-Proto"] === "http" ? "http://" : "https://",
      headers.host,
      event.path
    ),
    event.queryStringParameters!
  );

  const request = new Request(url, {
    method: event.httpMethod,
    headers,
    body:
      event.httpMethod === "GET" || event.httpMethod === "HEAD"
        ? undefined
        : event.body,
  });
  return nitroApp.fetch(request);
}
