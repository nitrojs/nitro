import { defineConfig } from "nitro";

export default defineConfig({
  serverDir: true,

  // Instrument the h3, srvx, unstorage and db0 tracing channels.
  tracingChannel: true,

  experimental: {
    // Log every completed span to the console (built-in, dependency-free sink).
    tracingLogger: true,
  },
});
