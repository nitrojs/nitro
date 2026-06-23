import { RunnerManager } from "env-runner";
import { describe, expect, test } from "vitest";
import { resolveConfig } from "vite";
import { createFetchableDevEnvironment } from "../../src/build/vite/dev.ts";

describe("vite: environment cleanup", () => {
  test("closes the env runner when the environment is closed", async () => {
    const config = await resolveConfig({ configFile: false }, "serve");
    const envRunner = new RunnerManager();
    const env = createFetchableDevEnvironment("client", config, envRunner, "/entry.mjs");

    await env.init();
    await env.close();

    expect(envRunner.closed).toBe(true);
  });
});
