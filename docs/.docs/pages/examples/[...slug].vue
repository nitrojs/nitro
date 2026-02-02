<script setup lang="ts">
import { joinURL } from 'ufo'
import { kebabCase } from 'scule'

definePageMeta({
  layout: 'examples',
})

const appConfig = useAppConfig()
const route = useRoute()

const { data: page } = await useAsyncData(kebabCase(route.path), () =>
  queryCollection('examples').path(`${route.path}/readme`).first(),
)
if (!page.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Example not found',
    message: `${route.path} does not exist`,
    fatal: true,
  })
}

const { data: surround } = await useAsyncData(`${kebabCase(route.path)}-surround`, async () => {
  const data = await queryCollectionItemSurroundings('examples', `${route.path}/readme`, {
    fields: ['description'],
  }).where('category', '=', page.value?.category)

  return data?.map((item) => {
    if (!item) return null
    return { ...item, path: item.path?.replace('/readme', '') }
  })
})

// Extract example name from route (e.g., "/examples/vite-ssr-html" -> "vite-ssr-html")
const exampleName = computed(() => {
  return route.path.replace(/^\/examples\//, '')
})

const breadcrumb = computed(() => [
  { label: 'Examples', icon: 'i-lucide-folder-code', to: '/examples' },
  { label: page.value?.title || exampleName.value },
])

usePageSEO({
  title: `${page.value?.title} - ${appConfig.site.name}`,
  ogTitle: page.value?.title,
  description: page.value?.description,
})

const path = computed(() => route.path.replace(/\/$/, ''))
prerenderRoutes([joinURL('/raw', `${path.value}.md`)])
useHead({
  link: [
    {
      rel: 'alternate',
      href: joinURL(appConfig.site.url, 'raw', `${path.value}.md`),
      type: 'text/markdown',
    },
  ],
})
</script>

<template>
  <UPage v-if="page">
    <UPageHeader
      :title="page.title"
      :description="page.description"
      :ui="{
        wrapper: 'flex-row items-center flex-wrap justify-between',
      }"
    >
      <template #headline>
        <UBreadcrumb :items="breadcrumb" />
      </template>
      <template #links>
        <UButton
          icon="i-simple-icons-stackblitz"
          label="Open in Playground"
          color="neutral"
          variant="soft"
          size="sm"
          :to="`https://stackblitz.com/fork/github/${appConfig.docs.github}/tree/${appConfig.docs.branch || 'main'}/examples/${exampleName}`"
          target="_blank"
        />

        <UButton
          icon="i-simple-icons-github"
          label="Source"
          color="neutral"
          variant="soft"
          size="sm"
          :to="`https://github.com/${appConfig.docs.github}/tree/${appConfig.docs.branch || 'main'}/examples/${exampleName}`"
          target="_blank"
        />

        <PageHeaderLinks />
      </template>
    </UPageHeader>

    <template v-if="page.body?.toc?.links?.length" #right>
      <UContentToc title="On this page" :links="page.body?.toc?.links || []" highlight />
    </template>

    <UPageBody prose class="break-words">
      <ContentRenderer v-if="page.body" :value="page" />

      <div class="space-y-6">
        <USeparator type="dashed" />
        <div class="mb-4">
          <UPageLinks
            class="inline-block"
            :links="[
              {
                icon: 'i-lucide-pencil',
                label: 'Edit this page',
                to: `https://github.com/${appConfig.docs.github}/edit/${appConfig.docs.branch || 'main'}/examples/${exampleName}/README.md`,
                target: '_blank',
              },
            ]"
          />
        </div>
        <UContentSurround v-if="surround?.length" class="mb-4" :surround="surround" />
      </div>
    </UPageBody>
  </UPage>
</template>
