// Based on https://github.com/hi-ogawa/vite-plugin-fullstack/blob/main/types/query.d.ts

type ImportAssetsResult = ImportAssetsResultRaw & {
  merge(...args: ImportAssetsResultRaw[]): ImportAssetsResult;
};

type ImportAssetsResultRaw = {
  entry?: string;
  js: { href: string }[];
  css: { href: string; "data-vite-dev-id"?: string }[];
};

declare module "*?assets" {
  const assets: ImportAssetsResult;
  export default assets;
}

declare module "*?assets=client" {
  const assets: ImportAssetsResult;
  export default assets;
}

declare module "*?assets=ssr" {
  const assets: ImportAssetsResult;
  export default assets;
}
