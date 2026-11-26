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

    it("skips traversing nitro.routeRules while still applying sibling and top-level config", () => {
      let routeRulesAccessed = false;
      const routeRules = new Proxy(
        {
          "/api/**": { headers: { "cache-control": "no-store" } },
          "/_nuxt/**": { headers: { "cache-control": "public, max-age=31536000, immutable" } },
        },
        {
          ownKeys(target) {
            routeRulesAccessed = true;
            return Reflect.ownKeys(target);
          },
          get(target, prop, receiver) {
            routeRulesAccessed = true;
            return Reflect.get(target, prop, receiver);
          },
        }
      );

      process.env.NITRO_API_KEY = "from-env";
      process.env.NITRO_NITRO_OPEN_API_ROUTE = "/custom-openapi.json";
      process.env.NITRO_ROUTE_RULES_CUSTOM = "overridden";
      try {
        const config = {
          apiKey: "default",
          routeRules: { custom: "initial" },
          nitro: {
            openAPI: { route: "/_openapi.json" },
            routeRules,
          },
        };
        applyEnv(config, { prefix: "NITRO_", altPrefix: "_", envExpansion: true });

        expect(routeRulesAccessed).toBe(false);
        expect(config.apiKey).toBe("from-env");
        expect(config.nitro.openAPI.route).toBe("/custom-openapi.json");
        expect(config.routeRules.custom).toBe("overridden");
        expect(config.nitro.routeRules).toBe(routeRules);
      } finally {
        delete process.env.NITRO_API_KEY;
        delete process.env.NITRO_NITRO_OPEN_API_ROUTE;
        delete process.env.NITRO_ROUTE_RULES_CUSTOM;
      }
    });
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
