import { describe, expect, it, vi } from "vitest";
import { resolve } from "pathe";
import { RollupPluginsHost } from "../../src/build/rspack/_plugin.ts";

describe("rspack: plugins host", () => {
  it("resolves unclaimed bare imports once per directory", async () => {
    const { pluginsHost, resolveSpy, warn } = createHost();
    const external = (request: string, issuer: string, dependencyType = "esm") =>
      pluginsHost.externals({ request, dependencyType, contextInfo: { issuer } } as any);

    expect(await external("unknown-pkg", "/app/server/a.ts")).toBe("unknown-pkg");
    expect(await external("unknown-pkg", "/app/server/b.ts")).toBe("unknown-pkg");
    expect(await external("unknown-pkg", "/app/server/b.ts", "commonjs")).toBe("unknown-pkg");
    // Once with `require` and once with `import` conditions
    expect(resolveSpy).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);

    expect(await external("unknown-pkg", "/app/other/c.ts")).toBe("unknown-pkg");
    expect(resolveSpy).toHaveBeenCalledTimes(4);
  });
});

function createHost() {
  const warn = vi.fn();
  const nitro = {
    hooks: { hookOnce: () => {} },
    logger: { warn },
    options: {
      rootDir: "/app",
      buildDir: resolve("/app/.nitro"),
      dev: false,
      node: false,
    },
  };
  const pluginsHost = new RollupPluginsHost(nitro as any, []);
  const resolveSpy = vi.fn((_ctx, _dir, _request, _resolveCtx, callback) => {
    callback(new Error("Not found"));
  });
  pluginsHost.compilation = {
    compiler: { resolverFactory: { get: () => ({ resolve: resolveSpy }) } },
  } as any;
  return { pluginsHost, resolveSpy, warn };
}
