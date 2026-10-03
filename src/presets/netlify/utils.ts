import { existsSync, promises as fsp } from "node:fs";
import type { Nitro, PublicAssetDir } from "nitro/types";
import { join, resolve } from "pathe";
import { joinURL } from "ufo";
import { routeToSplat, sortRoutes } from "../_utils/routes.ts";

export async function writeRedirects(nitro: Nitro) {
  const redirectsPath = join(getPublishDir(nitro), "_redirects");

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

  if (existsSync(redirectsPath)) {
    const currentRedirects = await fsp.readFile(redirectsPath, "utf8");
    if (/^\/\* /m.test(currentRedirects)) {
      nitro.logger.info(
        "Not adding Nitro fallback to `_redirects` (as an existing fallback was found)."
      );
      return;
    }
    nitro.logger.info("Adding Nitro fallback to `_redirects` to handle all unmatched routes.");
    contents = currentRedirects + "\n" + contents;
  }

  await fsp.writeFile(redirectsPath, contents);
}

export async function writeHeaders(nitro: Nitro) {
  const headersPath = join(getPublishDir(nitro), "_headers");
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

  if (existsSync(headersPath)) {
    const currentHeaders = await fsp.readFile(headersPath, "utf8");
    if (/^\/\* /m.test(currentHeaders)) {
      nitro.logger.info(
        "Not adding Nitro fallback to `_headers` (as an existing fallback was found)."
      );
      return;
    }
    nitro.logger.info("Adding Nitro fallback to `_headers` to handle all unmatched routes.");
    contents = currentHeaders + "\n" + contents;
  }

  await fsp.writeFile(headersPath, contents);
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

// Netlify reads `_redirects` and `_headers` from the root of the publish
// directory, while public assets are output to `dist/{{ baseURL }}`.
function getPublishDir(nitro: Nitro) {
  return resolve(
    nitro.options.output.publicDir,
    "../".repeat(nitro.options.baseURL.split("/").filter(Boolean).length)
  );
}
