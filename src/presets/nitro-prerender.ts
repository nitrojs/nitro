import { pathToFileURL } from 'url'
import { isWindows } from 'std-env'
import { defineNitroPreset } from '../preset'

export const nitroPrerender = defineNitroPreset({
  extends: 'node',
  entry: '#nitro/entries/nitro-prerenderer',
  output: {
    serverDir: '{{ buildDir }}/prerender'
  },
  externals: { trace: false },
  hooks: {
    'nitro:rollup:before' (nitro) {
      if (isWindows) {
      // Windows dynamic imports should be file:// url
        nitro.options.alias['#build'] = pathToFileURL(nitro.options.buildDir).href
      }
    }
  }
})
