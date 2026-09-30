import { existsSync, promises as fsp } from "node:fs";
import type { Nitro, PublicAssetDir } from "nitro/types";
import { basename, join } from "pathe";
import { joinURL, withoutLeadingSlash, withoutTrailingSlash } from "ufo";

// Netlify only reads `_headers` and `_redirects` from the publish directory root,
// while public assets are written to `<publish dir>/<baseURL>`.
function getPublishDir(nitro: Nitro) {
  const publicDir = withoutTrailingSlash(nitro.options.output.publicDir);
  const base = withoutLeadingSlash(withoutTrailingSlash(nitro.options.baseURL));
  return base && publicDir.endsWith(`/${base}`) ? publicDir.slice(0, -base.length - 1) : publicDir;
}

// User `_headers`/`_redirects` files are copied with the public assets into
// `publicDir`, below the publish root when `baseURL` is set, so read them from both.
async function readExistingFile(nitro: Nitro, publishPath: string) {
  const publicPath = join(nitro.options.output.publicDir, basename(publishPath));
  const paths = publicPath === publishPath ? [publishPath] : [publishPath, publicPath];
  const files = await Promise.all(
    paths.filter((path) => existsSync(path)).map((path) => fsp.readFile(path, "utf8"))
  );
  return files.length > 0 ? { contents: files.join("\n"), merged: paths.length > 1 } : undefined;
}

export async function writeRedirects(nitro: Nitro) {
  const redirectsPath = join(getPublishDir(nitro), "_redirects");

  let contents = "";
  if (nitro.options.static) {
    const staticFallback = existsSync(join(nitro.options.output.publicDir, "404.html"))
      ? `${joinURL(nitro.options.baseURL, "/*")} ${joinURL(nitro.options.baseURL, "/404.html")} 404`
      : "";
    contents += staticFallback;
  }

  const rules = Object.entries(nitro.options.routeRules).sort(
    (a, b) => a[0].split(/\/(?!\*)/).length - b[0].split(/\/(?!\*)/).length
  );

  for (const [key, routeRules] of rules) {
    const redirect = routeRules.redirect;
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
    contents =
      `${joinURL(nitro.options.baseURL, key.replace("/**", "/*"))}\t${redirect.to.replace("**", ":splat")}\t${code}\n` +
      contents;
  }

  const existing = await readExistingFile(nitro, redirectsPath);
  if (existing) {
    const currentRedirects = existing.contents;
    if (/^\/\* /m.test(currentRedirects)) {
      nitro.logger.info(
        "Not adding Nitro fallback to `_redirects` (as an existing fallback was found)."
      );
      if (existing.merged) {
        await fsp.writeFile(redirectsPath, currentRedirects);
      }
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

  const rules = Object.entries(nitro.options.routeRules).sort(
    (a, b) => b[0].split(/\/(?!\*)/).length - a[0].split(/\/(?!\*)/).length
  );

  for (const [path, routeRules] of rules.filter(([_, routeRules]) => routeRules.headers)) {
    const headers = [
      joinURL(nitro.options.baseURL, path.replace("/**", "/*")),
      ...Object.entries({ ...routeRules.headers }).map(
        ([header, value]) => `  ${header}: ${value}`
      ),
    ].join("\n");

    contents += headers + "\n";
  }

  const existing = await readExistingFile(nitro, headersPath);
  if (existing) {
    const currentHeaders = existing.contents;
    if (/^\/\* /m.test(currentHeaders)) {
      nitro.logger.info(
        "Not adding Nitro fallback to `_headers` (as an existing fallback was found)."
      );
      if (existing.merged) {
        await fsp.writeFile(headersPath, currentHeaders);
      }
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
