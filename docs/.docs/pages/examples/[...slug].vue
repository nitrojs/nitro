<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'undocs/src/app/router'
import { createError } from 'undocs/src/app/composables/createError'
import { queryPage } from 'undocs/src/app/composables/useContent'
import { useAppConfig } from 'undocs/src/app/composables/useAppConfig'
import { useAsyncData } from 'undocs/src/app/composables/useAsyncData'
import { usePageSEO } from 'undocs/src/app/composables/usePageSEO'
import Breadcrumb from 'undocs/src/app/components/ui/Breadcrumb.vue'
import Button from 'undocs/src/app/components/ui/Button.vue'
import DocsSurround from 'undocs/src/app/components/docs/DocsSurround.vue'
import DocsToc from 'undocs/src/app/components/docs/DocsToc.vue'
import Page from 'undocs/src/app/components/layout/Page.vue'
import PageBody from 'undocs/src/app/components/layout/PageBody.vue'
import PageHeader from 'undocs/src/app/components/layout/PageHeader.vue'
import PageHeaderLinks from 'undocs/src/app/components/layout/PageHeaderLinks.vue'
import PageLinks from 'undocs/src/app/components/layout/PageLinks.vue'
import Separator from 'undocs/src/app/components/ui/Separator.vue'
import MarkdownRenderer from 'undocs/src/app/content/MarkdownRenderer'
import { definePageMeta } from '../../utils/definePageMeta'

definePageMeta({
  layout: 'examples',
})

const appConfig = useAppConfig()
const route = useRoute()

// Route params are not extracted by the undocs router — read `route.path`.
const { data: page } = await useAsyncData(route.path, () => queryPage(route.path))
if (!page.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Example not found',
    message: `${route.path} does not exist`,
    fatal: true,
  })
}

// Prev/next comes embedded in the page payload.
const surround = computed(() => page.value?.surround ?? [])

// Extract example name from route (e.g., "/examples/vite-ssr-html" -> "vite-ssr-html")
const exampleName = computed(() => route.path.replace(/^\/examples\//, ''))

const breadcrumb = computed(() => [
  { label: 'Examples', icon: 'i-lucide-folder-code', to: '/examples' },
  { label: page.value?.title || exampleName.value },
])

const repo = computed(() => `${appConfig.docs.github}/tree/${appConfig.docs.branch || 'main'}`)

usePageSEO({
  title: `${page.value?.title} - ${appConfig.site.name}`,
  description: page.value?.description,
})
</script>

<template>
  <Page v-if="page">
    <PageHeader
      :title="page.title"
      :description="page.description"
      :ui="{
        wrapper: 'flex-row items-center flex-wrap justify-between',
      }"
    >
      <template #headline>
        <Breadcrumb :items="breadcrumb" />
      </template>
      <template #links>
        <Button
          icon="i-simple-icons-stackblitz"
          label="Open in Playground"
          color="neutral"
          variant="soft"
          size="sm"
          :to="`https://stackblitz.com/fork/github/${repo}/examples/${exampleName}`"
          target="_blank"
        />

        <Button
          icon="i-simple-icons-github"
          label="Source"
          color="neutral"
          variant="soft"
          size="sm"
          :to="`https://github.com/${repo}/examples/${exampleName}`"
          target="_blank"
        />

        <PageHeaderLinks />
      </template>
    </PageHeader>

    <template v-if="page.body?.toc?.links?.length" #right>
      <DocsToc title="On this page" :links="page.body?.toc?.links || []" highlight />
    </template>

    <PageBody prose class="break-words">
      <MarkdownRenderer v-if="page.body" :value="page" />
    </PageBody>

    <div class="mt-6 space-y-6">
      <Separator type="dashed" />
      <div class="mb-4">
        <PageLinks
          class="inline-block"
          :links="[
            {
              icon: 'i-lucide-square-pen',
              label: 'Edit this page',
              to: `https://github.com/${appConfig.docs.github}/edit/${appConfig.docs.branch || 'main'}/docs/${page.id.replace(/^content\//, '')}`,
              target: '_blank',
            },
          ]"
        />
      </div>
      <DocsSurround v-if="surround?.length" class="mb-4" :surround="surround" />
    </div>
  </Page>
</template>
