<script setup lang="ts">
import { computed, inject, nextTick, onMounted, watch, type Ref } from 'vue'
import { useRoute } from 'undocs/src/app/router'
import { useDocsNav } from 'undocs/src/app/composables/useDocsNav'
import { useSectionTabs } from 'undocs/src/app/composables/useSectionTabs'
import { countNavRows, isBlogPath } from 'undocs/src/app/utils/nav'
import Container from 'undocs/src/app/components/Container.vue'
import DocsNavigation from 'undocs/src/app/components/docs/DocsNavigation.vue'
import Page from 'undocs/src/app/components/layout/Page.vue'
import PageAnchors from 'undocs/src/app/components/layout/PageAnchors.vue'
import PageAside from 'undocs/src/app/components/layout/PageAside.vue'
import Separator from 'undocs/src/app/components/ui/Separator.vue'
import type { NavItem } from 'undocs/src/server/content/types'
import { groupExamples } from '../utils/examples'

const docsNav = useDocsNav()
const route = useRoute()
const navigation = inject<Ref<NavItem[]>>('navigation')

// Same rule as the built-in docs layout: when the section-tabs bar is on screen
// it already switches sections, so the sidebar drops the section anchors.
const { visible: hasSectionTabs } = useSectionTabs()

// The blog is asked for on the ROUTE, not on a "Blog" title — same as
// `useSectionTabs`. A blog whose index is titled "News" is still the blog, and
// an index-less `blog/` borrows its first post's path, so neither the title nor
// an exact `/blog` test finds it.
const anchorLinks = computed(() => docsNav.links.filter((link) => !isBlogPath(link.to)))

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

// Counted in ROWS, not entries (see `countNavRows`): a category header renders a
// row of its own, so one group of one example is two rows and worth a sidebar.
// Below that, drop the `#left` slot entirely rather than reserving the grid's
// aside column for a link to the page the reader is already on.
const hasSidebar = computed(
  () =>
    countNavRows(groupedExamples.value) + (hasSectionTabs.value ? 0 : anchorLinks.value.length) > 1,
)

// Keep the active example in view — the list runs long enough that a deep link
// otherwise opens with the sidebar scrolled to the top, nowhere near it.
onMounted(() => {
  watch(() => route.path, () => nextTick(revealActiveLink), { immediate: true })
})

/**
 * Centre the active link inside the sidebar's own scrollport. Deliberately NOT
 * `el.scrollIntoView()`: that scrolls every scrolling box up to the viewport, so
 * it also moves the window — undoing the router's scroll-to-top on navigation.
 */
function revealActiveLink() {
  const el = document.querySelector('[data-active-docs-link]')
  const box = el && scrollport(el)
  // No scrollport → the tree fits, so the link is already in view.
  if (!el || !box) return
  const link = el.getBoundingClientRect()
  const view = box.getBoundingClientRect()
  box.scrollTop += link.top - view.top - (box.clientHeight - link.height) / 2
}

/** Nearest ancestor that actually scrolls vertically. */
function scrollport(el: Element): HTMLElement | undefined {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const overflowY = getComputedStyle(p).overflowY
    if ((overflowY === 'auto' || overflowY === 'scroll') && p.scrollHeight > p.clientHeight) {
      return p
    }
  }
}
</script>

<template>
  <Container>
    <Page :ui="{ left: 'pr-2 border-r border-border' }">
      <template v-if="hasSidebar" #left>
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
