import { builtinDrivers } from 'unstorage'
import { serializeImportName } from '../../utils'
import type { Nitro } from '../../types'
import { virtual } from './virtual'

export function storage (nitro: Nitro) {
  const mounts: { path: string, driver: string, opts: object }[] = []

  const isDevOrPrerender = nitro.options.dev || nitro.options.preset === 'nitro-prerender'
  const storageMounts = isDevOrPrerender
    ? { ...nitro.options.storage, ...nitro.options.devStorage }
    : nitro.options.storage

  for (const path in storageMounts) {
    const mount = storageMounts[path]
    mounts.push({
      path,
      driver: builtinDrivers[mount.driver] || mount.driver,
      opts: mount
    })
  }

  const driverImports = Array.from(new Set(mounts.map(m => m.driver)))

  const bundledStorageCode = `
import { prefixStorage } from 'unstorage'
import overlay from 'unstorage/drivers/overlay'
import memory from 'unstorage/drivers/memory'

const bundledStorage = ${JSON.stringify(nitro.options.bundledStorage)}
for (const base of bundledStorage) {
  storage.mount(base, overlay({
    layers: [
      memory(),
      // TODO
      // prefixStorage(storage, base),
      prefixStorage(storage, 'assets:nitro:bundled:' + base)
    ]
  }))
}`

  return virtual({
    '#internal/nitro/virtual/storage': `
import { createStorage } from 'unstorage'
import { assets } from '#internal/nitro/virtual/server-assets'

${driverImports.map(i => `import ${serializeImportName(i)} from '${i}'`).join('\n')}

const storage = createStorage({})

export const useStorage = () => storage

storage.mount('/assets', assets)

${mounts.map(m => `storage.mount('${m.path}', ${serializeImportName(m.driver)}(${JSON.stringify(m.opts)}))`).join('\n')}

${(!isDevOrPrerender && nitro.options.bundledStorage.length) ? bundledStorageCode : ''}
`
  }, nitro.vfs)
}
