#!/usr/bin/env node
import { defineCommand, runMain as _runMain } from "citty";
import { version as nitroVersion } from "nitro/meta";
import { initCompletions } from "./completions";

const main = defineCommand({
  meta: {
    name: "nitro",
    description: "Nitro CLI",
    version: nitroVersion,
  },
  subCommands: {
    dev: () => import("./commands/dev").then((r) => r.default),
    build: () => import("./commands/build").then((r) => r.default),
    prepare: () => import("./commands/prepare").then((r) => r.default),
    task: () => import("./commands/task").then((r) => r.default),
  },
});

async function runMain() {
  await initCompletions(main);
  return _runMain(main);
}

runMain();
