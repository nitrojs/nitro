import { promises as fsp } from 'fs'
import { resolve } from 'pathe'
import destr from 'destr'
import { describe, it, expect } from 'vitest'
import { Handler, APIGatewayEvent } from 'aws-lambda'
import { setupTest, testNitro } from '../tests'

describe('nitro:preset:netlify', async () => {
  const ctx = await setupTest('netlify')
  testNitro(ctx, async () => {
    const { handler } = await import(resolve(ctx.outDir, 'server/server.js')) as { handler: Handler }
    return async ({ url: rawRelativeUrl, headers, method, body }) => {
      // creating new URL object to parse query easier
      const url = new URL(`https://example.com${rawRelativeUrl}`)
      const queryStringParameters = Object.fromEntries(url.searchParams.entries())
      const event: Partial<APIGatewayEvent> = {
        resource: '/my/path',
        path: url.pathname,
        headers: headers || {},
        httpMethod: method || 'GET',
        queryStringParameters,
        body: body || ''
      }
      const res = await handler(event, {} as any, () => {})
      return {
        data: destr(res.body),
        status: res.statusCode,
        headers: res.headers
      }
    }
  })
  it('should add route rules - redirects', async () => {
    const redirects = await fsp.readFile(resolve(ctx.rootDir, 'dist/_redirects'), 'utf-8')
    /* eslint-disable no-tabs */
    expect(redirects).toMatchInlineSnapshot(`
      "/rules/nested/override	/other	301
      /rules/nested/*	/base	301
      /rules/redirect/obj	https://nitro.unjs.io/	308
      /rules/redirect	/base	301
      /rules/static	/.netlify/builders/server 200
      /* /.netlify/functions/server 200"
    `)
    /* eslint-enable no-tabs */
  })
  it('should add route rules - headers', async () => {
    const headers = await fsp.readFile(resolve(ctx.rootDir, 'dist/_headers'), 'utf-8')
    /* eslint-disable no-tabs */
    expect(headers).toMatchInlineSnapshot(`
      "/rules/headers
        cache-control: s-maxage=60
      /rules/cors
        access-control-allow-origin: *
        access-control-allowed-methods: GET
        access-control-allow-headers: *
        access-control-max-age: 0
      /rules/nested/*
        x-test: test
      "
    `)
    /* eslint-enable no-tabs */
  })
})
