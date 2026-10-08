import { appendFileSync } from "node:fs";
import { test } from "vitest";
import { serverFetch } from "nitro";
import { useRuntimeConfig } from "nitro/runtime-config";
import { version } from "../utils/version.ts";

// Logs what the app serves on each (re)run, for `vitest-watch.test.ts` to observe
test("app", async () => {
  const hello = await serverFetch("/hello").then((res) => res.text());
  const added = await serverFetch("/added").then((res) => res.status);
  const { greeting } = useRuntimeConfig();
  const state = { hello, added, greeting, version };
  appendFileSync(process.env.NITRO_TEST_WATCH_LOG!, JSON.stringify(state) + "\n");
});
