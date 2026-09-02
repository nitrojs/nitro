<script setup lang="ts">
import AppLink from 'undocs/src/app/components/app/AppLink'
import Container from 'undocs/src/app/components/Container.vue'
import Icon from 'undocs/src/app/components/global/Icon.vue'
import Reveal from './Reveal.vue'

defineProps<{
  eyebrow?: string
  link?: string
  linkLabel?: string
  points?: string[]
  /** Puts the visual on the left; alternate it down the page. */
  reverse?: boolean
}>()
</script>

<template>
  <section class="border-t border-border">
    <Container>
      <div class="grid items-center gap-10 py-16 lg:grid-cols-12 lg:gap-16 lg:py-24">
        <Reveal :class="['min-w-0 lg:col-span-5', reverse ? 'lg:order-2' : 'lg:order-1']">
          <p
            v-if="eyebrow"
            class="flex items-center gap-2 font-mono text-label-12 uppercase tracking-[0.2em] text-muted-foreground"
          >
            <span class="size-1.5 rounded-full bg-brand" />
            {{ eyebrow }}
          </p>

          <h2 class="mt-5 text-heading-24 sm:text-heading-32 text-foreground text-balance">
            <slot name="title" />
          </h2>

          <!-- A div, not a paragraph: the slot holds rendered markdown, which for
               a multi-block fill carries its own paragraphs. Nesting them is
               invalid HTML, and the browser's repair leaves a DOM that no longer
               matches the vdom, so hydration mismatches. -->
          <div class="landing-copy mt-4 text-copy-16 text-muted-foreground text-pretty">
            <slot name="description" />
          </div>

          <ul v-if="points?.length" class="mt-6 flex flex-col gap-2.5">
            <li
              v-for="point in points"
              :key="point"
              class="flex items-start gap-2.5 text-copy-14 text-muted-foreground"
            >
              <Icon name="i-lucide-check" class="mt-0.5 size-3.5 shrink-0 text-brand" />
              <span>{{ point }}</span>
            </li>
          </ul>

          <AppLink
            v-if="link"
            :to="link"
            class="group mt-7 inline-flex items-center gap-1.5 text-copy-14 font-medium text-brand hover:text-brand-hover"
          >
            {{ linkLabel || 'Learn more' }}
            <Icon
              name="i-lucide-arrow-right"
              class="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </AppLink>
        </Reveal>

        <Reveal
          :delay="0.08"
          :class="['min-w-0 lg:col-span-7', reverse ? 'lg:order-1' : 'lg:order-2']"
        >
          <slot name="visual" />
        </Reveal>
      </div>
    </Container>
  </section>
</template>

<style scoped>
/* Code blocks arrive from markdown with prose margins that double up against
   the grid gap. */
.landing-copy :deep(p:first-child) {
  margin-top: 0;
}
.landing-copy :deep(p:last-child) {
  margin-bottom: 0;
}
.landing-copy :deep(code) {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.9em;
  color: var(--foreground);
}
</style>
