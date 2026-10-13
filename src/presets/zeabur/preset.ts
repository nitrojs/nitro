import fsp from "node:fs/promises";
import { writeFile } from "../_utils/fs.ts";
import { defineNitroPreset } from "../_utils/preset.ts";
import type { Nitro } from "nitro/types";
import { dirname, relative, resolve } from "pathe";

// https://zeabur.com/docs/advanced/serverless-output-format

const zeabur = defineNitroPreset(
  {
    entry: "./zeabur/runtime/zeabur",
    output: {
      dir: "{{ rootDir }}/.zeabur/output",
      serverDir: "{{ output.dir }}/functions/__nitro.func",
      publicDir: "{{ output.dir }}/static",
    },
    hooks: {
      async compiled(nitro: Nitro) {
        const buildConfigPath = resolve(nitro.options.output.dir, "config.json");
        const cfg = {
          containerized: false,
          routes: [{ src: ".*", dest: "/__nitro" }],
        };
        await writeFile(buildConfigPath, JSON.stringify(cfg, null, 2));

        // Write ISR functions
        for (const [key, value] of Object.entries(nitro.options.routeRules)) {
          if (!value.isr) {
            continue;
          }
          const funcPrefix = resolve(nitro.options.output.serverDir, ".." + key);
          await fsp.mkdir(dirname(funcPrefix), { recursive: true });
          await fsp.symlink(
            "./" + relative(dirname(funcPrefix), nitro.options.output.serverDir),
            funcPrefix + ".func",
            "junction"
          );
          await writeFile(
            funcPrefix + ".prerender-config.json",
            JSON.stringify({ type: "Prerender" })
          );
        }
      },
    },
  },
  {
    name: "zeabur" as const,
    stdName: "zeabur",
  }
);

const zeaburStatic = defineNitroPreset(
  {
    extends: "static",
    output: {
      dir: "{{ rootDir }}/.zeabur/output",
      publicDir: "{{ output.dir }}/static",
    },
    commands: {
      preview: "npx serve ./static",
    },
  },
  {
    name: "zeabur-static" as const,

    static: true,
  }
);

export default [zeabur, zeaburStatic] as const;
