import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/runtime";
import { awsRequest, awsResponseHeaders, awsResponseBody } from "./_utils";

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
  APIGatewayProxyResult,
  APIGatewayProxyResultV2,
  Context,
} from "aws-lambda";

const nitroApp = useNitroApp();

export async function handler(
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2,
  context: Context
): Promise<APIGatewayProxyResult | APIGatewayProxyResultV2> {
  const request = awsRequest(event);

  const response = await nitroApp.fetch(request, undefined, {
    _platform: { aws: { context, event } },
  });

  return {
    statusCode: response.status,
    ...awsResponseHeaders(response),
    ...(await awsResponseBody(response)),
  };
}
