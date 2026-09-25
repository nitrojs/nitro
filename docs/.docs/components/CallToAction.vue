<script setup lang="ts">
import Container from 'undocs/src/app/components/Container.vue'
import PmX from 'undocs/src/app/components/global/Pm-x.vue'
import Reveal from './Reveal.vue'

defineProps<{
  /** Rendered as a package-manager tabbed `x` command, e.g. `create-nitro-app`. */
  command?: string
}>()
</script>

<template>
  <section class="border-t border-border">
    <Container>
      <Reveal>
        <div class="mx-auto max-w-2xl py-20 text-center sm:py-28">
          <h2 class="text-heading-24 sm:text-heading-32 text-foreground text-balance">
            <slot name="title" />
          </h2>

          <!-- See FeatureSection: markdown slots can carry their own paragraphs. -->
          <div class="mt-4 text-copy-16 text-muted-foreground text-pretty">
            <slot name="description" />
          </div>

          <div v-if="command" class="mx-auto mt-8 max-w-md text-left">
            <PmX :command="command" />
          </div>

          <div class="mt-8 flex justify-center">
            <slot name="actions" />
          </div>
        </div>
      </Reveal>
    </Container>
  </section>
</template>
