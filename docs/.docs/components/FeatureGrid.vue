<script setup lang="ts">
import AppLink from 'undocs/src/app/components/app/AppLink'
import Container from 'undocs/src/app/components/Container.vue'
import Icon from 'undocs/src/app/components/global/Icon.vue'
import Reveal from './Reveal.vue'

defineProps<{
  eyebrow?: string
  title?: string
  description?: string
  features: {
    title: string
    description: string
    icon: string
    to?: string
    /** Small chip next to the title, e.g. `Experimental`. */
    badge?: string
  }[]
}>()
</script>

<template>
  <section class="border-t border-border">
    <Container>
      <div class="py-16 lg:py-24">
        <Reveal class="max-w-2xl">
          <p
            v-if="eyebrow"
            class="flex items-center gap-2 font-mono text-label-12 uppercase tracking-[0.2em] text-muted-foreground"
          >
            <span class="size-1.5 rounded-full bg-brand" />
            {{ eyebrow }}
          </p>
          <h2 v-if="title" class="mt-5 text-heading-24 sm:text-heading-32 text-foreground text-balance">
            {{ title }}
          </h2>
          <p v-if="description" class="mt-4 text-copy-16 text-muted-foreground text-pretty">
            {{ description }}
          </p>
        </Reveal>

        <Reveal :delay="0.08" class="mt-10">
          <div class="overflow-hidden rounded-xl border border-border bg-card">
            <div class="-mr-px -mb-px grid sm:grid-cols-2 lg:grid-cols-3">
              <component
                :is="feature.to ? AppLink : 'div'"
                v-for="feature in features"
                :key="feature.title"
                :to="feature.to || undefined"
                class="group flex flex-col gap-2 border-r border-b border-border p-6 no-underline transition-colors hover:bg-muted"
              >
                <div class="flex items-center gap-2.5">
                  <Icon :name="feature.icon" class="size-4 shrink-0 text-brand" />
                  <h3 class="text-heading-14 text-foreground">{{ feature.title }}</h3>
                  <span
                    v-if="feature.badge"
                    class="rounded border border-border px-1.5 py-px text-label-12 text-muted-foreground"
                  >
                    {{ feature.badge }}
                  </span>
                </div>
                <p class="text-copy-14 text-muted-foreground text-pretty">
                  {{ feature.description }}
                </p>
              </component>
            </div>
          </div>
        </Reveal>
      </div>
    </Container>
  </section>
</template>
