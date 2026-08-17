<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Motion } from 'motion-v'
import Container from 'undocs/src/app/components/Container.vue'
import Icon from 'undocs/src/app/components/global/Icon.vue'
import { accent } from '../utils/accents'

const props = defineProps<{
  headline?: string
  title?: string
  metrics: {
    label: string
    value: string
    unit: string
    description: string
    icon: string
    barWidth: string
    /** Accent name from `.docs/utils/accents.ts` (amber, sky, emerald, violet). */
    color?: string
  }[]
}>()

const prefersReducedMotion = ref(false)

const accents = computed(() => props.metrics.map((metric) => accent(metric.color)))

onMounted(() => {
  prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})
</script>

<template>
  <section class="relative py-20 md:py-28">
    <Container>
      <div class="text-center mb-14">
        <p class="text-xs font-mono uppercase tracking-widest text-primary mb-3 flex items-center justify-center gap-2">
          <span class="inline-block w-1 h-1 rounded-full bg-primary" />
          {{ headline || 'Performance' }}
        </p>
        <h2 class="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
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
          <div class="relative overflow-hidden rounded-xl border border-border bg-card/60 backdrop-blur-sm p-6 h-full flex flex-col">
            <div :class="[accents[i].bg, 'w-10 h-10 rounded-lg flex items-center justify-center mb-4']">
              <Icon :name="metric.icon" :class="[accents[i].text, 'text-xl']" />
            </div>

            <div class="flex items-baseline gap-1.5 mb-1">
              <span class="text-2xl font-bold text-foreground font-mono">{{ metric.value }}</span>
              <span class="text-sm text-muted-foreground font-mono">{{ metric.unit }}</span>
            </div>

            <p class="text-sm font-medium text-foreground mb-3">
              {{ metric.label }}
            </p>

            <p class="text-xs text-muted-foreground mb-3 leading-relaxed">
              {{ metric.description }}
            </p>

            <div class="mt-auto">
              <div class="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <Motion
                  :initial="{ width: '0%' }"
                  :while-in-view="{ width: metric.barWidth }"
                  :transition="{ duration: 1, delay: 0.3 + i * 0.1 }"
                  :in-view-options="{ once: true }"
                >
                  <div :class="[accents[i].bar, 'h-full rounded-full']" />
                </Motion>
              </div>
            </div>
          </div>
        </Motion>
      </div>
    </Container>
  </section>
</template>
