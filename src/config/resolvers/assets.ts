import { existsSync } from "node:fs";
import { defu } from "defu";
import type { NitroOptions, PublicAssetDir } from "nitro/types";
import { resolve } from "pathe";
import { withLeadingSlash, withoutTrailingSlash } from "ufo";

export async function resolveAssetsOptions(options: NitroOptions) {
  // Public Assets
  // 1. Normalize user paths
  for (const publicAsset of options.publicAssets) {
    publicAsset.dir = resolve(options.rootDir, publicAsset.dir);
    publicAsset.baseURL = withLeadingSlash(withoutTrailingSlash(publicAsset.baseURL || "/"));
  }
  // 2. Add public/ directories from each layer
  for (const dir of [options.rootDir, ...options.scanDirs]) {
    const publicDir = resolve(dir, "public");
    if (!existsSync(publicDir)) {
      continue;
    }
    if (options.publicAssets.some((asset) => asset.dir === publicDir)) {
      continue;
    }
    options.publicAssets.push({ dir: publicDir } as any);
  }

  // Server Assets
  // 1. Normalize user paths
  for (const serverAsset of options.serverAssets) {
    serverAsset.dir = resolve(options.rootDir, serverAsset.dir);
  }
  // 2. Add <serverDir>/assets directory
  options.serverAssets.push({
    baseName: "server",
    dir: resolve(options.serverDir || options.rootDir, "assets"),
  });

  resolvePublicAssetsRouteRules(options);
}

export function resolvePublicAssetsRouteRules(
  options: Pick<NitroOptions, "publicAssets" | "routeRules">
) {
  // Infer `fallthrough` and `maxAge` from publicAssets
  for (const asset of options.publicAssets) {
    asset.baseURL = asset.baseURL || "/";
    const isTopLevel = asset.baseURL === "/";
    asset.fallthrough = asset.fallthrough ?? isTopLevel;
    const routeRule = options.routeRules[asset.baseURL + "/**"];
    asset.maxAge = (routeRule?.cache as { maxAge: number })?.maxAge ?? asset.maxAge;
    if (asset.maxAge && !asset.fallthrough) {
      options.routeRules[asset.baseURL + "/**"] = defu(routeRule, {
        headers: {
          "cache-control": `public, max-age=${asset.maxAge}, immutable`,
        },
      });
    }
  }
}

/**
 * Adds the immutable `cache-control` rule of a hashed client assets dir,
 * unless a route rule sets its own `cache-control` (or `headers: false`).
 */
export function addClientAssetsRouteRule(routeRules: NitroOptions["routeRules"], baseURL: string) {
  const rule = (routeRules[`${baseURL}/**`] ??= {});
  const immutable = rule.headers !== false && !rule.headers?.["cache-control"];
  if (immutable) {
    rule.headers = { ...rule.headers, "cache-control": "public, max-age=31536000, immutable" };
  }
  return immutable;
}

/**
 * Whether a public asset dir serves a base URL other than `/` on its own (without
 * `fallthrough`): requests under it that match none of its files are not passed to the app.
 */
export function isPrefixedPublicAssetDir(
  dir: PublicAssetDir
): dir is PublicAssetDir & { baseURL: string } {
  return !dir.fallthrough && !!dir.baseURL && dir.baseURL !== "/";
}
