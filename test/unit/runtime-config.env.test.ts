import { describe, expect, it } from "vitest";

import { applyEnv } from "../../src/runtime/internal/runtime-config.ts";

describe("env utils", () => {
  describe("applyEnv", () => {
    const tests = [
      {
        config: { a: "1", b: "2" },
        env: { NITRO_A: "123" },
        expected: { a: "123", b: "2" },
      },
      {
        config: { feature: { options: { option1: "original", option2: 123 } } },
        env: { NITRO_FEATURE_OPTIONS_OPTION1: "env" },
        expected: { feature: { options: { option1: "env", option2: 123 } } },
      },
    ];
    for (const test of tests) {
      it(`Config: ${JSON.stringify(test.config)} Env: { ${Object.entries(test.env)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(" ")} }`, () => {
        for (const key in test.env) {
          process.env[key] = test.env[key as keyof typeof test.env] as string;
        }
        expect(applyEnv(test.config, { prefix: "NITRO_" })).toEqual(test.expected);
        for (const key in test.env) {
          delete process.env[key];
        }
      });
    }
  });

  describe("envExpansion", () => {
    const tests = [
      // envExpansion is false by default
      {
        config: { mail: "{{MAIL_HOST}}:3366" },
        envOptions: {},
        env: { MAIL_HOST: "http://localhost" },
        expected: { mail: "{{MAIL_HOST}}:3366" },
      },
      // Fallback to the original string
      {
        config: { mail: "{{MAIL_HOST}}:3366" },
        envOptions: { envExpansion: true },
        env: {},
        expected: { mail: "{{MAIL_HOST}}:3366" },
      },
      // Base usage
      {
        config: { mail: "{{MAIL_HOST}}" },
        envOptions: { envExpansion: true },
        env: { MAIL_HOST: "http://localhost" },
        expected: { mail: "http://localhost" },
      },
      // With multiple envs
      {
        config: { mail: "{{MAIL_SCHEME}}://{{MAIL_HOST}}:{{MAIL_PORT}}" },
        envOptions: { envExpansion: true },
        env: { MAIL_SCHEME: "http", MAIL_HOST: "localhost", MAIL_PORT: "3366" },
        expected: { mail: "http://localhost:3366" },
      },
    ];
    for (const test of tests) {
      it(`Config: ${JSON.stringify(test.config)} ${JSON.stringify(
        test.envOptions
      )} Env: { ${Object.entries(test.env)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(" ")} }`, () => {
        for (const key in test.env) {
          process.env[key] = test.env[key as keyof typeof test.env];
        }
        expect(applyEnv(test.config, test.envOptions)).toEqual(test.expected);
        for (const key in test.env) {
          delete process.env[key];
        }
      });
    }
  });
});
