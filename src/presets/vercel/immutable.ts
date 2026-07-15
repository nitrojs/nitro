import { createHash } from "node:crypto";
import fsp from "node:fs/promises";
import { defu } from "defu";
import { glob } from "tinyglobby";
import { join, resolve } from "pathe";
import { joinURL, withLeadingSlash } from "ufo";
import type { Nitro, NitroRouteRules } from "nitro/types";
import { writeFile } from "../_utils/fs.ts";

// Immutable Static Files
//
// https://vercel.com/docs/build-output-api/primitives
//
// Immutable static files are content-addressed and shared across deployments which improves cross-deployment
// caching.
//
// Newer deployments must never overwrite an existing file with different content, so the file names embed a content hash.
//
// Alongside `.vercel/output/static`, we emit a `.vercel/output/immutable.json`
// manifest mapping each immutable static file to its full content hash (the file
// name may only contain a truncated hash).

const IMMUTABLE_MANIFEST = "immutable.json";

// Reserved Vercel namespace under which immutable static files are served.
// Used as the client `assetsDir` so content-addressed assets are emitted and
// referenced here, and served without the deployment-scoped `?dpl` query.
export const IMMUTABLE_DIR = "_vercel/immutable";

interface ImmutableManifest {
  version: 1;
  hashes: Record<string, string>;
}

export async function generateImmutableManifest(nitro: Nitro) {
  // `VERCEL_IMMUTABLE_DEPLOYMENT_ID` is set when a project opts in to immutable
  // static files. Skip generating the manifest otherwise.
  if (!process.env.VERCEL_IMMUTABLE_DEPLOYMENT_ID) {
    return;
  }

  // The salt is factored into the hashes to provide a way to rotate file names.
  const salt = process.env.VERCEL_HASH_SALT || "";

  const isImmutable = createImmutableMatcher(nitro);

  // Walk every emitted static file and hash the immutable (content-addressed)
  // ones. The output public dir already includes the site `baseURL`, so scanned
  // paths are relative to it.
  const publicDir = nitro.options.output.publicDir;
  const files = await glob("**", { cwd: publicDir, absolute: false, dot: true });

  const hashes: Record<string, string> = {};
  for (const file of files) {
    const pathname = withLeadingSlash(file);
    if (!isImmutable(pathname)) {
      continue;
    }
    const contents = await fsp.readFile(join(publicDir, file));
    const url = joinURL(nitro.options.baseURL, pathname);
    hashes[url] = hashContent(contents, salt);
  }

  const manifest: ImmutableManifest = { version: 1, hashes };
  await writeFile(
    resolve(nitro.options.output.dir, IMMUTABLE_MANIFEST),
    JSON.stringify(manifest, null, 2)
  );

  nitro.logger
    .withTag("vercel")
    .info(`Generated immutable manifest (${Object.keys(hashes).length} files).`);
}

// A static file is immutable when it is served with a long-lived `immutable`
// cache-control. That covers content-addressed bundler output emitted under an
// assets dir (marked via a route rule, e.g. Vite's `/assets/**`) as well as
// non-fallthrough public asset dirs, while excluding user-authored files in the
// fallthrough `public/` dir.
function createImmutableMatcher(nitro: Nitro): (pathname: string) => boolean {
  const immutableBaseURLs = nitro.options.publicAssets
    .filter((asset) => !asset.fallthrough)
    .map((asset) => withLeadingSlash(asset.baseURL || "/"))
    .filter((baseURL) => baseURL !== "/");

  const getRouteRules = (pathname: string) =>
    defu({}, ...nitro.routing.routeRules.matchAll("", pathname).reverse()) as NitroRouteRules;

  return (pathname: string) => {
    if (immutableBaseURLs.some((baseURL) => pathname.startsWith(baseURL + "/"))) {
      return true;
    }
    const cacheControl = getRouteRules(pathname).headers?.["cache-control"];
    return !!cacheControl && cacheControl.includes("immutable");
  };
}

// Full content hash, salted so file names can be rotated via `VERCEL_HASH_SALT`.
function hashContent(contents: Buffer, salt: string): string {
  return createHash("sha256").update(salt).update(contents).digest("base64url");
}
