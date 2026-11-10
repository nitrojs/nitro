import { appendFileSync } from "node:fs";
import { test } from "@rstest/core";
import { serverFetch } from "nitro";
import { version } from "../utils/version.ts";

// Logs what the app serves on each (re)run, for `rstest.test.ts` to observe
test("app", async () => {
  const hello = await serverFetch("/hello").then((res) => res.text());
  const added = await serverFetch("/added").then((res) => res.status);
  const state = { hello, added, version };
  appendFileSync(process.env.NITRO_TEST_WATCH_LOG!, JSON.stringify(state) + "\n");
});
