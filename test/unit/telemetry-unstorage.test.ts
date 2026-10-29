import { describe, expect, it } from "vitest";
import { TRACING_CHANNELS } from "unstorage/tracing";
import { UNSTORAGE_CHANNELS } from "../../src/runtime/internal/telemetry/unstorage.ts";
import { TRACED_CHANNELS } from "../../src/runtime/internal/telemetry/channels.ts";

describe("unstorage tracing channels", () => {
  it("match the channels published by `unstorage/tracing`", () => {
    expect([...UNSTORAGE_CHANNELS].sort()).toEqual([...TRACING_CHANNELS].sort());
  });

  it("are all described", () => {
    for (const name of TRACING_CHANNELS) {
      expect(TRACED_CHANNELS[name]).toBeTypeOf("function");
    }
  });
});
