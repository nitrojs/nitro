<script setup lang="ts">
import { Motion } from 'motion-v'

const props = defineProps<{
  features: {
    title: string
    description: string
    icon: string
    color: string
    bgColor: string
    borderColor: string
  }[]
}>()

const prefersReducedMotion = ref(false)

function randomLines() {
  const count = 2 + Math.floor(Math.random() * 3)
  return Array.from({ length: count }, (_, j) => ({
    width: `${20 + Math.floor(Math.random() * 80)}%`,
    delay: j * 0.1,
  }))
}

const featureLines = computed(() => props.features.map(() => randomLines()))

onMounted(() => {
  prefersReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})
</script>

<template>
  <section class="relative bg-neutral-50 dark:bg-neutral-950/30 py-14 border-y border-default">
    <UContainer>
      <div class="grid md:grid-cols-3 gap-6">
        <Motion
          v-for="(feature, i) in features"
          :key="feature.title"
          :initial="prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 16 }"
          :while-in-view="{ opacity: 1, y: 0 }"
          :transition="{ duration: 0.4, delay: i * 0.1 }"
          :in-view-options="{ once: true }"
        >
          <div :class="['group relative rounded-xl border border-default bg-white/80 dark:bg-neutral-900/50 p-6 h-full transition-all duration-300 hover:shadow-md', feature.borderColor]">
            <div class="flex items-center gap-3 mb-3">
              <div :class="[feature.bgColor, 'w-9 h-9 rounded-lg flex items-center justify-center shrink-0']">
                <UIcon :name="feature.icon" :class="[feature.color, 'text-lg']" />
              </div>
              <h3 class="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">
                {{ feature.title }}
              </h3>
            </div>

            <p class="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed mb-4">
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
                <div :class="[feature.bgColor, 'h-1 rounded-full']" />
              </Motion>
            </div>
          </div>
        </Motion>
      </div>
    </UContainer>
  </section>
</template>
