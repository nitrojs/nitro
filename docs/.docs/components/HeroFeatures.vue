<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Motion } from 'motion-v'
import Container from 'undocs/src/app/components/Container.vue'
import Icon from 'undocs/src/app/components/global/Icon.vue'
import { accent } from '../utils/accents'

const props = defineProps<{
  features: {
    title: string
    description: string
    icon: string
    /** Accent name from `.docs/utils/accents.ts` (amber, sky, emerald, violet). */
    color?: string
  }[]
}>()

const prefersReducedMotion = ref(false)

const accents = computed(() => props.features.map((feature) => accent(feature.color)))

// Decorative "content" bars under each feature. Deterministic (derived from the
// indices) so the SSR markup and the first client render agree.
const featureLines = computed(() =>
  props.features.map((_, i) =>
    Array.from({ length: 2 + (i % 3) }, (_, j) => ({
      width: `${30 + ((i * 5 + j * 3) % 7) * 10}%`,
      delay: j * 0.1,
    })),
  ),
)

onMounted(() => {
  prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})
</script>

<template>
  <section class="relative bg-muted/30 py-14 border-y border-border">
    <Container>
      <div class="grid md:grid-cols-3 gap-6">
        <Motion
          v-for="(feature, i) in features"
          :key="feature.title"
          :initial="prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 16 }"
          :while-in-view="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.4, delay: i * 0.1 }"
          :in-view-options="{ once: true }"
        >
          <div :class="['group relative rounded-xl border border-border bg-card/80 p-6 h-full transition-all duration-300 hover:shadow-md', accents[i].border]">
            <div class="flex items-center gap-3 mb-3">
              <div :class="[accents[i].bg, 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0']">
                <Icon :name="feature.icon" :class="[accents[i].text, 'text-lg']" />
              </div>
              <h3 class="text-lg font-bold text-foreground tracking-tight">
                {{ feature.title }}
              </h3>
            </div>

            <p class="text-sm text-muted-foreground leading-relaxed mb-4">
              {{ feature.description }}
            </p>

            <div class="flex flex-col gap-1.5">
              <Motion
                v-for="(line, j) in featureLines[i]"
                :key="j"
                :initial="{ width: '0%', opacity: 0 }"
                :while-in-view="{ width: line.width, opacity: 1 }"
                :transition="{ duration: 0.8, delay: 0.3 + line.delay + i * 0.1 }"
                :in-view-options="{ once: true }"
              >
                <div :class="[accents[i].bg, 'h-1 rounded-full']" />
              </Motion>
            </div>
          </div>
        </Motion>
      </div>
    </Container>
  </section>
</template>
