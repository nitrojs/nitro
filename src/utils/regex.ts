import { isWindows } from "std-env";

/**
 * Extensions that strongly indicate a browser asset load (script/style/font/image/media), used by
 * dev servers when `Sec-Fetch-Dest` is absent (plain-HTTP non-loopback origins). Kept narrow on
 * purpose so that arbitrary dotted Nitro route params (e.g. `.../foo.bar.1`) keep reaching Nitro.
 */
export const ASSET_EXT_RE =
  /^(?:[jt]sx?|mjs|cjs|css|s[ac]ss|less|styl|vue|svelte|astro|mdx?|map|wasm|png|jpe?g|gif|svg|webp|avif|ico|bmp|woff2?|ttf|otf|eot|mp[34]|webm|wav|ogg|m4a)$/i;

export function escapeRegExp(string: string): string {
  return string.replace(/[-\\^$*+?.()|[\]{}]/g, String.raw`\$&`);
}

export function pathRegExp(string: string): string {
  if (isWindows) {
    string = string.replace(/\\/g, "/");
  }
  let escaped = escapeRegExp(string);
  if (isWindows) {
    escaped = escaped.replace(/\//g, String.raw`[/\\]`);
  }
  return escaped;
}

export function toPathRegExp(input: string | RegExp): RegExp {
  if (input instanceof RegExp) {
    return input;
  }
  if (typeof input === "string") {
    return new RegExp(pathRegExp(input));
  }
  throw new TypeError("Expected a string or RegExp", { cause: input });
}
