import nodeCrypto from "node:crypto";
import { defineCommand } from "citty";
import type { DateString } from "compatx";
import {
  build,
  copyPublicAssets,
  createNitro,
  prepare,
  prerender,
} from "nitropack/core";
import { resolve } from "pathe";
import { commonArgs } from "../common";

// globalThis.crypto support for Node.js 18
if (!globalThis.crypto) {
  globalThis.crypto = nodeCrypto.webcrypto as unknown as Crypto;
}

export default defineCommand({
  meta: {
    name: "build",
    description: "Build nitro project for production",
  },
  args: {
    ...commonArgs,
    minify: {
      type: "boolean",
      description:
        "Minify the output (overrides preset defaults you can also use `--no-minify` to disable).",
    },
    preset: {
      type: "string",
      description:
        "The build preset to use (you can also use `NITRO_PRESET` environment variable).",
    },
    compatibilityDate: {
      type: "string",
      description:
        "The date to use for preset compatibility (you can also use `NITRO_COMPATIBILITY_DATE` environment variable).",
    },
  },
  async run({ args }) {
    const rootDir = resolve((args.dir || args._dir || ".") as string);
    const nitro = await createNitro(
      {
        rootDir,
        dev: false,
        minify: args.minify,
        preset: args.preset,
      },
      {
        compatibilityDate: args.compatibilityDate as DateString,
      }
    );
    await prepare(nitro);
    await copyPublicAssets(nitro);
    await prerender(nitro);
    await build(nitro);
    await nitro.close();
  },
});
