// Native rolldown bindings when available, the portable wasm build (oxbox) otherwise
const oxc = await import("rolldown/utils").catch(() => import("oxbox"));

/** @type {typeof import("oxbox").parse} */
export const parse = oxc.parse;

/** @type {typeof import("oxbox").parseSync} */
export const parseSync = oxc.parseSync;
