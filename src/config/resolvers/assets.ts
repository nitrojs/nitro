import { existsSync } from "node:fs";
import { defu } from "defu";
import type { NitroOptions } from "nitro/types";
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
  // 2. Add server/ directory
  options.serverAssets.push({
    baseName: "server",
    dir: resolve(options.rootDir, "assets"),
  });

  // Infer `fallthrough` and `maxAge` from publicAssets
  for (const asset of options.publicAssets) {
    asset.baseURL = asset.baseURL || "/";
    const isTopLevel = asset.baseURL === "/";
    asset.fallthrough = asset.fallthrough ?? isTopLevel;
    const routeRule = options.routeRules[asset.baseURL + "/**"];
    asset.maxAge = (routeRule?.cache as { maxAge: number })?.maxAge ?? asset.maxAge ?? 0;
    if (asset.maxAge && !asset.fallthrough) {
      options.routeRules[asset.baseURL + "/**"] = defu(routeRule, {
        headers: {
          "cache-control": `public, max-age=${asset.maxAge}, immutable`,
        },
      });
    }
  }
}
