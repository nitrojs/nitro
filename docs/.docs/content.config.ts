import { defineContentConfig, defineCollection, z } from '@nuxt/content'
import { resolve } from 'pathe'

export default defineContentConfig({
  collections: {
    examples: defineCollection({
      type: 'page',
      source: {
        cwd: resolve(__dirname, '../../examples'),
        include: '**/README.md',
        prefix: '/examples',
        exclude: ['**/.**/**', '**/node_modules/**', '**/dist/**', '**/.docs/**'],
      },
      schema: z.object({
        category: z.string().optional(),
        icon: z.string().optional(),
        defaultFile: z.string().optional(),
      }),
    }),
  },
})
