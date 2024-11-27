import { describe, expect, it } from "vitest";
import {
  normalizeLambdaIncomingHeaders,
  normalizeLambdaIncomingQuery,
} from "../../../src/runtime/internal/utils.lambda/incoming";
import type {
  ALBEvent,
  APIGatewayProxyEvent,
  APIGatewayProxyEventV2,
} from "aws-lambda";
import type { DeepPartial } from "../../../src/types/_utils";

describe("normalizeLambdaIncomingHeaders", () => {
  describe("single-value headers", () => {
    it("lowecases header names", () => {
      const actual = normalizeLambdaIncomingHeaders({
        Foo: "Bar",
      });

      expect(actual).toStrictEqual({ foo: "Bar" });
    });
  });

  describe("multi-value headers", () => {
    it("lowecases header names", () => {
      const actual = normalizeLambdaIncomingHeaders({
        Foo: ["Bar"],
      });

      expect(actual).toStrictEqual({ foo: ["Bar"] });
    });
  });

  describe("ALB event", () => {
    describe("with single-value headers", () => {
      it("lowercases header names", () => {
        const event: Partial<ALBEvent> = {
          requestContext: { elb: { targetGroupArn: "some-target" } },
          headers: { Foo: "Bar" },
        };
        const actual = normalizeLambdaIncomingHeaders(event as ALBEvent);

        expect(actual).toStrictEqual({ foo: "Bar" });
      });
    });

    describe("with multi-value headers", () => {
      it("lowercases header names", () => {
        const event: Partial<ALBEvent> = {
          requestContext: { elb: { targetGroupArn: "some-target" } },
          multiValueHeaders: { Foo: ["Bar"] },
        };
        const actual = normalizeLambdaIncomingHeaders(event as ALBEvent);

        expect(actual).toStrictEqual({ foo: ["Bar"] });
      });
    });
  });

  describe("API gateway proxy event", () => {
    it("lowercases headers names", () => {
      const event: DeepPartial<APIGatewayProxyEvent> = {
        requestContext: { httpMethod: "get" },
        headers: { Foo: "Bar" },
      };
      const actual = normalizeLambdaIncomingHeaders(
        event as APIGatewayProxyEvent
      );

      expect(actual).toStrictEqual({ foo: "Bar" });
    });
  });

  describe("API gateway proxy V2 event", () => {
    it("lowercases headers names", () => {
      const event: DeepPartial<APIGatewayProxyEventV2> = {
        requestContext: { http: { method: "get" } },
        headers: { Foo: "Bar" },
      };
      const actual = normalizeLambdaIncomingHeaders(
        event as APIGatewayProxyEventV2
      );

      expect(actual).toStrictEqual({ foo: "Bar" });
    });
  });
});

describe("normalizeLambdaIncomingQuery", () => {
  describe("ALB event", () => {
    describe("with single-value headers", () => {
      it("URL decodes the query params", () => {
        const event: Partial<ALBEvent> = {
          requestContext: { elb: { targetGroupArn: "some-target" } },
          /*
           * ALB does not automatically URL decodes query params.
           * If they come this way it means they were encoded once by the client.
           * They should be decoded.
           */
          queryStringParameters: { "Foo%2FFoo": "Bar%2FBar" },
        };
        const actual = normalizeLambdaIncomingQuery(event as ALBEvent);

        expect(actual).toStrictEqual({ "Foo/Foo": "Bar/Bar" });
      });
    });

    describe("with multi-value headers", () => {
      it("URL decodes the query params", () => {
        const event: Partial<ALBEvent> = {
          requestContext: { elb: { targetGroupArn: "some-target" } },
          /*
           * ALB does not automatically URL decodes query params.
           * If they come this way it means they were encoded once by the client.
           * They should be decoded.
           */
          multiValueQueryStringParameters: { "Foo%2FFoo": ["Bar%2FBar"] },
        };
        const actual = normalizeLambdaIncomingQuery(event as ALBEvent);

        expect(actual).toStrictEqual({ "Foo/Foo": ["Bar/Bar"] });
      });
    });
  });

  describe("API gateway proxy event", () => {
    it("merges single and multi-value query params and returns them as is", () => {
      const event: DeepPartial<APIGatewayProxyEvent> = {
        requestContext: { httpMethod: "get" },
        /*
         * API Gateway automatically URL decodes query params.
         * If they come this way it means they were double encoded by the client.
         * They should be left "as is".
         */
        queryStringParameters: { "Foo%2FFoo": "Bar%2FBar" },
        multiValueQueryStringParameters: { "Foo%2FFoo": ["Bar%2FBar"] },
      };
      const actual = normalizeLambdaIncomingQuery(
        event as APIGatewayProxyEvent
      );

      expect(actual).toStrictEqual({ "Foo%2FFoo": ["Bar%2FBar"] });
    });
  });

  describe("API gateway proxy V2 event", () => {
    it("returns query params as is", () => {
      const event: DeepPartial<APIGatewayProxyEventV2> = {
        requestContext: { http: { method: "get" } },
        /*
         * API Gateway automatically URL decodes query params.
         * If they come this way it means they were double encoded by the client.
         * They should be left "as is".
         */
        queryStringParameters: { "Foo%2FFoo": "Bar%2FBar" },
      };
      const actual = normalizeLambdaIncomingQuery(
        event as APIGatewayProxyEventV2
      );

      expect(actual).toStrictEqual({ "Foo%2FFoo": "Bar%2FBar" });
    });
  });
});
