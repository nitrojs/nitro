# Vite + RSC

This example shows how to setup a React application with [Server Component](https://react.dev/reference/rsc/server-components) features on Vite using [`@vitejs/plugin-rsc`](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-rsc).

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/vitejs/vite-plugin-react/tree/main/packages/plugin-rsc/examples/starter)

```sh
# run dev server
npm run dev

# build for production and preview
npm run build
npm run preview
```

## API usages

See [`@vitejs/plugin-rsc`](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-rsc) for the documentation.

- [`vite.config.ts`](./vite.config.ts)
  - `@higoawa/vite-rsc/plugin`
- [`./src/framework/entry.rsc.tsx`](./src/framework/entry.rsc.tsx)
  - `@vitejs/plugin-rsc/rsc`
  - `import.meta.viteRsc.loadModule`
- [`./src/framework/entry.ssr.tsx`](./src/framework/entry.ssr.tsx)
  - `@vitejs/plugin-rsc/ssr`
  - `import.meta.viteRsc.loadBootstrapScriptContent`
  - `rsc-html-stream/server`
- [`./src/framework/entry.browser.tsx`](./src/framework/entry.browser.tsx)
  - `@vitejs/plugin-rsc/browser`
  - `rsc-html-stream/client`

## Notes

- [`./src/framework/entry.{browser,rsc,ssr}.tsx`](./src/framework) (with inline comments) provides an overview of how low level RSC (React flight) API can be used to build RSC framework.
- You can use [`vite-plugin-inspect`](https://github.com/antfu-collective/vite-plugin-inspect) to understand how `"use client"` and `"use server"` directives are transformed internally.

## Deployment

See [vite-plugin-rsc-deploy-example](https://github.com/hi-ogawa/vite-plugin-rsc-deploy-example)
