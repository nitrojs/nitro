import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { describe, expect, it } from "vitest";
import { awsRequest } from "../../src/presets/aws-lambda/runtime/_utils.ts";

const mockContext = {
  functionName: "test",
  functionVersion: "$LATEST",
  invokedFunctionArn: "arn:aws:lambda:us-east-1:123456789012:function:test",
  memoryLimitInMB: "128",
  awsRequestId: "test-request-id",
  logGroupName: "/aws/lambda/test",
  logStreamName: "test-stream",
  callbackWaitsForEmptyEventLoop: false,
  getRemainingTimeInMillis: () => 1000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
};

const mockEvent: APIGatewayProxyEventV2 = {
  rawPath: "/test",
  headers: { host: "example.com" },
  rawQueryString: "",
  body: undefined,
  isBase64Encoded: false,
  version: "2.0",
  routeKey: "GET /test",
  requestContext: {
    accountId: "123456789012",
    apiId: "api-id",
    domainName: "example.com",
    domainPrefix: "example",
    requestId: "request-id",
    routeKey: "GET /test",
    stage: "$default",
    time: "01/Jan/2024:00:00:00 +0000",
    timeEpoch: 1704067200,
    http: {
      method: "GET",
      path: "/test",
      protocol: "HTTP/1.1",
      sourceIp: "1.2.3.4",
      userAgent: "test-agent",
    },
  },
};

describe("awsRequest", () => {
  it("returns the same Request object with runtime metadata", () => {
    const req = awsRequest(mockEvent, mockContext);
    expect(req.runtime).toBeDefined();
    expect(req.runtime?.name).toBe("aws-lambda");
  });

  it("sets runtime.awsLambda with event and context", () => {
    const req = awsRequest(mockEvent, mockContext);
    expect(req.runtime?.awsLambda).toBeDefined();
    expect(req.runtime?.awsLambda?.event).toBe(mockEvent);
    expect(req.runtime?.awsLambda?.context).toBe(mockContext);
  });
});
