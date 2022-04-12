import { resolve } from 'pathe'
import { loadConfig } from 'c12'
import { klona } from 'klona/full'
import { camelCase } from 'scule'
import defu from 'defu'
import { withLeadingSlash, withoutTrailingSlash, withTrailingSlash } from 'ufo'
import { isTest } from 'std-env'
import { resolvePath as resovleModule } from 'mlly'
import { resolvePath, detectTarget } from './utils'
import type { NitroConfig, NitroOptions } from './types'
import { runtimeDir, pkgDir } from './dirs'
import * as PRESETS from './presets'
import { nitroImports } from './imports'

const NitroDefaults: NitroConfig = {
  // General
  preset: undefined,
  logLevel: isTest ? 1 : 3,
  runtimeConfig: { app: {}, nitro: {} },

  // Dirs
  scanDirs: [],
  buildDir: '.nitro',
  output: {
    dir: '{{ rootDir }}/.output',
    serverDir: '{{ output.dir }}/server',
    publicDir: '{{ output.dir }}/public'
  },

  // Featueres
  experimental: {},
  storage: {},
  publicAssets: [],
  serverAssets: [],
  plugins: [],
  autoImport: {
    presets: nitroImports
  },
  virtual: {},

  // Dev
  dev: false,
  devServer: { watch: [] },
  watchOptions: { ignoreInitial: true },

  // Routing
  baseURL: process.env.NITRO_APP_BASE_URL || '/',
  handlers: [],
  devHandlers: [],
  errorHandler: '#nitro/error',
  routes: {},
  prerender: {
    crawlLinks: false,
    routes: []
  },

  // Rollup
  alias: {
    '#nitro': runtimeDir
  },
  unenv: {},
  analyze: false,
  moduleSideEffects: ['unenv/runtime/polyfill/'],
  replace: {},

  // Advanced
  typescript: { generateTsConfig: true },
  nodeModulesDirs: [],
  hooks: {},
  commands: {}
}

export async function loadOptions (userConfig: NitroConfig = {}): Promise<NitroOptions> {
  userConfig = klona(userConfig)

  const { config } = await loadConfig({
    name: 'nitro',
    defaults: NitroDefaults,
    cwd: userConfig.rootDir,
    resolve (id: string) {
      type PT = Map<String, NitroConfig>
      let matchedPreset = (PRESETS as any as PT)[id] || (PRESETS as any as PT)[camelCase(id)]
      if (matchedPreset) {
        if (typeof matchedPreset === 'function') {
          matchedPreset = matchedPreset()
        }
        return {
          config: matchedPreset
        }
      }
      return null
    },
    overrides: {
      ...userConfig,
      extends: [
        userConfig.preset || process.env.NITRO_PRESET || detectTarget() || 'node-server'
      ]
    }
  })
  const options = klona(config) as NitroOptions
  options._config = userConfig

  options.rootDir = resolve(options.rootDir || '.')
  options.srcDir = resolve(options.srcDir || options.rootDir)
  for (const key of ['srcDir', 'publicDir', 'buildDir']) {
    options[key] = resolve(options.rootDir, options[key])
  }

  // Resolve possibly template paths
  if (!options.entry) {
    throw new Error(`Nitro entry is missing! Is "${options.preset}" preset correct?`)
  }
  options.entry = resolvePath(options.entry, options)
  options.output.dir = resolvePath(options.output.dir, options)
  options.output.publicDir = resolvePath(options.output.publicDir, options)
  options.output.serverDir = resolvePath(options.output.serverDir, options)

  options.nodeModulesDirs.push(resolve(options.rootDir, 'node_modules'))
  options.nodeModulesDirs.push(resolve(pkgDir, 'node_modules'))
  options.nodeModulesDirs = Array.from(new Set(options.nodeModulesDirs))

  if (!options.scanDirs.length) {
    options.scanDirs = [options.srcDir]
  }

  options.baseURL = withLeadingSlash(withTrailingSlash(options.baseURL))
  options.runtimeConfig = defu(options.runtimeConfig, {
    app: {
      baseURL: options.baseURL
    },
    nitro: {
      routes: options.routes
    }
  })

  for (const asset of options.publicAssets) {
    asset.dir = resolve(options.srcDir, asset.dir)
    asset.baseURL = withLeadingSlash(withoutTrailingSlash(asset.baseURL || '/'))
  }

  for (const pkg of ['defu', 'h3']) {
    if (!options.alias[pkg]) {
      options.alias[pkg] = await resovleModule(pkg, { url: import.meta.url })
    }
  }

  return options
}

export function defineNitroConfig (config: NitroConfig): NitroConfig {
  return config
}
