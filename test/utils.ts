import { resolve } from 'pathe'
import destr from 'destr'
import { listen, Listener } from 'listhen'
import { $fetch } from 'ohmyfetch'
import { expect, it, beforeAll, afterAll } from 'vitest'
import { fileURLToPath } from 'mlly'
import * as _nitro from '..'

const { createNitro, build } = (_nitro as any as { default: typeof _nitro }).default || _nitro

interface Context {
  preset: string
  rootDir: string
  outDir: string
  fetch: (url:string) => Promise<any>
  server?: Listener
}

export function setupTest (preset) {
  const fixtureDir = fileURLToPath(new URL('./fixture', import.meta.url).href)

  const ctx: Context = {
    preset,
    rootDir: fixtureDir,
    outDir: resolve(fixtureDir, '.output', preset),
    fetch: url => $fetch(url, { baseURL: ctx.server!.url })
  }

  beforeAll(async () => {
    const nitro = await createNitro({
      preset: ctx.preset,
      rootDir: ctx.rootDir,
      output: { dir: ctx.outDir }
    })
    await build(nitro)
  }, 60 * 1000)

  afterAll(async () => {
    if (ctx.server) {
      await ctx.server.close()
    }
  })

  return ctx
}

export async function startServer (ctx, handle) {
  ctx.server = await listen(handle)
  console.log('>', ctx.server!.url)
}

export function testNitro (_ctx, getHandler) {
  let handler

  it('setup handler', async () => {
    handler = await getHandler()
  })

  it('API Works', async () => {
    const { data: helloData } = await handler({ url: '/api/hello' })
    const { data: heyData } = await handler({ url: '/api/hey' })
    const { data: kebabData } = await handler({ url: '/api/kebab' })
    expect(destr(helloData)).to.have.string('Hello API')
    expect(destr(heyData)).to.have.string('Hey API')
    expect(destr(kebabData)).to.have.string('hello-world')
  })
}
