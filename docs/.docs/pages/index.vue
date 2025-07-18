<script setup lang="ts">
import type { DocsConfig } from '../../schema/config'
import { defu } from 'defu'

type LandingConfig = Exclude<DocsConfig['landing'], false | undefined>

const appConfig = useAppConfig()

const docsConfig = appConfig.docs as DocsConfig

const landing: LandingConfig & { _github: string } = defu(docsConfig.landing || {}, {
  // Meta
  navigation: false,

  // Page
  title: docsConfig.name,
  description: docsConfig.description,

  // Hero
  heroTitle: docsConfig.name,
  heroSubtitle: docsConfig.shortDescription,
  heroDescription: docsConfig.description,
  heroLinks: {
    primary: {
      label: 'Get Started',
      icon: 'i-heroicons-rocket-launch',
      to: '/guide',
      order: 0,
    },
    github: {
      label: 'View on GitHub',
      icon: 'i-simple-icons-github',
      color: 'white',
      to: `https://github.com/${docsConfig.github}`,
      target: '_blank',
      order: 100,
    },
  },

  // Features
  featuresTitle: '',
  features: [],

  _github: docsConfig.github,
})

landing._heroMdTitle =
  landing._heroMdTitle || `[${landing.heroTitle}]{.text-primary} :br [${landing.heroSubtitle}]{.text-4xl}`

usePageSEO({
  title: `${appConfig.site.name} - ${landing!.heroSubtitle}`,
  ogTitle: landing!.heroSubtitle,
  description: landing!.description,
})

