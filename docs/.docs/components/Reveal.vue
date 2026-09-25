<script setup lang="ts">
import { Motion } from 'motion-v'
import { useReducedMotion } from '../utils/useReducedMotion'

const props = withDefaults(defineProps<{ delay?: number, y?: number }>(), {
  delay: 0,
  y: 12,
})

const reduced = useReducedMotion()
</script>

<template>
  <Motion
    class="reveal"
    :initial="{ opacity: 0, y: props.y }"
    :while-in-view="{ opacity: 1, y: 0 }"
    :transition="{
      duration: reduced ? 0 : 0.5,
      delay: reduced ? 0 : props.delay,
      ease: [0.16, 1, 0.3, 1],
    }"
    :in-view-options="{ once: true, margin: '-64px' }"
  >
    <slot />
  </Motion>
</template>
