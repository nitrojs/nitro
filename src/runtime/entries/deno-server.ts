import "#internal/nitro/virtual/polyfill";
import destr from "destr";
import { nitroApp } from "../app";
import { useRuntimeConfig } from "#internal/nitro";

// @ts-expect-error unknown global Deno
if (Deno.env.get("DEBUG")) {
  addEventListener("unhandledrejection", (event) =>
    console.error("[nitro] [dev] [unhandledRejection]", event.reason)
  );
  addEventListener("error", (event) =>
    console.error("[nitro] [dev] [uncaughtException]", event.error)
  );
} else {
  addEventListener("unhandledrejection", (err) =>
    console.error("[nitro] [production] [unhandledRejection] " + err)
  );
  addEventListener("error", (event) =>
    console.error("[nitro] [production] [uncaughtException] " + event.error)
  );
}

// @ts-expect-error unknown global Deno
// https://deno.land/api@v1.34.3?s=Deno.serve&unstable=
Deno.serve(
  {
    // @ts-expect-error unknown global Deno
    key: Deno.env.get("NITRO_SSL_KEY"),
    // @ts-expect-error unknown global Deno
    cert: Deno.env.get("NITRO_SSL_CERT"),
    // @ts-expect-error unknown global Deno
    port: destr(Deno.env.get("NITRO_PORT") || Deno.env.get("PORT")) || 3000,
    // @ts-expect-error unknown global Deno
    hostname: Deno.env.get("NITRO_HOST") || Deno.env.get("HOST"),
    onListen: (opts) => {
      const baseURL = (useRuntimeConfig().app.baseURL || "").replace(/\/$/, "");
      const url = `${opts.hostname}:${opts.port}${baseURL}`;
      console.log(`Listening ${url}`);
    },
  },
  handler
);

async function handler(request: Request) {
  const url = new URL(request.url);

  // https://deno.land/api?s=Body
  let body;
  if (request.body) {
    body = await request.arrayBuffer();
  }

  return nitroApp.localFetch(url.pathname + url.search, {
    host: url.hostname,
    protocol: url.protocol,
    headers: request.headers,
    method: request.method,
    redirect: request.redirect,
    body,
  });
}

export default {};
