import "#nitro/virtual/polyfills";
import { useNitroApp } from "nitro/app";
import {
  handleLambdaEventWithStream,
  invokeLambdaHandler,
  toLambdaHandler,
  type AWSLambdaHandler,
  type AWSLambdaResponseStream,
  type AWSLambdaStreamingHandler,
  type AwsLambdaEvent,
} from "srvx/aws-lambda";
import { tracingSrvxPlugins } from "#nitro/virtual/tracing";

import type { Context } from "aws-lambda";

const nitroApp = useNitroApp();

const lambdaHandler = toLambdaHandler({
  fetch: nitroApp.fetch,
  plugins: [...tracingSrvxPlugins],
});

const handlerWithPreviewFallback = ((
  event: AwsLambdaEvent,
  responseStreamOrContext: AWSLambdaResponseStream | Context,
  context?: Context
) => {
  if (context) {
    return handleLambdaEventWithStream(
      nitroApp.fetch,
      event,
      responseStreamOrContext as AWSLambdaResponseStream,
      context
    );
  }

  return lambdaHandler(event, responseStreamOrContext as Context);
}) as AWSLambdaStreamingHandler & AWSLambdaHandler;

const awsLambdaGlobal = globalThis as typeof globalThis & {
  awslambda?: {
    streamifyResponse: (handler: AWSLambdaStreamingHandler) => AWSLambdaStreamingHandler;
  };
};

export const handler = awsLambdaGlobal.awslambda?.streamifyResponse
  ? awsLambdaGlobal.awslambda.streamifyResponse(handlerWithPreviewFallback)
  : handlerWithPreviewFallback;

export default {
  fetch: (request: Request) => invokeLambdaHandler(lambdaHandler, request),
};
