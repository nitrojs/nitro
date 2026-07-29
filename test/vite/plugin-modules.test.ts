import { fileURLToPath } from "node:url";
import type { Plugin, PluginOption } from "vite";
import type { Nitro } from "nitro/types";
import { afterEach, describe, expect, test } from "vitest";
import { consola } from "consola";
import { nitro } from "../../src/vite.ts";

const { resolveConfig } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

const rootDir = fileURLToPath(new URL("./app-fixture", import.meta.url));

describe("vite: nitro modules from vite plugins", () => {
  const instances: Nitro[] = [];
  let installed: string[] = [];

  afterEach(async () => {
    installed = [];
    await Promise.all(instances.splice(0).map((instance) => instance.close()));
  });

  const modulePlugin = (name: string, options: Partial<Plugin> = {}): Plugin => ({
    name,
    ...options,
    nitro: {
      setup(instance) {
        instances.push(instance);
        installed.push(name);
      },
    },
  });

  const resolve = (plugins: PluginOption[], command: "build" | "serve" = "build") =>
    resolveConfig(
      { root: rootDir, configFile: false, plugins: [nitro({ serverDir: "./" }), ...plugins] },
      command
    );

  test("registers modules of vite plugins", async () => {
    await resolve([modulePlugin("plugin-a"), modulePlugin("plugin-b")]);
    expect(installed).toEqual(["plugin-a", "plugin-b"]);
  });

  test("registers modules of nested and async vite plugins", async () => {
    await resolve([[modulePlugin("nested")], Promise.resolve(modulePlugin("async"))]);
    expect(installed).toEqual(["nested", "async"]);
  });

  test("skips plugins filtered out by `apply`", async () => {
    await resolve(
      [
        modulePlugin("build-only", { apply: "build" }),
        modulePlugin("serve-only", { apply: "serve" }),
        modulePlugin("apply-fn", { apply: (_config, env) => env.command === "serve" }),
      ],
      "build"
    );
    expect(installed).toEqual(["build-only"]);
  });

  test("skips plugins filtered out by `apply` in dev", async () => {
    await resolve(
      [
        modulePlugin("build-only", { apply: "build" }),
        modulePlugin("serve-only", { apply: "serve" }),
      ],
      "serve"
    );
    expect(installed).toEqual(["serve-only"]);
  });

  test("installs a shared plugin module only once", async () => {
    const shared = modulePlugin("shared");
    await resolve([shared, shared, [shared]]);
    expect(installed).toEqual(["shared"]);
  });

  test("warns about plugins that Vite does not apply", async () => {
    const warnings: string[] = [];
    const reporter = {
      log: (logObj: { type: string; args: unknown[] }) => {
        if (logObj.type === "warn") {
          warnings.push(logObj.args.join(" "));
        }
      },
    };
    consola.addReporter(reporter);

    // Vite resolves its plugin list before running config hooks, so plugins added
    // from a `config` hook are ignored by Vite (but visible to Nitro's discovery).
    // Vite's types forbid this (`Omit<UserConfig, "plugins">`), hence the cast.
    const injector: Plugin = {
      name: "injector",
      enforce: "pre",
      config: () => ({ plugins: [modulePlugin("injected")] }) as any,
    };
    await resolve([injector, modulePlugin("applied")]);
    consola.removeReporter(reporter);

    expect(installed).toEqual(["applied", "injected"]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("`injected` registers a Nitro module but is not applied by Vite");
  });
});
