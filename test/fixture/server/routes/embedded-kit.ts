import { createRequire } from "node:module";

export default () => {
  // Embedded module text (sandbox/loader data). Must survive cloudflare output
  // rewrites of real `createRequire(import.meta.url)` call sites and bare
  // `import "node:*"` lines. See https://github.com/nitrojs/nitro/issues/4526
  const kit = {
    "h3.mjs": "const _require = createRequire(import.meta.url);\nexport default _require;",
  };
  const source = `foo
import "node:fs";
export const nitro4526marker = 1;
const _require = createRequire(import.meta.url);`;

  // Regex literals holding quotes and `/` pairs desync text scanners, and a real
  // call site in the same chunk must still be guarded on workers.
  // See https://github.com/nitrojs/nitro/issues/4132
  const escape = (s: string) => s.replace(/<\//g, "<\\/").replace(/['"]/g, "");
  const _require = createRequire(import.meta.url);

  return {
    keys: Object.keys(kit),
    values: Object.values(kit),
    source,
    escaped: escape(`</script> "quoted"`),
    require: typeof _require,
  };
};
