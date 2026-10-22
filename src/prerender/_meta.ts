import type { Nitro } from "nitro/types";

export type PrerenderMeta = Record<string, { contentType?: string }>;

const prerenderMetas = new WeakMap<Nitro, PrerenderMeta>();

export function getPrerenderMeta(nitro: Nitro): PrerenderMeta {
  let meta = prerenderMetas.get(nitro);
  if (!meta) {
    meta = {};
    prerenderMetas.set(nitro, meta);
  }
  return meta;
}
