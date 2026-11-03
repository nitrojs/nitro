import { definePlugin } from "nitro";

export default definePlugin(() => {
  (globalThis as any).__pluginRuns = ((globalThis as any).__pluginRuns || 0) + 1;
});
