<script setup lang="ts">
import { Shader, ChromaFlow } from 'shaders/vue'
</script>

<template>
  <Shader class="absolute inset-0 w-full h-full -z-10">
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
