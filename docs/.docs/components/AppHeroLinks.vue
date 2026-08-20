<script setup lang="ts">
import Button from 'undocs/src/app/components/ui/Button.vue'
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-3">
    <!-- `brand` solid is reserved for the landing's lead CTA (see undocs' Button.ts). -->
    <Button color="brand" size="lg" to="/docs/quick-start" trailing-icon="i-lucide-arrow-right">
      Get started
    </Button>
    <Button
      color="neutral"
      variant="outline"
      icon="i-simple-icons-github"
      size="lg"
      target="_blank"
      to="https://github.com/nitrojs/nitro"
    >
      Star on GitHub
    </Button>
  </div>
</template>
