import { describe, expect, it } from "vitest";
import type { Nitro } from "nitro/types";

import app from "../../src/build/virtual/app.ts";

function createNitroStub(opts: {
  routeRules?: boolean;
  routedMiddleware?: boolean;
  globalMiddleware?: boolean;
}): Nitro {
  return {
    options: {
      plugins: [],
      experimental: {},
    },
    routing: {
      routes: { hasRoutes: () => true },
      routeRules: { hasRoutes: () => !!opts.routeRules },
      routedMiddleware: { hasRoutes: () => !!opts.routedMiddleware },
      globalMiddleware: opts.globalMiddleware ? [{}] : [],
    },
  } as unknown as Nitro;
}

describe("virtual/app template", () => {
  it("does not override `~getMiddleware`, so h3 can precompose the middleware chain", () => {
    const template = app(
      createNitroStub({ routeRules: true, routedMiddleware: true, globalMiddleware: true })
    ).template();
    expect(template).not.toContain("~getMiddleware");
  });

  it("registers route rules, global and routed middleware in that order", () => {
    const template = app(
      createNitroStub({ routeRules: true, routedMiddleware: true, globalMiddleware: true })
    ).template();
    const routeRules = template.indexOf("getRouteRules(event.req.method");
    const global = template.indexOf("push(...globalMiddleware)");
    const routed = template.indexOf("matchRoutedMiddleware(event.req.method");
    expect(routeRules).toBeGreaterThan(-1);
    expect(global).toBeGreaterThan(routeRules);
    expect(routed).toBeGreaterThan(global);
  });

  it("keeps exposing matched route rules on `event.context.routeRules`", () => {
    const template = app(createNitroStub({ routeRules: true })).template();
    expect(template).toContain("event.context.routeRules = routeRules?.routeRules");
  });

  it("composes the per-path chains once and caches them on the memoized match", () => {
    const template = app(createNitroStub({ routeRules: true, routedMiddleware: true })).template();
    expect(template).toContain('import { composeMiddleware, H3Core } from "h3";');
    expect(template).toContain('import { memoizeRouteRulesMatcher } from "h3/rules";');
    expect(template).toContain("memoizeRouteRulesMatcher(findRoutedMiddleware)");
    expect(template).toContain('routeRules["~composed"] ??= composeMiddleware(');
    expect(template).toContain('matched["~composed"] ??= composeMiddleware(');
  });

  it("does not import the composition helpers when nothing is path-dependent", () => {
    const template = app(createNitroStub({ globalMiddleware: true })).template();
    expect(template).toContain('import { H3Core } from "h3";');
    expect(template).not.toContain("composeMiddleware");
    expect(template).not.toContain("h3/rules");
    expect(template).toContain("push(...globalMiddleware)");
  });
});
