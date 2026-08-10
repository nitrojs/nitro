<script setup lang="ts">
import { ref } from 'vue'
import Button from 'undocs/src/app/components/ui/Button.vue'
import Icon from 'undocs/src/app/components/global/Icon.vue'

const copied = ref(false)

function copyPrompt() {
  const text = `Read nitro docs from ${window.location.origin}/docs/quick-start so I can ask questions about it.`
  navigator.clipboard.writeText(text)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-4">
    <Button
      size="lg"
      to="/docs/quick-start"
      trailing-icon="i-lucide-arrow-right"
    >
      Get started
    </Button>
    <Button
      color="neutral"
      variant="outline"
      icon="i-simple-icons-github"
      size="lg"
      target="_blank"
      to="https://github.com/nitrojs/nitro"
    >
      Star on GitHub
    </Button>
    <a
      href="/llms.txt"
      target="_blank"
      class="basis-full text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center justify-center gap-1"
      @click="copyPrompt"
    >
      <Icon :name="copied ? 'i-lucide-clipboard-check' : 'i-lucide-bot'" class="size-4" />
      Docs for AI
    </a>
  </div>
</template>
