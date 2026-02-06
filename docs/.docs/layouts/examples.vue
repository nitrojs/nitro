<script setup lang="ts">
import type { ContentNavigationItem } from '@nuxt/content'
import { categoryOrder } from '~/utils/examples'

// Fetch all examples and group by category
const { data: examples } = await useAsyncData('examples-nav', () =>
  queryCollection('examples')
    .select('title', 'description', 'category', 'path')
    .all(),
)

// Group examples by category
const groupedExamples = computed(() => {
  if (!examples.value) return []

  const groups: Record<string, ContentNavigationItem[]> = {}

  for (const example of examples.value) {
    const category = example.category || 'Other'
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push({
      title: example.title,
      path: example.path.replace(/\/readme$/i, ''),
    })
  }

  // Convert to navigation items with children, sorted by categoryOrder
  const sortedEntries = Object.entries(groups).sort(([a], [b]) => {
    const aIndex = categoryOrder.indexOf(a.toLowerCase())
    const bIndex = categoryOrder.indexOf(b.toLowerCase())
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b)
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })

  return sortedEntries.map(([category, items]) => ({
    title: category.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
    path: '',
    children: items,
  }))
})

// Flat list for navigation (no groups)
const flatExamples = computed(() => {
  if (!examples.value) return []
  return examples.value.map((example) => ({
    title: example.title,
    path: example.path.replace(/\/readme$/i, ''),
  }))
})
</script>

<template>
  <UContainer>
    <UPage :ui="{ left: 'lg:col-span-2 pr-2 border-r border-default' }">
      <template #left>
        <UPageAside>
          <UPageAnchors
            :links="[
              { label: 'Docs', icon: 'i-lucide-book-open', to: '/docs' },
              { label: 'Deploy', icon: 'ri:upload-cloud-2-line', to: '/deploy' },
              { label: 'Config', icon: 'ri:settings-3-line', to: '/config' },
              { label: 'Examples', icon: 'i-lucide-folder-code', to: '/examples', active: true },
            ]"
          />
          <USeparator type="dashed" class="py-6" />
          <UContentNavigation
            v-if="groupedExamples.length"
            :navigation="groupedExamples"
            :collapsible="false"
          />
          <UContentNavigation
            v-else-if="flatExamples.length"
            :navigation="flatExamples"
            :collapsible="false"
          />
        </UPageAside>
      </template>
      <slot />
    </UPage>
  </UContainer>
</template>
