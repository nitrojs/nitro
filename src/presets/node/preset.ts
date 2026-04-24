import { defineNitroPreset } from "nitropack/kit";
import { normalize } from "pathe";
import { resolveModulePath } from "exsolve";

const node = defineNitroPreset(
  {
    entry: "./runtime/node-listener",
  },
  {
    name: "node-listener" as const,
    aliases: ["node"] as const,
    url: import.meta.url,
  }
);

const nodeServer = defineNitroPreset(
  {
    extends: "node",
    entry: "./runtime/node-server",
    serveStatic: true,
    commands: {
      preview: "node {{ output.serverDir }}/index.mjs",
    },
  },
  {
    name: "node-server" as const,
    url: import.meta.url,
  }
);

const nodeCluster = defineNitroPreset(
  {
    extends: "node-server",
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

const cli = defineNitroPreset(
  {
    extends: "node",
    entry: "./runtime/cli",
    commands: {
      preview: "Run with node {{ output.serverDir }}/index.mjs [route]",
    },
  },
  {
    name: "cli" as const,
    url: import.meta.url,
  }
);

export default [node, nodeServer, nodeCluster, cli] as const;
