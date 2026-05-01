<script setup lang="ts">
import { Motion } from 'motion-v'

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
    <NuxtLink :to="link" class="block h-full" :class="link ? 'cursor-pointer' : 'cursor-default'">
      <div class="relative overflow-hidden rounded-xl border border-default bg-white/60 dark:bg-neutral-900/60 backdrop-blur-sm p-8 h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
        <div v-if="headline" class="text-xs font-mono uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
          <span class="inline-block w-1 h-1 rounded-full bg-primary" />
          {{ headline }}
        </div>

        <h3 class="text-2xl font-bold text-neutral-900 dark:text-white mb-3 tracking-tight">
          <slot name="title" />
        </h3>

        <p class="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed mb-6">
          <slot name="description" />
        </p>

        <slot name="demo" />

        <span
          v-if="link"
          class="inline-flex items-center gap-1 text-sm text-primary mt-auto"
        >
          {{ linkLabel || 'Learn more' }}
          <UIcon name="i-lucide-arrow-right" class="size-4" />
        </span>
      </div>
    </NuxtLink>
  </Motion>
</template>
