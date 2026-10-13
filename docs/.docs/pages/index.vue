<script setup lang="ts">
import { createError } from 'undocs/src/app/composables/createError'
import { queryPage } from 'undocs/src/app/composables/useContent'
import { useAsyncData } from 'undocs/src/app/composables/useAsyncData'
import { usePageSEO } from 'undocs/src/app/composables/usePageSEO'
import MarkdownRenderer from 'undocs/src/app/content/MarkdownRenderer'

// Overrides the built-in landing: `docs/index.md` already ships its own hero.
const { data: page } = await useAsyncData('index', () => queryPage('/'))
if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
}

const seo = (page.value.meta?.seo || {}) as { title?: string, description?: string }

usePageSEO({
  title: seo.title || page.value.title,
  description: seo.description || page.value.description,
})

// The landing reveals on scroll, which server-renders as inline `opacity: 0` /
// `width: 0%` that only motion-v can clear — without JS everything below the
// hero would stay invisible. This has to reach the template as a STRING: Vue's
// compiler rejects a `<style>` tag written in a template, `<noscript>` included.
const noscriptCss = `<style>
  .landing .reveal { opacity: 1 !important; transform: none !important; }
  .landing .reveal-bar { width: 100% !important; }
</style>`
</script>

<template>
  <div v-if="page" class="landing">
    <MarkdownRenderer :value="page" />
    <!-- eslint-disable-next-line vue/no-v-html -->
    <noscript v-html="noscriptCss" />
  </div>
</template>

<style>
@font-face {
  font-family: "Geist Pixels";
  src: url("../assets/fonts/GeistPixel-Square.woff2") format("woff2");
  font-weight: 500;
  font-display: swap;
}

.landing h1 {
  font-family: "Geist Pixels", var(--font-sans);
}
</style>
