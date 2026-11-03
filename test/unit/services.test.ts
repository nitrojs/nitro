import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { join } from "pathe";
import { describe, expect, it } from "vitest";
import type { Nitro } from "nitro/types";
import { servicesTemplate } from "../../src/build/virtual/services.ts";

const entries = {
  default: `export default { prefix: "default", fetch(req) { return this.prefix + ":" + req } }`,
  named: `export function fetch(req) { return "named:" + req }`,
  both: `export const fetch = () => "helper"; export default { fetch: (req) => "default:" + req }`,
  missing: `export const buildId = "xyz"; export function renderPage() {}`,
  defaultWithoutFetch: `export function fetch(req) { return "named:" + req }; export default { render() {} }`,
};

async function importTemplate(dir: string, code: string) {
  const file = join(dir, `services-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(file, code);
  const { services } = await import(pathToFileURL(file).href);
  return services as Record<string, { fetch: (req: any) => Promise<unknown> }>;
}

async function loadServices() {
  const dir = mkdtempSync(join(tmpdir(), "nitro-services-"));
  for (const [name, code] of Object.entries(entries)) {
    mkdirSync(join(dir, name), { recursive: true });
    writeFileSync(join(dir, name, "index.mjs"), code);
  }
  const nitro = {
    options: { services: Object.fromEntries(Object.keys(entries).map((n) => [n, { entry: n }])) },
    _serviceLoader: (name: string) => ({ import: join(dir, name, "index.mjs") }),
  } as unknown as Nitro;
  return importTemplate(dir, servicesTemplate(nitro));
}

describe("services template", async () => {
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
      'Service "missing" entry does not export a `fetch` handler'
    );
  });
});

describe("services template (loaders)", () => {
  it("evaluates expression loaders on each access", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nitro-services-"));
    const nitro = {
      options: { services: { ssr: { entry: "ssr" } } },
      _serviceLoader: () => ({ expression: "globalThis.__nitro_test_service__" }),
    } as unknown as Nitro;
    const services = await importTemplate(dir, servicesTemplate(nitro));
    (globalThis as any).__nitro_test_service__ = { fetch: () => "a" };
    expect(await services.ssr.fetch("req")).toBe("a");
    (globalThis as any).__nitro_test_service__ = { fetch: () => "b" };
    expect(await services.ssr.fetch("req")).toBe("b");
    delete (globalThis as any).__nitro_test_service__;
  });

  it("imports unbundled loaders at runtime", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nitro-services-"));
    writeFileSync(join(dir, "ssr.mjs"), entries.default);
    const url = pathToFileURL(join(dir, "ssr.mjs")).href;
    const nitro = {
      options: { services: { ssr: { entry: "ssr" } } },
      _serviceLoader: () => ({ import: url, bundle: false }),
    } as unknown as Nitro;
    const code = servicesTemplate(nitro);
    // A literal specifier would be bundled
    expect(code).not.toContain(`import(${JSON.stringify(url)})`);
    expect(code).toContain("webpackIgnore: true");
    const services = await importTemplate(dir, code);
    expect(await services.ssr.fetch("req")).toBe("default:req");
  });

  it("retries a failed import on the next fetch", async () => {
    const dir = mkdtempSync(join(tmpdir(), "nitro-services-"));
    const file = join(dir, "later.mjs");
    const nitro = {
      options: { services: { later: { entry: "later" } } },
      _serviceLoader: () => ({ import: pathToFileURL(file).href, bundle: false }),
    } as unknown as Nitro;
    const services = await importTemplate(dir, servicesTemplate(nitro));
    await expect(services.later.fetch("req")).rejects.toThrow();
    writeFileSync(file, entries.named);
    expect(await services.later.fetch("req")).toBe("named:req");
  });

  it("is empty when no builder integration loads the services", () => {
    const nitro = { options: { services: { api: { entry: "./api.ts" } } } } as unknown as Nitro;
    expect(servicesTemplate(nitro)).toBe("export const services = {};");
  });
});
