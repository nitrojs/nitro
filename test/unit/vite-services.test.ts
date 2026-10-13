import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { join } from "pathe";
import { describe, expect, it } from "vitest";
import type { NitroPluginContext } from "../../src/build/vite/types.ts";
import { viteServicesTemplate } from "../../src/build/vite/services.ts";

const entries = {
  default: `export default { prefix: "default", fetch(req) { return this.prefix + ":" + req } }`,
  named: `export function fetch(req) { return "named:" + req }`,
  both: `export const fetch = () => "helper"; export default { fetch: (req) => "default:" + req }`,
  missing: `export const buildId = "xyz"; export function renderPage() {}`,
  defaultWithoutFetch: `export function fetch(req) { return "named:" + req }; export default { render() {} }`,
};

async function loadServices() {
  const buildDir = mkdtempSync(join(tmpdir(), "nitro-vite-services-"));
  for (const [name, code] of Object.entries(entries)) {
    mkdirSync(join(buildDir, "vite/services", name), { recursive: true });
    writeFileSync(join(buildDir, "vite/services", name, "index.mjs"), code);
  }
  const ctx = {
    nitro: { options: { dev: false, buildDir } },
    services: Object.fromEntries(Object.keys(entries).map((name) => [name, { entry: name }])),
    _entryPoints: Object.fromEntries(Object.keys(entries).map((name) => [name, "index.mjs"])),
  } as unknown as NitroPluginContext;
  const file = join(buildDir, "services.mjs");
  writeFileSync(file, viteServicesTemplate(ctx));
  const { viteServices } = await import(pathToFileURL(file).href);
  return viteServices as Record<string, { fetch: (req: any) => Promise<unknown> }>;
}

describe("vite services template (prod)", async () => {
  const services = await loadServices();

  it("uses the default export's fetch", async () => {
    expect(await services.default.fetch("req")).toBe("default:req");
  });

  it("uses a named fetch export", async () => {
    expect(await services.named.fetch("req")).toBe("named:req");
  });

  it("prefers the default export's fetch over a named fetch", async () => {
    expect(await services.both.fetch("req")).toBe("default:req");
  });

  it("falls back to a named fetch when the default export has none", async () => {
    expect(await services.defaultWithoutFetch.fetch("req")).toBe("named:req");
  });

  it("throws a descriptive error when no fetch handler is exported", async () => {
    await expect(services.missing.fetch("req")).rejects.toThrow(
      'Vite service "missing" entry does not export a `fetch` handler'
    );
  });
});
