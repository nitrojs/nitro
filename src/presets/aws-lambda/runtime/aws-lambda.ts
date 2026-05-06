import "#nitro/virtual/polyfills";
import { useNitroApp } from "nitro/app";
import { invokeLambdaHandler, toLambdaHandler } from "srvx/aws-lambda";
import { tracingSrvxPlugins } from "#nitro/virtual/tracing";

const nitroApp = useNitroApp();

export const handler = toLambdaHandler({
  fetch: nitroApp.fetch,
  plugins: [...tracingSrvxPlugins],
});

export default {
  fetch: (request: Request) => invokeLambdaHandler(handler, request),
};
