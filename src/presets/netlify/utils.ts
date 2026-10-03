import { existsSync, promises as fsp } from "node:fs";
import type { Nitro, PublicAssetDir } from "nitro/types";
import { join } from "pathe";
import { joinURL, withoutTrailingSlash } from "ufo";
import { escapeRegExp } from "../../utils/regex.ts";
import { routeToSplat, sortRoutes } from "../_utils/routes.ts";

export async function writeRedirects(nitro: Nitro) {
  let contents = "";

  // Most specific first, as the first matching rule wins
  for (const key of sortRoutes(Object.keys(nitro.options.routeRules))) {
    const redirect = nitro.options.routeRules[key].redirect;
    if (!redirect) {
      continue;
    }
    let code = redirect.status;
    // TODO: Remove map when netlify support 307/308
    if (code === 307) {
      code = 302;
    }
    if (code === 308) {
      code = 301;
    }
    const from = joinURL(nitro.options.baseURL, routeToSplat(key));
    contents += `${from}\t${redirect.to.replaceAll("**", ":splat")}\t${code}\n`;
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
    if (!routeRules.headers) {
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

  await writePublishFile(nitro, "_headers", contents);
}

export function getStaticPaths(publicAssets: PublicAssetDir[], baseURL: string): string[] {
  return [
    "/.netlify/*", // TODO: should this be also be prefixed with baseURL?
    ...publicAssets
      .filter((a) => a.fallthrough !== true && a.baseURL && a.baseURL !== "/")
      .map((a) => joinURL(baseURL, a.baseURL!, "*")),
  ];
}

// This is written to the functions directory. It just re-exports the compiled handler,
// along with its config. We do this instead of compiling the entrypoint directly because
// the Netlify platform actually statically analyzes the function file to read the config;
// if we compiled the entrypoint directly, it would be chunked and wouldn't be analyzable.
export function generateNetlifyFunction(nitro: Nitro) {
  return /* js */ `
export { default } from "./main.mjs";
export const config = {
  name: "server handler",
  generator: "${getGeneratorString(nitro)}",
  path: "/*",
  nodeBundler: "none",
  includedFiles: ["**"],
  excludedPath: ${JSON.stringify(getStaticPaths(nitro.options.publicAssets, nitro.options.baseURL))},
  preferStatic: true,
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

// Public assets are output to `dist/{{ baseURL }}`, unless `publicDir` is customized
function getPublishDir(nitro: Nitro) {
  const { publicDir } = nitro.options.output;
  const base = withoutTrailingSlash(nitro.options.baseURL);
  return base && publicDir.endsWith(base) ? publicDir.slice(0, -base.length) : publicDir;
}
