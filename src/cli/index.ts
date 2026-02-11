#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { version as nitroVersion } from "nitro/meta";

const main = defineCommand({
  meta: {
    name: "nitro",
    description: "Nitro CLI",
    version: nitroVersion,
  },
  subCommands: {
    dev: () => import("./commands/dev.ts").then((r) => r.default),
    build: () => import("./commands/build.ts").then((r) => r.default),
    prepare: () => import("./commands/prepare.ts").then((r) => r.default),
    task: () => import("./commands/task/index.ts").then((r) => r.default),
    preview: () => import("./commands/preview.ts").then((r) => r.default),
  },
});

runMain(main);
