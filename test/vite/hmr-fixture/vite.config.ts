import { defineConfig, type Plugin } from "vite";
import { nitro } from "nitro/vite";

/**
 * Simulates an asset-collecting plugin (e.g. vite-plugin-solid's `?assets`
 * crawl) that transforms a module's dependencies as a side effect of
 * transforming the module itself. This repopulates the dependency's
 * `transformResult` on the Vite side before the reloading dev worker's
 * module runner re-fetches it, so `fetchModule` answers `{cache: true}` —
 * the runner then reuses its stale evaluation unless the dev worker cleared
 * its evaluated modules when reloading.
 */
function depCrawler(): Plugin {
  return {
    name: "test:dep-crawler",
    async transform(_code, id) {
      if (id.endsWith("api/crawled.ts") && this.environment.mode === "dev") {
        await this.environment.transformRequest("/dep.ts");
      }
    },
  };
}

/**
 * Simulates a framework plugin that hard-invalidates the whole server module
 * graph on edits (a common workaround for SSR staleness). Hard invalidation
 * makes transform hooks re-run — which is what lets `depCrawler` above
 * repopulate `dep.ts`'s transform during the reload. Scoped to `dep.ts`
 * edits so the other HMR tests are unaffected.
 */
function serverGraphInvalidator(): Plugin {
  return {
    name: "test:server-graph-invalidator",
    hotUpdate({ file }) {
      if (file.endsWith("dep.ts") && this.environment.config.consumer !== "client") {
        this.environment.moduleGraph.invalidateAll();
      }
    },
  };
}

export default defineConfig({
  plugins: [nitro({ serverDir: "./" }), depCrawler(), serverGraphInvalidator()],
});
