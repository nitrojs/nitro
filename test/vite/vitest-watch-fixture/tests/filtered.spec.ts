import { appendFileSync } from "node:fs";
import { test } from "vitest";
import { serverFetch } from "nitro";

// Logs its runs, for the filename filter case in `vitest-watch.test.ts`
test("filtered", async () => {
  await serverFetch("/hello");
  if (process.env.NITRO_TEST_WATCH_FILTERED_LOG) {
    appendFileSync(process.env.NITRO_TEST_WATCH_FILTERED_LOG, "run\n");
  }
});
