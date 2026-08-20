<script setup lang="ts">
import PmX from 'undocs/src/app/components/global/Pm-x.vue'

defineProps<{ command: string }>()
</script>

<template>
  <!-- The hero's default slot is full width; the command block reads as a
       terminal line, so it is constrained rather than stretched. -->
  <div class="mx-auto max-w-md text-left">
    <PmX :command="command" />
  </div>
</template>
