import { describe, expect, it } from "vitest";
import { planAwsLambdaStreamingEmit } from "../../src/presets/aws-lambda/runtime/streaming-body.ts";

describe("planAwsLambdaStreamingEmit", () => {
  it("treats null body (redirects / 204) as bodyless with content-length 0", () => {
    expect(planAwsLambdaStreamingEmit({ body: null })).toEqual({
      kind: "bodyless",
      contentLength: "0",
    });
  });

  it("streams responses that have a body with chunked TE by default", () => {
    const body = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode("hi"));
        c.close();
      },
    });
    expect(planAwsLambdaStreamingEmit({ body })).toEqual({
      kind: "stream",
      transferEncoding: "chunked",
    });
  });

  it("does not force chunked TE when the response already sets it", () => {
    const body = new ReadableStream({
      start(c) {
        c.close();
      },
    });
    const headers = new Headers({ "transfer-encoding": "chunked" });
    expect(planAwsLambdaStreamingEmit({ body, headers })).toEqual({
      kind: "stream",
      transferEncoding: undefined,
    });
  });
});
