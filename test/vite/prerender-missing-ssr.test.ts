import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { consola } from "consola";
import { nitro } from "../../src/vite.ts";

const { resolveConfig } = (await import(
  process.env.NITRO_VITE_PKG || "vite"
)) as typeof import("vite");

const rootDir = fileURLToPath(new URL("./prerender-missing-ssr-fixture", import.meta.url));

// #4591: when the SSR entry lives outside the auto-detected directories
// (`<root|app|src>/entry-server.*`), no `ssr` service is registered and no
// renderer is wired up, but the build used to succeed silently — prerendered
// routes all resolve to `[404]` and no HTML is emitted, with no hint why.
describe("vite: missing SSR entry", () => {
  test("warns when the SSR entry is outside the auto-detected directories", async () => {
    const warnings: string[] = [];
    const reporter = {
      log: (logObj: { type: string; args: unknown[] }) => {
        if (logObj.type === "warn") {
          warnings.push(logObj.args.join(" "));
        }
      },
    };
    const originalReporters = [...consola.options.reporters];
    consola.setReporters([reporter]);
    let resolved;
    try {
      resolved = await resolveConfig(
        {
          root: rootDir,
          configFile: false,
          plugins: [nitro()],
          nitro: { prerender: { routes: ["/"] } },
        } as any,
        "build"
      );
    } finally {
      consola.setReporters(originalReporters);
    }

    // The entry at `src/ssr/entry-server.ts` is not auto-detected, so no `ssr`
    // environment (service) is registered.
    expect(resolved.environments?.ssr).toBeUndefined();

    // The silent part of #4591: this situation must at least produce a warning.
    expect(warnings.join("\n")).toContain("ssr entry");

    // The warning must also include the actionable remediation guidance.
    expect(warnings.join("\n")).toContain("`environments.ssr.build.rollupOptions.input`");
  });
});
