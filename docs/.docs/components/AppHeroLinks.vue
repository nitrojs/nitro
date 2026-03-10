<template>
  <div class="flex flex-wrap items-center justify-center gap-4">
    <UButton
      size="xl"
      to="/docs/quick-start"
      trailing-icon="i-lucide-arrow-right"
    >
      Get started
    </UButton>
    <UButton
      color="neutral"
      icon="i-simple-icons-github"
      size="xl"
      target="_blank"
      to="https://github.com/nitrojs/nitro"
      variant="outline"
    >
      Star on GitHub
    </UButton>
    <a
      :href="`${baseURL}llms.txt`"
      target="_blank"
      class="basis-full text-sm text-muted hover:text-default transition-colors inline-flex items-center justify-center gap-1"
      @click.prevent="copyPrompt"
    >
      <UIcon :name="copied ? 'i-lucide-clipboard-check' : 'i-lucide-bot'" />
      Docs for AI
    </a>
  </div>
</template>

<script setup lang="ts">
const copied = ref(false)
const baseURL = computed(() => {
  if (import.meta.client) {
    return `${window.location.origin}/`
  }
  return '/'
})

function copyPrompt() {
  const text = `Read nitro docs from ${baseURL.value}docs/quick-start so I can ask questions about it.`
  navigator.clipboard.writeText(text)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}
</script>
