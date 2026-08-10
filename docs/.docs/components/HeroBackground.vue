<script setup lang="ts">
import { ref, onMounted, defineAsyncComponent } from 'vue'

const Shader = defineAsyncComponent(() => import('shaders/vue').then(m => m.Shader))
const ChromaFlow = defineAsyncComponent(() => import('shaders/vue').then(m => m.ChromaFlow))

const enabled = ref(false)

onMounted(() => {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768
  const hasWebGPU = 'gpu' in navigator
  const lowMemory = (navigator as any).deviceMemory !== undefined && (navigator as any).deviceMemory < 4
  const lowCores = navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency < 4

  enabled.value = hasWebGPU && !isMobile && !lowMemory && !lowCores
})
</script>

<template>
  <Shader v-if="enabled" class="absolute inset-0 w-full h-full -z-10">
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
