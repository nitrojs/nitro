import { definePlugin } from "nitro";
import { mark } from "./events.ts";

if (process.env.TASK_CLI_TLA_WAIT) {
  mark("boundary:tla:waiting");
  await new Promise<void>(() => {});
  mark("boundary:tla:released");
}

export default definePlugin(() => {
  mark("boundary:init");
  process.once("SIGINT", () => mark("boundary:SIGINT"));
  process.once("SIGTERM", () => mark("boundary:SIGTERM"));
});
