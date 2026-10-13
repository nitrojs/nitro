<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { animate, useInView } from 'motion-v'
import Container from 'undocs/src/app/components/Container.vue'
import Reveal from './Reveal.vue'
import { useReducedMotion } from '../utils/useReducedMotion'

const props = defineProps<{
  stats: {
    value: string
    label: string
    /**
     * Cosmetic starting point for the count-up, not a measurement: the counter
     * sweeps from here to `value`. Never read it as a real Nitro number.
     */
    animateFrom?: number
  }[]
}>()

const reduced = useReducedMotion()

const root = ref<HTMLElement>()
const inView = useInView(root, { once: true, margin: '-64px' })

const parsed = computed(() => props.stats.map((stat) => parse(stat.value, stat.animateFrom)))

/** Counters start on the final value so SSR (and a JS-less page) stays correct. */
const shown = ref(props.stats.map((stat) => stat.value))

let running: ReturnType<typeof animate>[] = []

watch([inView, reduced], ([visible, noMotion]) => {
  if (!visible || noMotion || running.length > 0) {
    return
  }
  running = parsed.value.map((stat, i) =>
    animate(stat.from, stat.to, {
      duration: 1.1,
      delay: 0.15 + i * 0.08,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(value) {
        shown.value[i] = stat.format(value)
      },
    })
  )
  // The first frame lands a tick later, so seed the start value right away.
  for (const [i, stat] of parsed.value.entries()) {
    shown.value[i] = stat.format(stat.from)
  }
}, { immediate: true })

onUnmounted(() => {
  for (const animation of running) {
    animation.stop()
  }
})

const NUMBER_RE = /^(\D*)(\d+(?:\.\d+)?)(.*)$/s

/**
 * Splits `~50 ms` into the parts a counter needs, keeping the decimal count of
 * the target so `100` → `3.8` ticks as `100.0`, `87.3`, … and never jitters.
 */
function parse(value: string, from = 0) {
  const [, prefix = '', number = '', suffix = ''] = value.match(NUMBER_RE) || []
  const to = Number.parseFloat(number)
  if (!number || Number.isNaN(to)) {
    return { from: 0, to: 0, format: () => value, widest: value }
  }
  const decimals = number.split('.')[1]?.length ?? 0
  const format = (n: number) => `${prefix}${n.toFixed(decimals)}${suffix}`
  const widest = [format(from), format(to)].sort((a, b) => b.length - a.length)[0]!
  return { from, to, format, widest }
}
</script>

<template>
  <!-- Bottom rule comes from the next section's `border-t`, so the two never double up. -->
  <section ref="root" class="border-t border-border bg-muted/40">
    <Container>
      <Reveal>
        <div class="grid grid-cols-2 gap-y-8 py-10 sm:grid-cols-4 sm:divide-x sm:divide-border">
          <div v-for="(stat, i) in stats" :key="stat.label" class="px-2 text-center sm:px-4">
            <div class="inline-grid font-mono text-heading-24 tabular-nums text-foreground">
              <!-- Invisible sizer holds the widest frame so counting never shifts the layout. -->
              <span aria-hidden="true" class="invisible col-start-1 row-start-1">
                {{ parsed[i]!.widest }}
              </span>
              <span class="col-start-1 row-start-1 justify-self-center">
                {{ shown[i] }}
              </span>
            </div>
            <div class="mt-1.5 text-label-12 uppercase tracking-[0.14em] text-muted-foreground">
              {{ stat.label }}
            </div>
          </div>
        </div>
      </Reveal>
    </Container>
  </section>
</template>
