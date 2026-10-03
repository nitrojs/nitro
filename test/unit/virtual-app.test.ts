import { describe, expect, it } from "vitest";
import type { Nitro } from "nitro/types";

import app from "../../src/build/virtual/app.ts";

function createNitroStub(opts: {
  routes?: boolean;
  routeRules?: boolean;
  routedMiddleware?: boolean;
  globalMiddleware?: boolean;
  plugins?: boolean;
}): Nitro {
  return {
    options: {
      plugins: opts.plugins ? ["plugin.ts"] : [],
      experimental: {},
    },
    routing: {
      routes: { hasRoutes: () => opts.routes ?? true },
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
    const routeRules = template.indexOf("push(createRouteRulesMiddleware())");
    const global = template.indexOf("push(...globalMiddleware)");
    const routed = template.indexOf("push(createRoutedMiddleware(findRoutedMiddleware))");
    expect(routeRules).toBeGreaterThan(-1);
    expect(global).toBeGreaterThan(routeRules);
    expect(routed).toBeGreaterThan(global);
  });

  it("resolves `event.context.routeRules` in `~findRoute`, before any middleware", () => {
    const template = app(createNitroStub({ routeRules: true })).template();
    const findRoute = template.indexOf('h3App["~findRoute"] = (event) => {');
    const routeRules = template.indexOf(
      "event.context.routeRules = getRouteRules(event.req.method, event.url.pathname).routeRules;"
    );
    const returnRoute = template.indexOf("return findRoute(event.req.method, event.url.pathname);");
    expect(findRoute).toBeGreaterThan(-1);
    expect(routeRules).toBeGreaterThan(findRoute);
    expect(returnRoute).toBeGreaterThan(routeRules);
  });

  it("still overrides `~findRoute` for route rules when there are no routes", () => {
    const template = app(createNitroStub({ routes: false, routeRules: true })).template();
    expect(template).toContain('h3App["~findRoute"] = (event) => {');
    expect(template).toContain("event.context.routeRules = getRouteRules(");
    expect(template).toContain("return undefined;");
    expect(template).not.toContain("findRoute(event.req.method");
  });

  it("only imports the runtime helpers it needs", () => {
    expect(app(createNitroStub({ routeRules: true })).template()).toContain(
      'import { createRouteRulesMiddleware, getRouteRules } from "#nitro/runtime/app";'
    );
    expect(app(createNitroStub({ routedMiddleware: true })).template()).toContain(
      'import { createRoutedMiddleware } from "#nitro/runtime/app";'
    );
    expect(app(createNitroStub({ routeRules: true, routedMiddleware: true })).template()).toContain(
      'import { createRouteRulesMiddleware, createRoutedMiddleware, getRouteRules } from "#nitro/runtime/app";'
    );
  });

  it("does not compose in the template nor import `h3/rules`", () => {
    const template = app(
      createNitroStub({ routeRules: true, routedMiddleware: true, globalMiddleware: true })
    ).template();
    expect(template).toContain('import { H3Core } from "h3";');
    expect(template).not.toContain("composeMiddleware");
    expect(template).not.toContain("h3/rules");
  });

  it("does not import the runtime helpers when nothing is path-dependent", () => {
    const template = app(createNitroStub({ globalMiddleware: true })).template();
    expect(template).not.toContain("#nitro/runtime/app");
    expect(template).not.toContain('~findRoute"] = (event) => {\n    event.context.routeRules');
    expect(template).toContain("push(...globalMiddleware)");
  });

  it("resets h3's cached dispatcher after plugins ran", () => {
    const reset = 'app.h3["~dispatch"] = app.h3["~composed"] = undefined;';
    const withPlugins = app(createNitroStub({ plugins: true })).template();
    const plugins = withPlugins.indexOf("for (const plugin of plugins)");
    expect(plugins).toBeGreaterThan(-1);
    expect(withPlugins.indexOf(reset)).toBeGreaterThan(plugins);
    expect(app(createNitroStub({})).template()).not.toContain(reset);
  });
});
