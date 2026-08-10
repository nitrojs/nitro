<script setup lang="ts">
import { computed, inject, type Ref } from 'vue'
import { useDocsNav } from 'undocs/src/app/composables/useDocsNav'
import { useSectionTabs } from 'undocs/src/app/composables/useSectionTabs'
import Container from 'undocs/src/app/components/Container.vue'
import DocsNavigation from 'undocs/src/app/components/docs/DocsNavigation.vue'
import Page from 'undocs/src/app/components/layout/Page.vue'
import PageAnchors from 'undocs/src/app/components/layout/PageAnchors.vue'
import PageAside from 'undocs/src/app/components/layout/PageAside.vue'
import Separator from 'undocs/src/app/components/ui/Separator.vue'
import type { NavItem } from 'undocs/src/server/content/types'
import { groupExamples } from '../utils/examples'

const docsNav = useDocsNav()
const navigation = inject<Ref<NavItem[]>>('navigation')

// Same rule as the built-in docs layout: when the section-tabs bar is on screen
// it already switches sections, so the sidebar drops the section anchors.
const { visible: hasSectionTabs } = useSectionTabs()

const anchorLinks = computed(() => docsNav.links.filter((link) => link.title !== 'Blog'))

// Category headers are not pages — `page: false` keeps `DocsNavigation` from
// rendering them as links, and `#<category>` is only a tree key.
const groupedExamples = computed<NavItem[]>(() =>
  groupExamples(navigation?.value).map((group) => ({
    title: group.title,
    path: `#${group.category}`,
    icon: group.icon,
    page: false,
    children: group.items,
  })),
)
</script>

<template>
  <Container>
    <Page :ui="{ left: 'lg:col-span-2 pr-2 border-r border-border' }">
      <template #left>
        <PageAside>
          <template v-if="!hasSectionTabs">
            <PageAnchors :links="anchorLinks" />
            <Separator v-if="groupedExamples.length" type="dashed" class="py-6" />
          </template>
          <DocsNavigation
            v-if="groupedExamples.length"
            :navigation="groupedExamples"
            :collapsible="false"
          />
        </PageAside>
      </template>
      <slot />
    </Page>
  </Container>
</template>
