import type { Nitro, PublicAsset } from "nitro/types";
import publicAssets from "../../src/build/virtual/public-assets.ts";

export type PublicAssetsLookup = {
  getAsset: (id: string) => PublicAsset | undefined;
  hasAsset: (id: string) => boolean;
  resolveAsset: (id: string, encodings: readonly string[]) => string | undefined;
  hasEncodedVariants: (id: string) => boolean;
  isPublicAssetURL: (id: string) => boolean;
  isPublicAssetBaseURL: (id: string) => boolean;
};

// Evaluate the generated `#nitro/virtual/public-assets` lookup helpers over a manifest
export function loadPublicAssets(
  assets: object,
  {
    dev = false,
    publicAssets: dirs = [],
    existsSync = () => true,
  }: {
    dev?: boolean;
    publicAssets?: { baseURL: string }[];
    existsSync?: (path: string) => boolean;
  } = {}
): PublicAssetsLookup {
  const nitro = {
    options: { dev, serveStatic: true, baseURL: "/", publicAssets: dirs },
  } as unknown as Nitro;
  const template = publicAssets(nitro).find((t) => t.id === "#nitro/virtual/public-assets")!
    .template as () => string;
  const body = template()
    .replace(/^\s*(import|export \{).*$/gm, "")
    .replace(/^export /gm, "");
  return new Function(
    "assets",
    "existsSync",
    `${body}\nreturn { getAsset, hasAsset, resolveAsset, hasEncodedVariants, isPublicAssetURL, isPublicAssetBaseURL };`
  )(assets, existsSync);
}
