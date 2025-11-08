import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitro/app";
import { awsRequest, awsResponseHeaders, awsResponseBody } from "./_utils.ts";

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
  const request = awsRequest(event, context);

  const response = await nitroApp.fetch(request);

  return {
    statusCode: response.status,
    ...awsResponseHeaders(response),
    ...(await awsResponseBody(response)),
  };
}
