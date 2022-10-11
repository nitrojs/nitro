import { promises as fsp } from 'fs'
import { resolve } from 'pathe'
import { describe, it, expect } from 'vitest'
import { EdgeRuntime } from 'edge-runtime'
import { setupTest, startServer, testNitro } from '../tests'

describe('nitro:preset:vercel', async () => {
  const ctx = await setupTest('vercel')
  testNitro(ctx, async () => {
    const handle = await import(resolve(ctx.outDir, 'functions/__nitro.func/index.mjs'))
      .then(r => r.default || r)
    await startServer(ctx, handle)
    return async ({ url }) => {
      const res = await ctx.fetch(url)
      return res
    }
  })
  it('should add route rules to config', async () => {
    const config = await fsp.readFile(resolve(ctx.outDir, 'config.json'), 'utf-8')
      .then(r => JSON.parse(r))
    expect(config).toMatchInlineSnapshot(`
      {
        "overrides": {
          "api/param/foo.json/index.html": {
            "path": "api/param/foo.json",
          },
          "api/param/prerender1/index.html": {
            "path": "api/param/prerender1",
          },
          "api/param/prerender2/index.html": {
            "path": "api/param/prerender2",
          },
          "api/param/prerender3/index.html": {
            "path": "api/param/prerender3",
          },
          "prerender/index.html": {
            "path": "prerender",
          },
        },
        "routes": [
          {
            "headers": {
              "cache-control": "s-maxage=60",
            },
            "src": "/rules/headers",
          },
          {
            "headers": {
              "access-control-allow-headers": "*",
              "access-control-allow-origin": "*",
              "access-control-allowed-methods": "*",
              "access-control-max-age": "0",
            },
            "src": "/rules/cors",
          },
          {
            "headers": {
              "Location": "/base",
            },
            "src": "/rules/redirect",
            "status": 307,
          },
          {
            "headers": {
              "Location": "https://nitro.unjs.io/",
            },
            "src": "/rules/redirect/obj",
            "status": 308,
          },
          {
            "headers": {
              "Location": "/base",
              "x-test": "test",
            },
            "src": "/rules/nested/.*",
            "status": 307,
          },
          {
            "headers": {
              "Location": "/other",
            },
            "src": "/rules/nested/override",
            "status": 307,
          },
          {
            "continue": true,
            "headers": {
              "cache-control": "public,max-age=31536000,immutable",
            },
            "src": "/build(.*)",
          },
          {
            "handle": "filesystem",
          },
          {
            "dest": "/__nitro",
            "src": "/(.*)",
          },
        ],
        "version": 3,
      }
    `)
  })
})

describe.skip('nitro:preset:vercel-edge', async () => {
  const ctx = await setupTest('vercel-edge')
  testNitro(ctx, async () => {
    // TODO: Add add-event-listener
    const entry = resolve(ctx.outDir, 'functions/__nitro.func/index.mjs')
    const entryCode = await fsp.readFile(entry, 'utf8')
    const runtime = new EdgeRuntime({ initialCode: entryCode })
    return async ({ url }) => {
      const res = await runtime.dispatchFetch('http://localhost' + url)
      return res
    }
  })
})