function nornalizeHeroLinks(links: LandingConfig['heroLinks']) {
  return Object.entries(links || {})
    .map(([key, link], order) => {
      if (!link) {
        return
      }
      if (typeof link === 'string') {
        link = { to: link }
      }
      return {
        label: titleCase(key),
        order,
        size: 'lg',
        target: link.to?.startsWith('https') ? '_blank' : undefined,
        ...link,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a!.order - b!.order) as any[]
}

const hero = computed(() => {
  if (!landing!._heroMdTitle) {
    return
  }
  const withFeatures = !landing!.heroCode && landing.featuresLayout === 'hero' && landing.features?.length > 0
  return {
    title: landing!._heroMdTitle,
    description: landing!.heroDescription,
    links: nornalizeHeroLinks(landing!.heroLinks),
    withFeatures,
    orientation: landing!.heroCode || withFeatures ? 'horizontal' : 'vertical',
    code: landing!.heroCode,
  } as const
})

const { data: latest } = await useAsyncData(() =>
  queryCollection('content')
    .where('path', 'LIKE', '/blog/%')
    .order('id', 'DESC')
    .first()
    .then((res) => res),
)

const { data: sponsors } = await useAsyncData(() => useSponsors())
</script>

<template>
  <div>
    <!-- Hero -->
    <UPageHero
      v-if="hero"
      :orientation="hero.orientation"
      class="relative"
      :ui="{
        container: '!pb-20 py-24 sm:py-32 lg:py-40',
        title: 'text-5xl sm:text-7xl',
        wrapper: 'lg:min-h-[540px]',
      }"
    >
      <template #top>
        <LandingBackground />
      </template>

      <template #headline>
        <NuxtLink v-if="latest" :to="latest.path">
          <UBadge
            variant="subtle"
            size="lg"
            class="px-3 relative rounded-full font-semibold dark:hover:bg-primary-400/15 dark:hover:ring-primary-700"
          >
            {{ latest.title }}
          </UBadge>
        </NuxtLink>
      </template>

      <template #title>
        {{ landing.heroTitle }}<br /><span class="text-primary text-4xl">{{ landing.heroSubtitle }}</span>
      </template>

      <template #description>
        {{ landing.heroDescription }}
      </template>

      <template #links>
        <div class="flex flex-col gap-4">
          <div class="flex items-center flex-wrap gap-2">
            <UButton v-for="link in hero.links" :key="link.label" v-bind="link" class="!px-6 !py-3"> </UButton>
          </div>
        </div>
      </template>

      <ProseCodeGroup v-if="hero.code" class="mx-auto" style="max-width: 100%">
        <ProsePre :filename="hero.code.title || 'Terminal'" :code="hero.code.content">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <span v-html="hero.code.contentHighlighted"></span>
        </ProsePre>
      </ProseCodeGroup>

      <div v-else-if="hero.withFeatures" class="flex flex-col gap-6">
        <UPageCard v-for="(item, index) of landing.features" :key="index" v-bind="item" />
      </div>
    </UPageHero>

    <!-- Features -->

    <UPageSection
      v-if="landing.features?.length > 0"
      :title="landing?.featuresTitle"
      :description="''"
      :ui="{
        title: 'text-left',
        description: 'text-left',
        root: '',
        features: 'xl:grid-cols-4 lg:gap-10',
      }"
    >
      <template #features>
        <li v-for="feature in landing.features" :key="feature.title">
          <UPageFeature v-bind="feature" orientation="vertical">
            <template #leading>
              <template v-if="feature.icon">
                <span v-if="/\p{Emoji}/u.test(feature.icon)" class="w-8 h-8 text-2xl">
                  {{ feature.icon }}
                </span>
                <UIcon v-else :name="feature.icon" class="w-8 h-8" />
              </template>
            </template>
            <template #description>
              <!-- eslint-disable-next-line vue/no-v-html -->
              <span class="md" v-html="feature.description" />
            </template>
          </UPageFeature>
        </li>
      </template>
    </UPageSection>

    <UPageSection v-if="landing.contributors && landing._github" id="contributors" title="💛 Contributors">
      <div id="contributors" class="flex justify-center">
        <a :href="`https://github.com/${landing._github}/graphs/contributors`" target="_blank">
          <img :src="`https://contrib.rocks/image?repo=${landing._github}`" />
        </a>
      </div>
    </UPageSection>

    <UPageSection v-if="sponsors?.sponsors.length" title="💜 Sponsors">
      <div id="sponsors" class="flex flex-col items-center">
        <div
          v-for="(tier, i) of sponsors.sponsors.slice(0, 2)"
          :key="i"
          class="flex flex-wrap justify-center gap-4 mb-6 mt-6 max-w-4xl"
        >
          <div v-for="s in tier" :key="s.name" class="flex items-center gap-2 max-w-[300px]">
            <a
              :href="s.website"
              target="_blank"
              class="flex items-center gap-2"
              :class="`font-size-${i === 0 ? '4xl' : i === 1 ? '3xl' : 'lg'}`"
            >
              <img
                v-if="s.image"
                :src="s.image"
                :alt="s.name"
                class="object-contain rounded-lg"
                :class="`w-${i === 0 ? 16 : 10} h-${i === 0 ? 16 : 10}`"
              />
              <span v-if="i < 2" class="text-lg font-semibold">{{ s.name }}</span>
            </a>
          </div>
        </div>
        <UAvatarGroup class="flex flex-wrap justify-center gap-4 mb-6 mt-6">
          <UTooltip v-for="s in sponsors.sponsors[2]" :key="s.name" :text="s.name" placement="top">
            <a :href="s.website" target="_blank">
              <UAvatar :alt="s.name" :src="s.image" size="lg" />
            </a>
          </UTooltip>
        </UAvatarGroup>
        <UAvatarGroup class="flex flex-wrap justify-center gap-4 mb-6 mt-6">
          <UTooltip v-for="s in sponsors.sponsors[3]" :key="s.name" :text="s.name" placement="top">
            <a :href="s.website" target="_blank">
              <UAvatar :alt="s.name" :src="s.image" style="opacity: 0.5" />
            </a>
          </UTooltip>
        </UAvatarGroup>
      </div>
      <div class="text-center">
        <UButton
          v-if="sponsors.username"
          :to="`https://github.com/sponsors/${sponsors.username}`"
          target="_blank"
          color="neutral"
        >
          Become a Sponsor
        </UButton>
      </div>
    </UPageSection>
  </div>
</template>
