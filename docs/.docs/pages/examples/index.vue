<script setup lang="ts">
import { categoryOrder, categoryIcons } from '~/utils/examples'

definePageMeta({
  layout: 'examples',
})

const appConfig = useAppConfig()

// Fetch all examples
const { data: examples } = await useAsyncData('examples-list', () =>
  queryCollection('examples')
    .select('title', 'description', 'category', 'path', 'icon')
    .all(),
)

// Group examples by category
const groupedExamples = computed(() => {
  if (!examples.value) return {}

  const groups: Record<string, typeof examples.value> = {}

  for (const example of examples.value) {
    const category = example.category || 'Other'
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(example)
  }

  // Sort groups by categoryOrder
  const sortedEntries = Object.entries(groups).sort(([a], [b]) => {
    const aIndex = categoryOrder.indexOf(a.toLowerCase())
    const bIndex = categoryOrder.indexOf(b.toLowerCase())
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b)
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })

  return Object.fromEntries(sortedEntries)
})

usePageSEO({
  title: `Examples - ${appConfig.site.name}`,
  ogTitle: 'Examples',
  description: 'Explore Nitro examples to learn how to build full-stack applications',
})
</script>

<template>
  <UPage>
    <UPageHeader
      title="Examples"
      description="Explore Nitro examples to learn how to build full-stack applications with different frameworks and features."
    >
      <template #headline>
        <UBreadcrumb :items="[{ label: 'Examples', icon: 'i-lucide-code' }]" />
      </template>
    </UPageHeader>

    <UPageBody>
      <UAlert
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Work in Progress"
        description="Nitro v3 Alpha docs and examples are a work in progress — expect updates, rough edges, and occasional inaccuracies."
        class="mb-8"
      />

      <div v-for="(categoryExamples, category) in groupedExamples" :key="category" class="mb-12">
        <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
          <UIcon :name="categoryIcons[String(category).toLowerCase()] || categoryIcons.other" class="size-5" />
          {{ String(category).charAt(0).toUpperCase() + String(category).slice(1) }}
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <UPageCard
            v-for="example in categoryExamples"
            :key="example.path"
            :to="example.path.replace(/\/readme$/i, '')"
            :title="example.title"
            :description="example.description"
            :icon="example.icon"
          />
        </div>
      </div>

      <div v-if="!examples?.length" class="text-center py-12">
        <UIcon name="i-lucide-book-dashed" class="size-12 text-muted mx-auto mb-4" />
        <p class="text-muted">No examples</p>
      </div>
    </UPageBody>
  </UPage>
</template>
