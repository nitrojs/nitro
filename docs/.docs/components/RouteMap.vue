<script setup lang="ts">
import Icon from 'undocs/src/app/components/global/Icon.vue'

defineProps<{
  dir?: string
  routes: {
    file: string
    route: string
    method?: string
  }[]
}>()
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-border bg-card">
    <div
      class="flex items-center gap-2 border-b border-border px-4 py-2.5 text-label-12 text-muted-foreground"
    >
      <Icon name="i-lucide-folder" class="size-3.5 shrink-0" />
      <span class="font-mono">{{ dir || 'routes/' }}</span>
    </div>

    <ul class="m-0 flex list-none flex-col p-0">
      <li
        v-for="entry in routes"
        :key="entry.file"
        class="grid grid-cols-1 gap-x-3 gap-y-1.5 border-b border-border px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center"
      >
        <span class="truncate font-mono text-copy-14 text-muted-foreground">{{ entry.file }}</span>

        <Icon
          name="i-lucide-arrow-right"
          class="hidden size-3.5 shrink-0 text-muted-foreground/50 sm:block"
        />

        <span class="flex min-w-0 items-center gap-2">
          <span
            class="shrink-0 rounded border border-border px-1.5 py-px font-mono text-label-12"
            :class="entry.method ? 'text-brand' : 'text-muted-foreground'"
          >
            {{ entry.method || 'ANY' }}
          </span>
          <span class="truncate font-mono text-copy-14 text-foreground">{{ entry.route }}</span>
        </span>
      </li>
    </ul>
  </div>
</template>
