<script setup lang="ts">
definePageMeta({
  layout: 'examples',
})

const appConfig = useAppConfig()

// Fetch all examples
const { data: examples } = await useAsyncData('examples-list', () =>
  queryCollection('examples')
    .select('title', 'description', 'category', 'path')
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

  return groups
})

const categoryIcons: Record<string, string> = {
  vite: 'i-logos-vitejs',
  framework: 'i-lucide-puzzle',
  features: 'i-lucide-sparkles',
  rendering: 'i-lucide-brush',
  config: 'i-lucide-settings',
  integrations: 'i-lucide-plug',
  other: 'i-lucide-folder',
}

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
          >
          </UPageCard>
        </div>
      </div>

      <div v-if="!examples?.length" class="text-center py-12">
        <UIcon name="i-lucide-book-dashed" class="size-12 text-muted mx-auto mb-4" />
        <p class="text-muted">No examples</p>
      </div>
    </UPageBody>
  </UPage>
</template>
