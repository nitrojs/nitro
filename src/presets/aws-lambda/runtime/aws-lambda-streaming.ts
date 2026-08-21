import "#nitro/virtual/polyfills";
import { useNitroApp } from "nitro/app";
import { awsRequest, awsResponseHeaders } from "./_utils.ts";
import { planAwsLambdaStreamingEmit } from "./streaming-body.ts";

import type { StreamingResponse } from "@netlify/functions";
import type { Readable } from "node:stream";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

const nitroApp = useNitroApp();

export const handler = awslambda.streamifyResponse(
  async (event: APIGatewayProxyEventV2, responseStream, context) => {
    const request = awsRequest(event, context);

    const response = await nitroApp.fetch(request);

    const httpResponseMetadata: Omit<StreamingResponse, "body"> = {
      statusCode: response.status,
      ...awsResponseHeaders(response),
    };

    const plan = planAwsLambdaStreamingEmit(response);

    // Bodyless responses (redirects, 204/304, empty handlers): write the
    // status+headers prelude and end immediately. Forcing chunked TE and
    // enqueueing a zero-length chunk hangs the stream behind CloudFront
    // (~Lambda timeout) even though the handler itself finishes quickly.
    if (plan.kind === "bodyless") {
      if (
        !httpResponseMetadata.headers!["content-length"] &&
        !httpResponseMetadata.headers!["Content-Length"]
      ) {
        httpResponseMetadata.headers!["content-length"] = plan.contentLength;
      }
      const writer = awslambda.HttpResponseStream.from(
        responseStream,
        httpResponseMetadata
      );
      writer.end();
      return;
    }

    if (plan.transferEncoding) {
      if (!httpResponseMetadata.headers!["transfer-encoding"]) {
        httpResponseMetadata.headers!["transfer-encoding"] = plan.transferEncoding;
      }
    }

    const writer = awslambda.HttpResponseStream.from(responseStream, httpResponseMetadata);

    const reader = response.body!.getReader();
    await streamToNodeStream(reader, responseStream);
    writer.end();
  }
);

async function streamToNodeStream(
  reader: Readable | ReadableStreamDefaultReader,
  writer: NodeJS.WritableStream
) {
  let readResult = await reader.read();
  while (!readResult.done) {
    writer.write(readResult.value);
    readResult = await reader.read();
  }
  writer.end();
}
