import { subscribe } from "node:diagnostics_channel";
import { definePlugin } from "nitro";

const state = ((globalThis as any).__tracingProbe ??= { counts: {}, subscribed: false });

export default definePlugin(() => {
  if (state.subscribed) {
    return;
  }
  state.subscribed = true;
  for (const name of ["srvx.request", "h3.request"]) {
    subscribe(`tracing:${name}:start`, () => {
      state.counts[name] = (state.counts[name] || 0) + 1;
    });
  }
});
