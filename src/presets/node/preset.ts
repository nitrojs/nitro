import { defineNitroPreset } from "../_utils/preset";
import { normalize } from "pathe";
import { resolveModulePath } from "exsolve";

const nodeServer = defineNitroPreset(
  {
    entry: "./runtime/node-server",
    serveStatic: true,
    commands: {
      preview: "node ./server/index.mjs",
    },
  },
  {
    name: "node-server" as const,
    url: import.meta.url,
  }
);

const nodeMiddleware = defineNitroPreset(
  {
    entry: "./runtime/node-middleware",
  },
  {
    name: "node-middleware" as const,
    url: import.meta.url,
  }
);

const nodeCluster = defineNitroPreset(
  {
    extends: "node-server",
    serveStatic: true,
    entry: "./runtime/node-cluster",
    hooks: {
      "rollup:before"(_nitro, rollupConfig) {
        const manualChunks = rollupConfig.output?.manualChunks;
        if (manualChunks && typeof manualChunks === "function") {
          const serverEntry = resolveModulePath("./runtime/node-server", {
            from: import.meta.url,
            extensions: [".mjs", ".ts"],
          });
          rollupConfig.output.manualChunks = (id, meta) => {
            if (id.includes("node-server") && normalize(id) === serverEntry) {
              return "nitro/node-worker";
            }
            return manualChunks(id, meta);
          };
        }
      },
    },
  },
  {
    name: "node-cluster" as const,
    url: import.meta.url,
  }
);

export default [nodeServer, nodeCluster, nodeMiddleware] as const;
