<script setup lang="ts">
import { Motion } from 'motion-v'

defineProps<{
  headline?: string
  title?: string
  metrics: {
    label: string
    value: string
    unit: string
    description: string
    icon: string
    color: string
    bgColor: string
    barWidth: string
    barColor: string
  }[]
}>()

const prefersReducedMotion = ref(false)

onMounted(() => {
  prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})
</script>

<template>
  <section class="relative py-20 md:py-28">
    <UContainer>
      <div class="text-center mb-14">
        <p class="text-xs font-mono uppercase tracking-widest text-primary mb-3 flex items-center justify-center gap-2">
          <span class="inline-block w-1 h-1 rounded-full bg-primary" />
          {{ headline || 'Performance' }}
        </p>
        <h2 class="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-white tracking-tight">
          {{ title || 'Built for speed' }}
        </h2>
      </div>

      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Motion
          v-for="(metric, i) in metrics"
          :key="metric.label"
          :initial="prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 24 }"
          :while-in-view="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.5, delay: i * 0.1 }"
          :in-view-options="{ once: true }"
        >
          <div class="relative overflow-hidden rounded-xl border border-default bg-white/60 dark:bg-neutral-900/60 backdrop-blur-sm p-6 h-full flex flex-col">
            <div :class="[metric.bgColor, 'w-10 h-10 rounded-lg flex items-center justify-center mb-4']">
              <UIcon :name="metric.icon" :class="[metric.color, 'text-xl']" />
            </div>

            <div class="flex items-baseline gap-1.5 mb-1">
              <span class="text-2xl font-bold text-neutral-900 dark:text-white font-mono">{{ metric.value }}</span>
              <span class="text-sm text-neutral-400 font-mono">{{ metric.unit }}</span>
            </div>

            <p class="text-sm font-medium text-neutral-600 dark:text-neutral-300 mb-3">
              {{ metric.label }}
            </p>

            <p class="text-xs text-neutral-400 dark:text-neutral-500 mb-3 leading-relaxed">
              {{ metric.description }}
            </p>

            <div class="mt-auto">
              <div class="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                <Motion
                  :initial="{ width: '0%' }"
                  :while-in-view="{ width: metric.barWidth }"
                  :transition="{ duration: 1, delay: 0.3 + i * 0.1 }"
                  :in-view-options="{ once: true }"
                >
                  <div :class="[metric.barColor, 'h-full rounded-full']" />
                </Motion>
              </div>
            </div>
          </div>
        </Motion>
      </div>
    </UContainer>
  </section>
</template>
