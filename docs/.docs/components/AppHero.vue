<script setup lang="ts">
defineProps<{
  title: string
  description: string
  primaryLink: string
  primaryLabel: string
  githubLink: string
  codeGroups: {
    filename: string
    code: string
  }[]
}>()
</script>

<template>
  <UPageHero orientation="horizontal">
    <template #default>
      <div class="code-group">
        <ProseCodeGroup>
          <ProsePre
            v-for="group in codeGroups"
            :key="group.filename"
            :filename="group.filename"
            language="ts"
          >
            <pre>{{ group.code }}</pre>
          </ProsePre>
        </ProseCodeGroup>
      </div>
    </template>

    <HeroBackground />

    <template #title>
      <span v-html="title" />
    </template>

    <template #description>
      {{ description }}
    </template>

    <template #links>
      <UButton
        size="xl"
        :to="primaryLink"
        trailing-icon="i-lucide-arrow-right"
      >
        {{ primaryLabel }}
      </UButton>
      <UButton
        color="neutral"
        icon="i-simple-icons-github"
        size="xl"
        target="_blank"
        :to="githubLink"
        variant="outline"
      >
        GitHub
      </UButton>
    </template>
  </UPageHero>
</template>
