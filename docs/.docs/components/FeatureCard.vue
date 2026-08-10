<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Motion } from 'motion-v'
import AppLink from 'undocs/src/app/components/app/AppLink'
import Icon from 'undocs/src/app/components/global/Icon.vue'

defineProps<{
  headline?: string
  link?: string
  linkLabel?: string
}>()

const prefersReducedMotion = ref(false)

onMounted(() => {
  prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})
</script>

<template>
  <Motion
    :initial="prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }"
    :while-in-view="{ opacity: 1, y: 0 }"
    :transition="{ duration: 0.5 }"
    :in-view-options="{ once: true }"
  >
    <component :is="link ? AppLink : 'div'" :to="link || undefined" class="block h-full">
      <div class="relative overflow-hidden rounded-xl border border-border bg-card/60 backdrop-blur-sm p-8 h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
        <div v-if="headline" class="text-xs font-mono uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
          <span class="inline-block w-1 h-1 rounded-full bg-primary" />
          {{ headline }}
        </div>

        <h3 class="text-2xl font-bold text-foreground mb-3 tracking-tight">
          <slot name="title" />
        </h3>

        <!-- A div, not a paragraph: the slot holds rendered markdown, which for a
             multi-block fill carries its own paragraphs. Nesting them is invalid
             HTML, and the browser's repair (hoist the inner one, synthesize one for
             the stray end tag) leaves a DOM that no longer matches the vdom, so
             hydration mismatches. -->
        <div class="text-muted-foreground text-sm leading-relaxed mb-6">
          <slot name="description" />
        </div>

        <slot name="demo" />

        <span
          v-if="link"
          class="inline-flex items-center gap-1 text-sm text-primary mt-auto"
        >
          {{ linkLabel || 'Learn more' }}
          <Icon name="i-lucide-arrow-right" class="size-4" />
        </span>
      </div>
    </component>
  </Motion>
</template>
