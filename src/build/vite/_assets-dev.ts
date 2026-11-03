// Ported from @hiogawa/vite-plugin-fullstack (MIT License, Copyright (c) 2024 Hiroshi Ogawa)

import type {
  DevEnvironment,
  EnvironmentModuleNode,
  ResolvedConfig,
  ViteDevServer,
  Plugin as VitePlugin,
} from "vite";
import { existsSync } from "node:fs";
import { isAbsolute, join } from "pathe";
import type { AssetsResult } from "../_assets-import.ts";

const CSS_LANGS_RE = /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/;
const SPECIAL_CSS_QUERY_RE = /[?&](url|inline|raw)(\b|=|&|$)/;
const ASSETS_QUERY_RE = /[?&]assets(?:[=&]|$)/;
const DIRECT_REQUEST_RE = /(\?|&)direct=?(?:&|$)/;

/** Dev urls of an `?assets` import: the client entry, or the css imported by a server module. */
export async function collectDevAssets(
  server: ViteDevServer,
  config: ResolvedConfig,
  id: string,
  environmentName: string
): Promise<AssetsResult> {
  const environment = server.environments[environmentName];
  if (!environment) {
    throw new Error(
      `Unknown environment \`${environmentName}\` in the \`?assets=${environmentName}\` import of \`${id}\`.`
    );
  }
  if (environmentName === "client") {
    return { entry: config.base + toDevUrl(environment, id).slice(1), js: [], css: [] };
  }
  const css = await collectCss(environment, id);
  return {
    js: [],
    css: css.map((cssId) => ({
      href: config.base + toDevUrl(environment, cssId).slice(1),
      "data-vite-dev-id": cssId,
    })),
  };
}

/** Dev server patches so that collected css `<link>` tags are updated by HMR. */
export function nitroAssetsDevPatches(): VitePlugin[] {
  let viteClientPath: string | undefined;
  return [
    {
      name: "nitro:assets-import:vite-client",
      apply: "serve",
      configResolved(config) {
        viteClientPath = _viteClientPath(config);
      },
      transform: {
        filter: { id: /\/dist\/client\/client\.mjs$/ },
        handler(code, id) {
          if (id !== viteClientPath || code.includes("linkSheetsMap")) {
            return;
          }
          return _patchViteClient(code);
        },
      },
    },
    {
      name: "nitro:assets-import:css-link-self-accept",
      apply: "serve",
      transform: {
        order: "post",
        handler(_code, id) {
          const env = this.environment;
          if (
            env.name === "client" &&
            env.mode === "dev" &&
            isCSSRequest(id) &&
            DIRECT_REQUEST_RE.test(id)
          ) {
            const mod = env.moduleGraph.getModuleById(id);
            if (mod && !mod.isSelfAccepting) {
              mod.isSelfAccepting = true;
            }
          }
        },
      },
    },
    {
      // Vue scoped css urls (`?vue&type=style&...&lang.css`) collected for `<link>` tags
      name: "nitro:assets-import:vue-scoped-css",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.headers.accept?.includes("text/css") && req.url?.includes("&lang.css=")) {
            req.url = req.url.replace("&lang.css=", "?lang.css");
          }
          next();
        });
      },
    },
    {
      name: "nitro:assets-import:hot-update",
      apply: "serve",
      hotUpdate(ctx) {
        if (this.environment.name !== "rsc") {
          return;
        }
        for (const mod of _collectImporters(ctx.modules)) {
          if (!mod.id) {
            continue;
          }
          for (const query of ["assets", "assets=client", `assets=${this.environment.name}`]) {
            const assetsMod = this.environment.moduleGraph.getModuleById(`${mod.id}?${query}`);
            if (assetsMod) {
              this.environment.moduleGraph.invalidateModule(assetsMod);
            }
          }
        }
      },
    },
  ];
}

function isCSSRequest(id: string): boolean {
  return CSS_LANGS_RE.test(id);
}

