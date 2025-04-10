import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";
import { awsRequest, awsResponseHeaders } from "./_utils";

import type { StreamingResponse } from "@netlify/functions";
import type { Readable } from "node:stream";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

const nitroApp = useNitroApp();

export const handler = awslambda.streamifyResponse(
  async (event: APIGatewayProxyEventV2, responseStream, context) => {
    const request = awsRequest(event);

    const response = await nitroApp.fetch(request, undefined, {
      _platform: { aws: { event, context } },
    });

    response.headers.set("transfer-encoding", "chunked");

    const httpResponseMetadata: Omit<StreamingResponse, "body"> = {
      statusCode: response.status,
      ...awsResponseHeaders(response),
    };

    if (response.body) {
      const writer = awslambda.HttpResponseStream.from(
        // @ts-expect-error TODO: IMPORTANT! It should be a Writable according to the aws-lambda types
        responseStream,
        httpResponseMetadata
      );
      const reader = response.body.getReader();
      await streamToNodeStream(reader, responseStream);
      writer.end();
    }
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
