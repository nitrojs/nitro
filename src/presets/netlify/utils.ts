import { existsSync, promises as fsp } from "node:fs";
import type { Nitro, PublicAssetDir } from "nitro/types";
import { dirname, join } from "pathe";
import { joinURL, withoutTrailingSlash } from "ufo";
import { escapeRegExp } from "../../utils/regex.ts";
import { isPrefixedPublicAssetDir } from "../../config/resolvers/assets.ts";
import { getPublicAssetCorsHeaders } from "../_utils/cors.ts";
import {
  findShadowedRoute,
  hasHeaders,
  routeToSplat,
  skipUnsupportedRoute,
  sortRoutes,
} from "../_utils/routes.ts";

export async function writeRedirects(nitro: Nitro) {
  let contents = "";

  // Most specific first, as the first matching rule wins
  const routes = sortRoutes(Object.keys(nitro.options.routeRules));
  const redirects = routes.filter((key) => nitro.options.routeRules[key].redirect);
  const optOuts = routes.filter((key) => nitro.options.routeRules[key].redirect === false);
  for (const key of routes) {
    const redirect = nitro.options.routeRules[key].redirect;
    if (
      !redirect ||
      skipUnsupportedRoute(nitro, { route: key, file: "_redirects", routes: redirects })
    ) {
      continue;
    }
    let code = redirect.status;
    // TODO: Remove map when netlify support 307/308
    // Netlify _redirects currently only supports 301, 302, 404, 200.
    // Tracking: https://docs.netlify.com/manage/routing/redirects/redirect-options/
    if (code === 307) {
      code = 302;
    }
    if (code === 308) {
      code = 301;
    }
    const from = joinURL(nitro.options.baseURL, routeToSplat(key));
    const to = redirect.to.replaceAll("**", ":splat");
    const force = shouldForceRedirect(nitro, { route: key, from, to, optOuts });
    contents += `${from}\t${to}\t${code}${force ? "!" : ""}\n`;
  }

  if (nitro.options.static && existsSync(join(nitro.options.output.publicDir, "404.html"))) {
    contents += `${joinURL(nitro.options.baseURL, "/*")} ${joinURL(nitro.options.baseURL, "/404.html")} 404`;
  }

  await writePublishFile(nitro, "_redirects", contents);
}

export async function writeHeaders(nitro: Nitro) {
  let contents = "";

  for (const path of sortRoutes(Object.keys(nitro.options.routeRules))) {
    const routeRules = nitro.options.routeRules[path];
    if (!hasHeaders(routeRules) || skipUnsupportedRoute(nitro, { route: path, file: "_headers" })) {
      continue;
    }
    const headers = [
      joinURL(nitro.options.baseURL, routeToSplat(path)),
      ...Object.entries({ ...routeRules.headers }).map(
        ([header, value]) => `  ${header}: ${value}`
      ),
    ].join("\n");

    contents += headers + "\n";
  }

  const userHeadersPath = join(nitro.options.output.publicDir, "_headers");
  const headersFile = existsSync(userHeadersPath)
    ? await fsp.readFile(userHeadersPath, "utf8")
    : undefined;
  for (const { base, headers } of getPublicAssetCorsHeaders(nitro, { headersFile })) {
    contents +=
      [
        joinURL(nitro.options.baseURL, base, "*"),
        ...Object.entries(headers).map(([header, value]) => `  ${header}: ${value}`),
      ].join("\n") + "\n";
  }

  await writePublishFile(nitro, "_headers", contents);
}

export async function writeConfig(nitro: Nitro, configPath: string) {
  const netlify = nitro.options.netlify;
  if (Object.keys(netlify?.config || {}).length === 0) {
    await fsp.rm(configPath, { force: true });
    return;
  }
  await fsp.mkdir(dirname(configPath), { recursive: true });
  await fsp.writeFile(configPath, JSON.stringify(netlify!.config), "utf8");
}

// `/.netlify/*` is reserved for Netlify's own functions and services.
// TODO: should this be also be prefixed with baseURL?
const netlifyPaths = ["/.netlify/*"];

export function getStaticPaths(publicAssets: PublicAssetDir[], baseURL: string): string[] {
  return [
    ...netlifyPaths,
    ...publicAssets.filter(isPrefixedPublicAssetDir).map((a) => joinURL(baseURL, a.baseURL, "*")),
  ];
}

