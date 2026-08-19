<script setup lang="ts">
import Container from 'undocs/src/app/components/Container.vue'
import Reveal from './Reveal.vue'

defineProps<{
  stats: {
    value: string
    label: string
  }[]
  caption?: string
}>()
</script>

<template>
  <!-- Bottom rule comes from the next section's `border-t`, so the two never double up. -->
  <section class="border-t border-border bg-muted/40">
    <Container>
      <Reveal>
        <div class="grid grid-cols-2 gap-y-8 py-10 sm:grid-cols-4 sm:divide-x sm:divide-border">
          <div v-for="stat in stats" :key="stat.label" class="px-2 text-center sm:px-4">
            <div class="font-mono text-heading-24 tabular-nums text-foreground">
              {{ stat.value }}
            </div>
            <div class="mt-1.5 text-label-12 uppercase tracking-[0.14em] text-muted-foreground">
              {{ stat.label }}
            </div>
          </div>
        </div>

        <p v-if="caption" class="pb-8 text-center text-label-12 text-muted-foreground">
          {{ caption }}
        </p>
      </Reveal>
    </Container>
  </section>
</template>
