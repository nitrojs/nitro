<script setup lang="ts">
import { computed, inject, type Ref } from 'vue'
import { useAppConfig } from 'undocs/src/app/composables/useAppConfig'
import { usePageSEO } from 'undocs/src/app/composables/usePageSEO'
import Breadcrumb from 'undocs/src/app/components/ui/Breadcrumb.vue'
import Icon from 'undocs/src/app/components/global/Icon.vue'
import Page from 'undocs/src/app/components/layout/Page.vue'
import PageBody from 'undocs/src/app/components/layout/PageBody.vue'
import PageCard from 'undocs/src/app/components/blocks/PageCard.vue'
import PageHeader from 'undocs/src/app/components/layout/PageHeader.vue'
import type { NavItem } from 'undocs/src/server/content/types'
import { definePageMeta } from '../../utils/definePageMeta'
import { groupExamples } from '../../utils/examples'

definePageMeta({
  layout: 'examples',
})

const appConfig = useAppConfig()
const navigation = inject<Ref<NavItem[]>>('navigation')

const groups = computed(() => groupExamples(navigation?.value))

usePageSEO({
  title: `Examples - ${appConfig.site.name}`,
  description: 'Explore Nitro examples to learn how to build full-stack applications',
})
</script>

<template>
  <Page>
    <PageHeader
      title="Examples"
      description="Explore Nitro examples to learn how to build full-stack applications with different frameworks and features."
    >
      <template #headline>
        <Breadcrumb :items="[{ label: 'Examples', icon: 'i-lucide-code' }]" />
      </template>
    </PageHeader>

    <PageBody>
      <div v-for="group in groups" :key="group.category" class="mb-12">
        <h2 class="text-xl font-semibold mb-4 flex items-center gap-2">
          <Icon :name="group.icon" class="size-5" />
          {{ group.title }}
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <PageCard
            v-for="example in group.items"
            :key="example.path"
            :to="example.path"
            :title="example.title"
            :description="example.description"
            :icon="example.icon"
          />
        </div>
      </div>

      <div v-if="!groups.length" class="text-center py-12">
        <Icon name="i-lucide-book-dashed" class="size-12 text-muted-foreground mx-auto mb-4" />
        <p class="text-muted-foreground">No examples</p>
      </div>
    </PageBody>
  </Page>
</template>
