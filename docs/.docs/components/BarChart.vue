<script setup lang="ts">
import { computed } from 'vue'
import { Motion } from 'motion-v'
import { useReducedMotion } from '../utils/useReducedMotion'

const props = defineProps<{
  title?: string
  data: {
    label: string
    /** Drives the bar length; `display` is what the reader sees. */
    value: number
    display?: string
    highlight?: boolean
  }[]
}>()

const reduced = useReducedMotion()

const max = computed(() => Math.max(...props.data.map((d) => d.value)) || 1)

function width(value: number): string {
  return `${Math.max((value / max.value) * 100, 2)}%`
}
</script>

<template>
  <figure class="m-0 rounded-xl border border-border bg-card p-6 sm:p-8">
    <figcaption v-if="title" class="text-heading-16 text-foreground">
      {{ title }}
    </figcaption>

    <div class="mt-6 flex flex-col gap-5">
      <div v-for="(item, i) in data" :key="item.label">
        <div class="flex items-baseline justify-between gap-4">
          <span class="text-copy-14 text-muted-foreground">{{ item.label }}</span>
          <span
            class="font-mono text-copy-14 tabular-nums"
            :class="item.highlight ? 'text-brand' : 'text-foreground'"
          >
            {{ item.display ?? item.value }}
          </span>
        </div>

        <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <Motion
            class="reveal-bar h-full"
            :initial="{ width: '0%' }"
            :while-in-view="{ width: width(item.value) }"
            :transition="{
              duration: reduced ? 0 : 0.9,
              delay: reduced ? 0 : 0.1 + i * 0.12,
              ease: [0.16, 1, 0.3, 1],
            }"
            :in-view-options="{ once: true, margin: '-64px' }"
          >
            <div
              class="h-full rounded-full"
              :class="item.highlight ? 'bg-brand' : 'bg-foreground/20'"
            />
          </Motion>
        </div>
      </div>
    </div>
  </figure>
</template>
