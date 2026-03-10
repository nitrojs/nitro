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
    <NuxtLink to="/llms.txt" class="basis-full text-sm text-muted hover:text-default transition-colors inline-flex items-center justify-center gap-1">
      <UIcon name="i-lucide-bot" />
      Docs for Agents
    </NuxtLink>
  </div>
</template>
