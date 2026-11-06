import "#nitro/virtual/polyfills";
import { FastURL, serve } from "srvx/node";

import { useNitroApp } from "nitro/app";
import { trapUnhandledErrors } from "#nitro/runtime/error/hooks";
import { resolveServeOptions } from "#nitro/runtime/serve";
import { setupCloseHooks } from "#nitro/runtime/shutdown";

const endpoint = process.env.AWS_LAMBDA_HTTP_ENDPOINT;
// Lambda provides a bare `host:port`; add a synthetic scheme for FastURL parsing.
// https://docs.aws.amazon.com/lambda/latest/dg/web-functions-revisions-env-vars.html
let endpointURL: URL | undefined;

if (endpoint !== undefined) {
  try {
    endpointURL = new FastURL(`tcp://${endpoint}`);
  } catch {
    throw new Error(`Invalid AWS_LAMBDA_HTTP_ENDPOINT: ${endpoint}`);
  }
}

if (
  endpointURL &&
  (!endpointURL.hostname ||
    !endpointURL.port ||
    Number(endpointURL.port) < 1 ||
    endpointURL.pathname ||
    endpointURL.search ||
    endpointURL.hash ||
    endpointURL.username ||
    endpointURL.password)
) {
  throw new Error(`Invalid AWS_LAMBDA_HTTP_ENDPOINT: ${endpoint}`);
}

const nitroApp = useNitroApp();

const server = serve(
  resolveServeOptions({
    fetch: nitroApp.fetch,
    ...(endpointURL
      ? {
          hostname: endpointURL.hostname,
          port: Number(endpointURL.port),
          protocol: "http",
          tls: undefined,
        }
      : {}),
  })
);

setupCloseHooks(server);

trapUnhandledErrors();

export default {};
