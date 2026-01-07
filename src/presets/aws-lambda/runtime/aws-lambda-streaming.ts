import type { Readable } from "node:stream";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitropack/runtime";
import {
  normalizeCookieHeader,
  normalizeLambdaIncomingHeaders,
  normalizeLambdaOutgoingHeaders,
} from "nitropack/runtime/internal";
import { withQuery } from "ufo";
import type { StreamingResponse } from "@netlify/functions";

const nitroApp = useNitroApp();

export const handler = awslambda.streamifyResponse(
  async (event: APIGatewayProxyEventV2, responseStream, context) => {
    const query = {
      ...event.queryStringParameters,
    };
    const url = withQuery(event.rawPath, query);
    const method = event.requestContext?.http?.method || "get";

    if ("cookies" in event && event.cookies) {
      event.headers.cookie = event.cookies.join(";");
    }

    const r = await nitroApp.localCall({
      event,
      url,
      context,
      headers: normalizeLambdaIncomingHeaders(event.headers) as Record<
        string,
        string | string[]
      >,
      method,
      query,
      body: event.isBase64Encoded
        ? Buffer.from(event.body || "", "base64").toString("utf8")
        : event.body,
    });

    const isApiGwV2 = "cookies" in event || "rawPath" in event;
    const cookies = normalizeCookieHeader(r.headers["set-cookie"]);
    const httpResponseMetadata: Omit<StreamingResponse, "body"> = {
      statusCode: r.status,
      ...(cookies.length > 0 && {
        ...(isApiGwV2
          ? { cookies }
          : { multiValueHeaders: { "set-cookie": cookies } }),
      }),
      headers: {
        ...normalizeLambdaOutgoingHeaders(r.headers, true),
        "Transfer-Encoding": "chunked",
      },
    };
    const body =
      r.body ??
      new ReadableStream({
        start(controller) {
          controller.enqueue("");
          controller.close();
        },
      });
    const writer = awslambda.HttpResponseStream.from(
      // @ts-ignore TODO: IMPORTANT! It should be a Writable according to the aws-lambda types
      responseStream,
      httpResponseMetadata
    );
    if (!(body as ReadableStream).getReader) {
      writer.write(r.body as any /* TODO */);
      writer.end();
      return;
    }
    const reader = (body as ReadableStream).getReader();
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
