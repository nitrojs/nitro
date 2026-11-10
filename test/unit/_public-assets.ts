import type { Nitro, PublicAsset } from "nitro/types";
import publicAssets from "../../src/build/virtual/public-assets.ts";

export type PublicAssetsLookup = {
  getAsset: (id: string) => PublicAsset | undefined;
  hasAsset: (id: string) => boolean;
  resolveAsset: (id: string, encodings: readonly string[]) => string | undefined;
  isPublicAssetURL: (id: string) => boolean;
  isPublicAssetBaseURL: (id: string) => boolean;
};

// Evaluate the generated `#nitro/virtual/public-assets` lookup helpers over a manifest
export function loadPublicAssets(
  assets: object,
  { publicAssets: dirs = [] }: { publicAssets?: { baseURL: string }[] } = {}
): PublicAssetsLookup {
  const nitro = {
    options: { serveStatic: true, baseURL: "/", publicAssets: dirs },
  } as unknown as Nitro;
  const template = publicAssets(nitro).find((t) => t.id === "#nitro/virtual/public-assets")!
    .template as () => string;
  const body = template()
    .replace(/^\s*(import|export \{).*$/gm, "")
    .replace(/^export /gm, "");
  return new Function(
    "assets",
    `${body}\nreturn { getAsset, hasAsset, resolveAsset, isPublicAssetURL, isPublicAssetBaseURL };`
  )(assets);
}
