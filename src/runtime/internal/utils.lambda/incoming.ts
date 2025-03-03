import type {
  ALBEvent,
  ALBEventMultiValueQueryStringParameters,
  ALBEventQueryStringParameters,
  APIGatewayProxyEvent,
  APIGatewayProxyEventHeaders,
  APIGatewayProxyEventMultiValueHeaders,
  APIGatewayProxyEventV2,
} from "aws-lambda";
import { decode } from "ufo";

export function normalizeLambdaIncomingHeaders(
  headers?:
    | ALBEventQueryStringParameters
    | ALBEventMultiValueQueryStringParameters
    | APIGatewayProxyEventHeaders
    | APIGatewayProxyEventMultiValueHeaders
): Record<string, string | string[] | undefined>;
export function normalizeLambdaIncomingHeaders(
  event: ALBEvent | APIGatewayProxyEvent | APIGatewayProxyEventV2
): Record<string, string | string[] | undefined>;
export function normalizeLambdaIncomingHeaders(
  eventOrHeaders?:
    | ALBEvent
    | APIGatewayProxyEvent
    | APIGatewayProxyEventV2
    | APIGatewayProxyEventHeaders
    | APIGatewayProxyEventMultiValueHeaders
): Record<string, string | string[] | undefined> {
  if (isEvent(eventOrHeaders)) {
    // ALB event has either `headers` or `multiValueHeaders`
    if (isAlbEvent(eventOrHeaders)) {
      return normalizeLambdaIncomingHeaders(
        eventOrHeaders.headers ?? eventOrHeaders.multiValueHeaders
      );
    }

    // Other events always have `headers`
    return normalizeLambdaIncomingHeaders(eventOrHeaders.headers);
  }

  // if we're here, `eventOrHeaders` is `APIGatewayProxyEventHeaders`
  return Object.fromEntries(
    Object.entries(eventOrHeaders || {}).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ])
  );
}

export function normalizeLambdaIncomingQuery(
  event: ALBEvent | APIGatewayProxyEvent | APIGatewayProxyEventV2
): Record<string, string | string[] | undefined> {
  const rawQueryObj: Record<string, string | string[] | undefined> = {
    ...event.queryStringParameters,
    ...(event as ALBEvent | APIGatewayProxyEvent)
      .multiValueQueryStringParameters,
  };

  // `APIGatewayProxyEvent | APIGatewayProxyEventV2` have URL-decoded query parameters
  if (!isAlbEvent(event)) {
    return rawQueryObj;
  }

  /*
   * `ALBEvent` has either `queryStringParameters` or `multiValueQueryStringParameters`.
   * Query params in raw form, they must be decoded to avoid double URL encoding
   */
  return Object.fromEntries(
    Object.entries(
      event.queryStringParameters ?? event.multiValueQueryStringParameters ?? {}
    ).map(([key, value]) => {
      let decodedValue: string | string[] | undefined;
      if (typeof value === "string") {
        decodedValue = decode(value);
      } else if (Array.isArray(value)) {
        decodedValue = value.map((v) => decode(v));
      } else {
        decodedValue = value;
      }

      return [decode(key), decodedValue];
    })
  );
}

// -- Internal --

function isAlbEvent(
  event: ALBEvent | APIGatewayProxyEvent | APIGatewayProxyEventV2
): event is ALBEvent {
  return !!event?.requestContext && "elb" in event.requestContext;
}

function isEvent(
  obj?:
    | ALBEvent
    | ALBEventQueryStringParameters
    | ALBEventMultiValueQueryStringParameters
    | APIGatewayProxyEvent
    | APIGatewayProxyEventV2
    | APIGatewayProxyEventHeaders
    | APIGatewayProxyEventMultiValueHeaders
): obj is ALBEvent | APIGatewayProxyEvent | APIGatewayProxyEventV2 {
  // All events have a `requestContext` object field
  return (
    !!obj &&
    !!obj.requestContext &&
    typeof obj.requestContext === "object" &&
    !Array.isArray(obj.requestContext)
  );
}
