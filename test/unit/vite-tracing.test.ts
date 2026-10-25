import { describe, expect, it, vi } from "vitest";
import { createSrvxTracingFetch } from "../../src/build/vite/_tracing.ts";

const diagnostics = process.getBuiltinModule("node:diagnostics_channel");

function isTracedRequest(context: any) {
  return context?.request?.url === "http://localhost/traced";
}

describe("createSrvxTracingFetch", () => {
  it("returns the original fetch when tracing is disabled", async () => {
    const fetch = vi.fn(async () => new Response("ok"));
    const traced = createSrvxTracingFetch(false, fetch);

    expect(traced).toBe(fetch);
    await expect(traced(new Request("http://localhost/traced"))).resolves.toBeInstanceOf(Response);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("traces srvx.request when tracing is enabled", async () => {
    const starts = vi.fn();
    const ends = vi.fn();
    const channel = diagnostics.tracingChannel("srvx.request");
    const listener = {
      start: (context: any) => isTracedRequest(context) && starts(),
      end: (context: any) => isTracedRequest(context) && ends(),
    };
    channel.subscribe(listener);

    try {
      const fetch = vi.fn(async () => new Response("ok"));
      const traced = createSrvxTracingFetch(true, fetch);

      const response = await traced(new Request("http://localhost/traced"));

      expect(await response.text()).toBe("ok");
      expect(fetch).toHaveBeenCalledOnce();
      expect(starts).toHaveBeenCalledOnce();
      expect(ends).toHaveBeenCalledOnce();
    } finally {
      channel.unsubscribe(listener);
    }
  });

  it("propagates fetch errors and reports them on the tracing channel", async () => {
    const errors = vi.fn();
    const channel = diagnostics.tracingChannel("srvx.request");
    const listener = {
      error: (context: any) => isTracedRequest(context) && errors(),
    };
    channel.subscribe(listener);

    try {
      const error = new Error("boom");
      const traced = createSrvxTracingFetch(true, async () => {
        throw error;
      });

      await expect(traced(new Request("http://localhost/traced"))).rejects.toBe(error);
      expect(errors).toHaveBeenCalledOnce();
    } finally {
      channel.unsubscribe(listener);
    }
  });
});
