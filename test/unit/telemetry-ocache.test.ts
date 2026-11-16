import { describe, expect, it } from "vitest";
import { FUNCTION_CHANNEL, HANDLER_CHANNEL } from "ocache";
import {
  OCACHE_FUNCTION_CHANNEL,
  OCACHE_HANDLER_CHANNEL,
} from "../../src/runtime/internal/telemetry/ocache.ts";
import { TRACED_CHANNELS } from "../../src/runtime/internal/telemetry/channels.ts";

describe("ocache tracing channels", () => {
  it("match the channels published by `ocache`", () => {
    expect(OCACHE_HANDLER_CHANNEL).toBe(HANDLER_CHANNEL);
    expect(OCACHE_FUNCTION_CHANNEL).toBe(FUNCTION_CHANNEL);
  });

  it("name the span after the cached handler or function", () => {
    for (const channel of [OCACHE_HANDLER_CHANNEL, OCACHE_FUNCTION_CHANNEL]) {
      const info = TRACED_CHANNELS[channel]!(channel, {
        name: "posts",
        group: "nitro/functions",
        status: "hit",
      });
      expect(info).toEqual({
        name: "cache posts",
        kind: 1,
        attributes: [
          { key: "ocache.name", value: { stringValue: "posts" } },
          { key: "ocache.group", value: { stringValue: "nitro/functions" } },
          { key: "ocache.status", value: { stringValue: "hit" } },
        ],
      });
    }
  });

  it("leave out the status of a call not served from the cache", () => {
    const info = TRACED_CHANNELS[OCACHE_HANDLER_CHANNEL]!(OCACHE_HANDLER_CHANNEL, {
      event: {},
      name: "anon_0123456789abcdef",
      group: "nitro/handlers",
      status: undefined,
    });
    expect(info.attributes).toEqual([
      { key: "ocache.name", value: { stringValue: "anon_0123456789abcdef" } },
      { key: "ocache.group", value: { stringValue: "nitro/handlers" } },
    ]);
  });
});
