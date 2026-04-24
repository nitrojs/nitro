import "#nitro-internal-pollyfills";

import { lambda } from "./netlify-lambda";

export const handler = wrapHandler(lambda);

// ------

// Copyright (c) 2020 Netlify <team@netlify.com>
// Licensed under the MIT License (MIT)
// https://github.com/netlify/primitives/blob/2e028b9cbdc88a61da1641ec9bf30704e2b36220/packages/functions/src/lib/builder.ts

const BUILDER_FUNCTIONS_FLAG = true;
const HTTP_STATUS_METHOD_NOT_ALLOWED = 405;
const METADATA_VERSION = 1;

const augmentResponse = (response: any) => {
  if (!response) {
    return response;
  }
  const metadata = {
    version: METADATA_VERSION,
    builder_function: BUILDER_FUNCTIONS_FLAG,
    ttl: response.ttl || 0,
  };

  return {
    ...response,
    metadata,
  };
};

function wrapHandler(handler: any) {
  return (event: any, context: any, callback?: any) => {
    if (event.httpMethod !== "GET" && event.httpMethod !== "HEAD") {
      return Promise.resolve({
        body: "Method Not Allowed",
        statusCode: HTTP_STATUS_METHOD_NOT_ALLOWED,
      });
    }

    const modifiedEvent = {
      ...event,
      multiValueQueryStringParameters: {},
      queryStringParameters: {},
    };

    const wrappedCallback = (error: unknown, response: any) =>
      callback ? callback(error, augmentResponse(response)) : null;
    const execution = handler(modifiedEvent, context, wrappedCallback);

    if (typeof execution === "object" && typeof execution.then === "function") {
      return execution.then(augmentResponse);
    }

    return execution;
  };
}
