import { defineAppConfig } from "#imports"

export default defineAppConfig({
  ui: {
    button: {
      slots: {
        base: 'active:translate-y-px transition-transform duration-300',
      },
    },
  },
})
