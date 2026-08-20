export default () => {
  // Embedded module text (sandbox/loader data). Must survive cloudflare output
  // rewrites of real `createRequire(import.meta.url)` call sites and bare
  // `import "node:*"` lines. See https://github.com/nitrojs/nitro/issues/4526
  const kit = {
    "h3.mjs": "const _require = createRequire(import.meta.url);\nexport default _require;",
  };
  const source = `foo
import "node:fs";
export const nitro4526marker = 1;`;
  return { keys: Object.keys(kit), source };
};
