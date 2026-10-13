import "#nitro/virtual/polyfills";
import { handleLambdaEventWithStream } from "srvx/aws-lambda";
import { useNitroApp } from "nitro/app";

const nitroApp = useNitroApp();

export const handler = awslambda.streamifyResponse((event, responseStream, context) =>
  handleLambdaEventWithStream(nitroApp.fetch, event, responseStream, context)
);
