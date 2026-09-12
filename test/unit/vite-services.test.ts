import { describe, expect, it } from "vitest";
import { viteServicesTemplate } from "../../src/build/vite/services.ts";
import type { NitroPluginContext } from "../../src/build/vite/types.ts";

describe("viteServicesTemplate", () => {
  it("renders dev template with getters accessing globalThis.__nitro_vite_envs__", () => {
    const ctx = {
      services: { ssr: { entry: "entry-server.ts" } },
      nitro: {
        options: {
          dev: true,
          buildDir: "/app/.nitro",
        },
      },
      _entryPoints: { ssr: "index.mjs" },
    } as unknown as NitroPluginContext;

    const code = viteServicesTemplate(ctx);
    expect(code).toContain('get ["ssr"]() { return globalThis.__nitro_vite_envs__["ssr"] }');
    expect(code).not.toContain("lazyService");
  });

  it("renders production template with lazyService passing service name", () => {
    const ctx = {
      services: {
        ssr: { entry: "entry-server.ts" },
        api: { entry: "entry-api.ts" },
      },
      nitro: {
        options: {
          dev: false,
          buildDir: "/app/.nitro",
        },
      },
      _entryPoints: { ssr: "index.mjs", api: "index.mjs" },
    } as unknown as NitroPluginContext;

    const code = viteServicesTemplate(ctx);
    expect(code).toContain("function lazyService(name, { loader })");
    expect(code).toContain('["ssr"]: lazyService("ssr", { loader: () => import(');
    expect(code).toContain('["api"]: lazyService("api", { loader: () => import(');
    expect(code).toContain('[nitro] Service "');
  });

  describe("lazyService runtime execution", () => {
    function evalServices(templateCode: string, loaders: Record<string, () => Promise<any>>) {
      const fn = new Function(
        "loaders",
        `
        ${templateCode.replace(/export const viteServices = \{[\s\S]*\};/, "")}
        return {
          ssr: lazyService("ssr", { loader: loaders.ssr }),
          api: loaders.api ? lazyService("api", { loader: loaders.api }) : undefined
        };
        `
      );
      return fn(loaders);
    }

    it("resolves default export with fetch handler", async () => {
      let called = 0;
      const ctx = {
        services: { ssr: {} },
        nitro: { options: { dev: false, buildDir: "/app/.nitro" } },
        _entryPoints: { ssr: "index.mjs" },
      } as unknown as NitroPluginContext;
      const code = viteServicesTemplate(ctx);

      const services = evalServices(code, {
        ssr: async () => {
          called++;
          return {
            default: {
              fetch: (req: Request) => new Response(`ok:${req.url}`),
            },
          };
        },
      });

      const res1 = await services.ssr.fetch(new Request("http://localhost/ssr"));
      expect(await res1.text()).toBe("ok:http://localhost/ssr");

      // Verifies caching on subsequent calls
      const res2 = await services.ssr.fetch(new Request("http://localhost/ssr2"));
      expect(await res2.text()).toBe("ok:http://localhost/ssr2");
      expect(called).toBe(1);
    });

    it("resolves named export fetch handler", async () => {
      const ctx = {
        services: { ssr: {} },
        nitro: { options: { dev: false, buildDir: "/app/.nitro" } },
        _entryPoints: { ssr: "index.mjs" },
      } as unknown as NitroPluginContext;
      const code = viteServicesTemplate(ctx);

      const services = evalServices(code, {
        ssr: async () => ({
          fetch: (req: Request) => new Response(`named:${req.url}`),
        }),
      });

      const res = await services.ssr.fetch(new Request("http://localhost/named"));
      expect(await res.text()).toBe("named:http://localhost/named");
    });

    it("falls back to named fetch export when default fetch is non-callable", async () => {
      const ctx = {
        services: { ssr: {} },
        nitro: { options: { dev: false, buildDir: "/app/.nitro" } },
        _entryPoints: { ssr: "index.mjs" },
      } as unknown as NitroPluginContext;
      const code = viteServicesTemplate(ctx);

      const services = evalServices(code, {
        ssr: async () => ({
          default: { fetch: "non-callable" },
          fetch: (req: Request) => new Response(`fallback:${req.url}`),
        }),
      });

      const res = await services.ssr.fetch(new Request("http://localhost/fallback"));
      expect(await res.text()).toBe("fallback:http://localhost/fallback");
    });

    it("prefers named fetch export over default export to align with dev-worker", async () => {
      const ctx = {
        services: { ssr: {} },
        nitro: { options: { dev: false, buildDir: "/app/.nitro" } },
        _entryPoints: { ssr: "index.mjs" },
      } as unknown as NitroPluginContext;
      const code = viteServicesTemplate(ctx);

      const services = evalServices(code, {
        ssr: async () => ({
          default: {
            fetch: (req: Request) => new Response(`default:${req.url}`),
          },
          fetch: (req: Request) => new Response(`named:${req.url}`),
        }),
      });

      const res = await services.ssr.fetch(new Request("http://localhost/both"));
      expect(await res.text()).toBe("named:http://localhost/both");
    });

    it("falls back to default fetch export when named fetch is non-callable", async () => {
      const ctx = {
        services: { ssr: {} },
        nitro: { options: { dev: false, buildDir: "/app/.nitro" } },
        _entryPoints: { ssr: "index.mjs" },
      } as unknown as NitroPluginContext;
      const code = viteServicesTemplate(ctx);

      const services = evalServices(code, {
        ssr: async () => ({
          default: {
            fetch: (req: Request) => new Response(`default:${req.url}`),
          },
          fetch: "non-callable",
        }),
      });

      const res = await services.ssr.fetch(new Request("http://localhost/fallback-default"));
      expect(await res.text()).toBe("default:http://localhost/fallback-default");
    });

    it("throws descriptive TypeError when service module lacks fetch handler", async () => {
      const ctx = {
        services: { ssr: {} },
        nitro: { options: { dev: false, buildDir: "/app/.nitro" } },
        _entryPoints: { ssr: "index.mjs" },
      } as unknown as NitroPluginContext;
      const code = viteServicesTemplate(ctx);

      const services = evalServices(code, {
        ssr: async () => ({
          default: {
            buildId: "xyz-123",
            renderPage: () => {},
            handleApiRoute: () => {},
          },
        }),
      });

      await expect(services.ssr.fetch(new Request("http://localhost/ssr"))).rejects.toThrowError(
        new TypeError(
          '[nitro] Service "ssr" does not export a `fetch` handler (expected `export default { fetch }` or `export function fetch`, got object with keys [buildId, renderPage, handleApiRoute]).'
        )
      );
    });

    it("throws descriptive TypeError for empty object exports", async () => {
      const ctx = {
        services: { ssr: {} },
        nitro: { options: { dev: false, buildDir: "/app/.nitro" } },
        _entryPoints: { ssr: "index.mjs" },
      } as unknown as NitroPluginContext;
      const code = viteServicesTemplate(ctx);

      const services = evalServices(code, {
        ssr: async () => ({ default: {} }),
      });

      await expect(services.ssr.fetch(new Request("http://localhost/ssr"))).rejects.toThrowError(
        new TypeError(
          '[nitro] Service "ssr" does not export a `fetch` handler (expected `export default { fetch }` or `export function fetch`, got empty object).'
        )
      );
    });

    it("throws descriptive TypeError for non-object exports", async () => {
      const ctx = {
        services: { ssr: {} },
        nitro: { options: { dev: false, buildDir: "/app/.nitro" } },
        _entryPoints: { ssr: "index.mjs" },
      } as unknown as NitroPluginContext;
      const code = viteServicesTemplate(ctx);

      const services = evalServices(code, {
        ssr: async () => null,
      });

      await expect(services.ssr.fetch(new Request("http://localhost/ssr"))).rejects.toThrowError(
        new TypeError(
          '[nitro] Service "ssr" does not export a `fetch` handler (expected `export default { fetch }` or `export function fetch`, got null).'
        )
      );
    });

    it("preserves `this` binding on exported service object", async () => {
      const ctx = {
        services: { ssr: {} },
        nitro: { options: { dev: false, buildDir: "/app/.nitro" } },
        _entryPoints: { ssr: "index.mjs" },
      } as unknown as NitroPluginContext;
      const code = viteServicesTemplate(ctx);

      const services = evalServices(code, {
        ssr: async () => ({
          default: {
            prefix: "hello:",
            fetch(req: Request) {
              return new Response(this.prefix + req.url);
            },
          },
        }),
      });

      const res = await services.ssr.fetch(new Request("http://localhost/test"));
      expect(await res.text()).toBe("hello:http://localhost/test");
    });

    it("truncates exported keys when more than 10 keys exist", async () => {
      const ctx = {
        services: { ssr: {} },
        nitro: { options: { dev: false, buildDir: "/app/.nitro" } },
        _entryPoints: { ssr: "index.mjs" },
      } as unknown as NitroPluginContext;
      const code = viteServicesTemplate(ctx);

      const keysObj: Record<string, number> = {};
      for (let i = 0; i < 15; i++) {
        keysObj[`k${i}`] = i;
      }

      const services = evalServices(code, {
        ssr: async () => ({ default: keysObj }),
      });

      await expect(services.ssr.fetch(new Request("http://localhost/ssr"))).rejects.toThrowError(
        new TypeError(
          '[nitro] Service "ssr" does not export a `fetch` handler (expected `export default { fetch }` or `export function fetch`, got object with keys [k0, k1, k2, k3, k4, k5, k6, k7, k8, k9...]).'
        )
      );
    });
  });
});
