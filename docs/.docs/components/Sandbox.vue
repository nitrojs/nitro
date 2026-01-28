<script setup lang="ts">
const props = defineProps<{
  src?: string
  repo?: string
  branch?: string
  dir?: string
  file?: string
}>()

const colorMode = useColorMode()

const url = computed(() => {
  if (props.src) {
    return props.src
  }
  const base = `https://stackblitz.com/github/${props.repo}/tree/${props.branch || 'main'}/${props.dir || ''}`
  const params = new URLSearchParams({
    embed: '1',
    file: props.file || 'README.md',
    theme: colorMode.value,
  })
  return `${base}?${params.toString()}`
})
</script>

<template>
  <div class="w-full min-h-[500px] mx-auto overflow-hidden rounded-md mt-4 border border-default">
    <iframe
      v-if="url"
      :src="url"
      title="StackBlitz Sandbox"
      sandbox="allow-modals allow-forms allow-popups allow-scripts allow-same-origin"
      class="w-full h-full min-h-[600px] overflow-hidden bg-gray-100 dark:bg-gray-800"
    />
    <div v-else class="flex items-center justify-center h-[600px] text-muted">
      Loading Sandbox...
    </div>
  </div>
</template>
