<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'undocs/src/app/router'

// The config reference used to be a single page: forward old `/config#<option>`
// links to the page the option moved to, using the option links on `/config`.
const router = useRouter()

onMounted(() => {
  const hash = window.location.hash
  if (!hash || document.getElementById(decodeURIComponent(hash.slice(1)))) {
    return
  }
  for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href^="/config/"]')) {
    const url = new URL(link.href)
    if (url.hash.toLowerCase() === hash.toLowerCase()) {
      void router.replace(url.pathname + url.hash)
      return
    }
  }
})
</script>

<template>
  <div hidden />
</template>
