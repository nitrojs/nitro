<script setup lang="ts">
import AppLink from 'undocs/src/app/components/app/AppLink'
import Icon from 'undocs/src/app/components/global/Icon.vue'

defineProps<{
  targets: {
    name: string
    icon: string
    to?: string
  }[]
  more?: string
  moreTo?: string
}>()
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-border bg-card">
    <!-- The negative offsets hide the trailing column/row hairlines behind the
         container's own border, so the grid reads as a single 1px rule. -->
    <div class="-mr-px -mb-px grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
      <component
        :is="target.to ? AppLink : 'div'"
        v-for="target in targets"
        :key="target.name"
        :to="target.to || undefined"
        class="group flex items-center gap-2.5 border-r border-b border-border px-4 py-5 no-underline transition-colors hover:bg-muted"
      >
        <Icon
          :name="target.icon"
          class="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
        />
        <span class="truncate text-copy-14 text-muted-foreground group-hover:text-foreground">
          {{ target.name }}
        </span>
      </component>

      <AppLink
        v-if="more"
        :to="moreTo || '/deploy'"
        class="group flex items-center gap-2.5 border-r border-b border-border px-4 py-5 no-underline transition-colors hover:bg-muted"
      >
        <span class="truncate text-copy-14 font-medium text-brand">{{ more }}</span>
        <Icon
          name="i-lucide-arrow-right"
          class="size-3.5 shrink-0 text-brand transition-transform group-hover:translate-x-0.5"
        />
      </AppLink>
    </div>
  </div>
</template>