// This is written to the (edge) functions directory. It just re-exports the compiled handler,
// along with its config. We do this instead of compiling the entrypoint directly because
// the Netlify platform actually statically analyzes the function file to read the config;
// if we compiled the entrypoint directly, it would be chunked and wouldn't be analyzable.
//
// Public asset dirs are intentionally not excluded from the server function: with
// `preferStatic`, existing assets are still served by the CDN, while missing ones
// reach the function, which answers them with a `no-store` 404. Excluding them would
// make Netlify answer with its own 404 page, served with the `_headers` rules of the
// asset dir (https://github.com/nitrojs/nitro/issues/5035).
export function generateNetlifyFunction(nitro: Nitro) {
  return /* js */ `
export { default } from "./main.mjs";
export const config = {
  name: "server handler",
  generator: "${getGeneratorString(nitro)}",
  path: "/*",
  nodeBundler: "none",
  includedFiles: ["**"],
  excludedPath: ${JSON.stringify(netlifyPaths)},
  preferStatic: true,
};
    `.trim();
}

export function generateNetlifyEdgeFunction(nitro: Nitro) {
  return /* js */ `
export { default } from "./main.mjs";
export const config = {
  name: "edge server handler",
  generator: "${getGeneratorString(nitro)}",
  path: "/*",
  excludedPath: ${JSON.stringify(getStaticPaths(nitro.options.publicAssets, nitro.options.baseURL))},
};
    `.trim();
}

export function getGeneratorString(nitro: Nitro) {
  return `${nitro.options.framework.name}@${nitro.options.framework.version}`;
}

/**
 * Write `_redirects` or `_headers` to the root of the publish directory, where
 * Netlify reads them, merged after the user's own file from `public/`.
 *
 * Public assets are output to `dist/{{ baseURL }}`, so with a baseURL the
 * user's file is read from there and moved to the root. The root copy itself
 * is never read: it is the output of a previous build.
 */
async function writePublishFile(nitro: Nitro, name: "_redirects" | "_headers", contents: string) {
  const sourcePath = join(nitro.options.output.publicDir, name);
  const targetPath = join(getPublishDir(nitro), name);

  if (existsSync(sourcePath)) {
    const current = await fsp.readFile(sourcePath, "utf8");
    if (sourcePath !== targetPath) {
      await fsp.rm(sourcePath);
    }
    const fallbackRE = new RegExp(
      `^(?:/|${escapeRegExp(joinURL(nitro.options.baseURL, "/"))})\\* `,
      "m"
    );
    if (fallbackRE.test(current)) {
      nitro.logger.info(
        `Not adding Nitro fallback to \`${name}\` (as an existing fallback was found).`
      );
      contents = current;
    } else {
      nitro.logger.info(`Adding Nitro fallback to \`${name}\` to handle all unmatched routes.`);
      contents = current + "\n" + contents;
    }
  }

  await fsp.writeFile(targetPath, contents);
}

/**
 * Whether to force (`!`) a `_redirects` rule, so that Netlify also redirects
 * where a file exists (prerendered routes, public assets), like the runtime
 * that applies route rules first. Not forced:
 * - when a more specific rule opts out with `redirect: false`, as a file there
 *   would be redirected too: Netlify cannot exclude a path from a splat rule.
 * - when the target is the same path with or without a trailing slash, which
 *   Netlify matches as the same path, as it would redirect in a loop.
 */
function shouldForceRedirect(
  nitro: Nitro,
  opts: { route: string; from: string; to: string; optOuts: string[] }
): boolean {
  if (withoutTrailingSlash(opts.from) === withoutTrailingSlash(opts.to)) {
    return false;
  }
  const optOut = findShadowedRoute(opts.route, opts.optOuts);
  if (optOut) {
    nitro.logger.warn(
      `Not forcing route rule \`${opts.route}\` in \`_redirects\`, as the route rule \`${optOut}\` opts out of it. Netlify serves files matching it instead of redirecting.`
    );
    return false;
  }
  return true;
}

// Public assets are output to `dist/{{ baseURL }}`, unless `publicDir` is customized
function getPublishDir(nitro: Nitro) {
  const publicDir = withoutTrailingSlash(nitro.options.output.publicDir);
  const base = withoutTrailingSlash(nitro.options.baseURL);
  return base && publicDir.endsWith(base) ? publicDir.slice(0, -base.length) : publicDir;
}
