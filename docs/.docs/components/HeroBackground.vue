<script setup lang="ts">
import { ref, onMounted, defineAsyncComponent } from 'vue'

const Shader = defineAsyncComponent(() => import('shaders/vue').then(m => m.Shader))
const ChromaFlow = defineAsyncComponent(() => import('shaders/vue').then(m => m.ChromaFlow))

const enabled = ref(false)
const ready = ref(false)

onMounted(() => {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768
  const lowMemory = (navigator as any).deviceMemory !== undefined && (navigator as any).deviceMemory < 4
  const lowCores = navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency < 4

  // `shaders` renders through WebGPU when it can and falls back to WebGL2 on
  // its own, so gating on `navigator.gpu` would drop the effect entirely for
  // every browser that has not shipped WebGPU yet (Firefox, Safari < 26,
  // Chrome on Linux). WebGL2 is the real floor.
  const canRender = !!document.createElement('canvas').getContext('webgl2')

  enabled.value = canRender && !isMobile && !lowMemory && !lowCores
})
</script>

<template>
  <!-- Faded in on the renderer's first frame so a failed init never leaves a
       blank canvas sitting on top of the hero. -->
  <Shader
    v-if="enabled"
    class="absolute inset-0 w-full h-full -z-10 transition-opacity duration-700"
    :class="ready ? 'opacity-100' : 'opacity-0'"
    @ready="ready = true"
  >
    <ChromaFlow
      base-color="oklch(71.2% 0.194 13.428)"
      up-color="oklch(70.2% 0.183 293.541)"
      down-color="oklch(70.2% 0.183 293.541)"
      right-color="oklch(70.2% 0.183 293.541)"
      left-color="oklch(70.2% 0.183 293.541)"
      :opacity="0.5"
      :intensity="0.7"
    />
  </Shader>
</template>
