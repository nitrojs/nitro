import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { join } from "pathe";
import { describe, expect, it } from "vitest";
import rendererTemplate from "../../src/build/virtual/renderer-template.ts";

function renderModule(opts: {
  html: string;
  dev?: boolean;
  static?: boolean;
  fetchService?: { from: string; name: string };
}) {
  const nitro = {
    options: {
      dev: !!opts.dev,
      builder: "rolldown",
      renderer: { template: "/app/index.html", static: opts.static },
    },
    _pageTemplate: { html: () => opts.html, fetchService: opts.fetchService },
  } as any;
  return rendererTemplate(nitro).template() as Promise<string>;
}

describe("renderer template", () => {
  const invalid = "<html><? if (true) { ?><body></body></html>";

  it("fails the build on template syntax errors, naming the template", async () => {
    await expect(renderModule({ html: invalid })).rejects.toThrow(
      /Invalid renderer template \(`.*index\.html`\): Template syntax error/
    );
  });

  // Other routes keep working in development: only the page fails
  it("throws on render in development for template syntax errors", async () => {
    const code = await renderModule({ html: invalid, dev: true });
    const dir = await mkdtemp(join(tmpdir(), "nitro-renderer-template-"));
    const file = join(dir, "renderer-template.mjs");
    await writeFile(file, code);
    const { rendererTemplate } = await import(pathToFileURL(file).href).finally(() =>
      rm(dir, { recursive: true, force: true })
    );
    expect(() => rendererTemplate()).toThrow(/Invalid renderer template.*Template syntax error/);
  });

  it("renders the ssr outlet with the service", async () => {
    const code = await renderModule({
      html: `<div id="app"><!--ssr-outlet--></div>`,
      fetchService: { from: "nitro/vite/runtime", name: "fetchViteEnv" },
    });
    expect(code).toContain(
      `import { fetchViteEnv as __nitro_fetchService__ } from "nitro/vite/runtime";`
    );
    expect(code).toContain(`__nitro_fetchService__("ssr", $REQUEST)`);
    expect(code).not.toContain("<!--ssr-outlet-->");
  });

  it("keeps the ssr outlet without a service", async () => {
    const code = await renderModule({ html: `<div id="app"><!--ssr-outlet--></div>` });
    expect(code).toContain("<!--ssr-outlet-->");
    expect(code).not.toContain("__nitro_fetchService__");
  });

  it("keeps static templates as is", async () => {
    const code = await renderModule({
      html: `<div id="app"><!--ssr-outlet--></div>`,
      static: true,
      fetchService: { from: "nitro/vite/runtime", name: "fetchViteEnv" },
    });
    expect(code).toContain("<!--ssr-outlet-->");
    expect(code).not.toContain("__nitro_fetchService__");
  });
});
