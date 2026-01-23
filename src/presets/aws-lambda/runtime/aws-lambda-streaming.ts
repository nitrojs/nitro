import "#nitro/virtual/polyfills";
import { useNitroApp } from "nitro/app";
import { awsRequest, awsResponseHeaders } from "./_utils.ts";

import type { StreamingResponse } from "@netlify/functions";
import type { Readable } from "node:stream";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

const nitroApp = useNitroApp();

export const handler = awslambda.streamifyResponse(
  async (event: APIGatewayProxyEventV2, responseStream, context) => {
    const request = awsRequest(event, context);

    const response = await nitroApp.fetch(request);

    response.headers.set("transfer-encoding", "chunked");

    const httpResponseMetadata: Omit<StreamingResponse, "body"> = {
      statusCode: response.status,
      ...awsResponseHeaders(response),
    };

    const body =
      response.body ??
      new ReadableStream<string>({
        start(controller) {
          controller.enqueue("");
          controller.close();
        },
      });

    const writer = awslambda.HttpResponseStream.from(responseStream, httpResponseMetadata);

    const reader = body.getReader();
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
