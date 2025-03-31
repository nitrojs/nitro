import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";
import { awsRequest, awsResponseHeaders } from "./_utils";

import type { StreamingResponse } from "@netlify/functions";
import type { Readable } from "node:stream";
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from "aws-lambda";

const nitroApp = useNitroApp();

export const handler = awslambda.streamifyResponse(
  async (event: APIGatewayProxyEventV2, responseStream, context) => {
    const request = awsRequest(event);

    const response = await nitroApp.fetch(request, {
      h3: { _platform: { aws: { event, context } } },
    });

    response.headers.set("transfer-encoding", "chunked");

    const httpResponseMetadata: Omit<StreamingResponse, "body"> = {
      statusCode: response.status,
      ...awsResponseHeaders(response),
    };

    if (response.body) {
      const writer = awslambda.HttpResponseStream.from(
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

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace awslambda {
    // https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html
    function streamifyResponse(
      handler: (
        event: APIGatewayProxyEventV2,
        responseStream: NodeJS.WritableStream,
        context: Context
      ) => Promise<void>
    ): any;

    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace HttpResponseStream {
      function from(
        stream: NodeJS.WritableStream,
        metadata: {
          statusCode: APIGatewayProxyStructuredResultV2["statusCode"];
          headers: APIGatewayProxyStructuredResultV2["headers"];
        }
      ): NodeJS.WritableStream;
    }
  }
}
