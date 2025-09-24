import { defineConfig, type Rollup } from "vite";
import { nitro } from "nitro/vite";
import assert from "node:assert";

const bundles: Record<string, Rollup.OutputBundle> = {};

export default defineConfig({
  plugins: [
    nitro(),
    {
      name: "client-entry",
      transform(code) {
        if (
          this.environment.mode === "dev" &&
          code.includes("__DEMO_CLIENT_ENTRY__")
        ) {
          return code.replace(
            "__DEMO_CLIENT_ENTRY__",
            JSON.stringify("/client.ts")
          );
        }
      },
      renderChunk(code) {
        if (code.includes("__DEMO_CLIENT_ENTRY__")) {
          const entryChunk = Object.values(bundles["client"]).find(
            (c) => c.type === "chunk" && c.isEntry
          );
          assert.ok(entryChunk && entryChunk.type === "chunk");
          return code.replace(
            "__DEMO_CLIENT_ENTRY__",
            JSON.stringify(entryChunk.fileName)
          );
        }
      },
      writeBundle(_, bundle) {
        bundles[this.environment.name] = bundle;
      },
      async buildApp(builder) {
        await builder.build(builder.environments.client);
        await builder.build(builder.environments.ssr);
      },
    },
  ],
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: "./client.ts",
        },
      },
    },
  },
});