async function collectCss(environment: DevEnvironment, entryId: string): Promise<string[]> {
  const visited = new Set<string>();
  const cssIds = new Set<string>();
  async function recurse(id: string) {
    if (visited.has(id) || ASSETS_QUERY_RE.test(id)) {
      return;
    }
    visited.add(id);
    let mod = environment.moduleGraph.getModuleById(id);
    // The target module may not be loaded yet by its environment
    if (!mod?.transformResult) {
      try {
        await environment.transformRequest(id);
      } catch (error) {
        console.error(`[nitro] Failed to transform \`${id}\` to collect its css`, error);
      }
      mod = environment.moduleGraph.getModuleById(id);
    }
    if (!mod) {
      return;
    }
    for (const next of mod.importedModules) {
      if (!next.id) {
        continue;
      }
      if (isCSSRequest(next.id)) {
        if (!SPECIAL_CSS_QUERY_RE.test(next.id)) {
          cssIds.add(next.id);
        }
      } else {
        await recurse(next.id);
      }
    }
  }
  await recurse(entryId);
  return [...cssIds];
}

/** Url of a module as rewritten by Vite's import analysis. */
function toDevUrl(environment: DevEnvironment, id: string): string {
  const root = environment.config.root;
  let url: string;
  if (id.startsWith(root.endsWith("/") ? root : `${root}/`)) {
    url = id.slice(root.length);
  } else if (
    environment.depsOptimizer?.isOptimizedDepFile(id) ||
    (id !== "/@react-refresh" && isAbsolute(id) && existsSync(id.replace(/[?#].*$/, "")))
  ) {
    url = join("/@fs/", id);
  } else {
    url = id;
  }
  if (url[0] !== "." && url[0] !== "/") {
    url = id.startsWith("/@id/") ? id : "/@id/" + id.replace("\0", "__x00__");
  }
  if (environment.config.consumer === "client") {
    const mod = environment.moduleGraph.getModuleById(id);
    if (mod && mod.lastHMRTimestamp > 0) {
      url = _injectQuery(url, `t=${mod.lastHMRTimestamp}`);
    }
  }
  return url;
}

function _injectQuery(url: string, query: string): string {
  const file = url.replace(/[?#].*$/, "");
  const postfix = url.slice(file.length);
  return `${file}?${query}${postfix[0] === "?" ? `&${postfix.slice(1)}` : postfix}`;
}

function _collectImporters(mods: EnvironmentModuleNode[]): Set<EnvironmentModuleNode> {
  const visited = new Set<EnvironmentModuleNode>();
  const recurse = (mod: EnvironmentModuleNode) => {
    if (!visited.has(mod)) {
      visited.add(mod);
      mod.importers.forEach(recurse);
    }
  };
  mods.forEach(recurse);
  return visited;
}

/** Vite aliases `/@vite/client` to `/@fs/<vite package>/dist/client/client.mjs`. */
function _viteClientPath(config: ResolvedConfig): string | undefined {
  for (const { replacement } of config.resolve?.alias || []) {
    const path = /^\/@fs\/(.+\/dist\/client\/client\.mjs)$/.exec(replacement)?.[1];
    if (path) {
      return /^[a-z]:\//i.test(path) ? path : `/${path}`;
    }
  }
}

/** Let HMR update and remove the collected css `<link data-vite-dev-id>` tags. */
function _patchViteClient(code: string): string | undefined {
  const sheetsMap = code.indexOf("const sheetsMap");
  const updateStyle = _endIndexOf(code, "function updateStyle(id, content) {");
  const removeStyle = _endIndexOf(code, "function removeStyle(id) {");
  if (sheetsMap === -1 || !(sheetsMap < updateStyle && updateStyle < removeStyle)) {
    return;
  }
  return (
    code.slice(0, sheetsMap) +
    /* js */ `const linkSheetsMap = new Map();
document
  .querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]')
  .forEach((el) => linkSheetsMap.set(el.getAttribute('data-vite-dev-id'), el));
` +
    code.slice(sheetsMap, updateStyle) +
    `if (linkSheetsMap.has(id)) { return }` +
    code.slice(updateStyle, removeStyle) +
    /* js */ `
const link = linkSheetsMap.get(id);
if (link) {
  document
    .querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]')
    .forEach((el) => {
      if (el.getAttribute('data-vite-dev-id') === id) {
        el.remove()
      }
    })
  linkSheetsMap.delete(id)
}
` +
    code.slice(removeStyle)
  );
}

function _endIndexOf(code: string, search: string): number {
  const index = code.lastIndexOf(search);
  return index === -1 ? index : index + search.length;
}
