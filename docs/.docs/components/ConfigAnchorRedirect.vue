<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'undocs/src/app/router'
import { legacyConfigAnchors, legacyConfigSections } from '../utils/configAnchors'

// The config reference used to be a single page: forward old `/config#<anchor>`
// links to the page the option moved to.
const router = useRouter()

onMounted(() => {
  const anchor = decodeURIComponent(window.location.hash.slice(1)).toLowerCase()
  if (!anchor) {
    return
  }
  const page = Object.keys(legacyConfigAnchors).find((page) => legacyConfigAnchors[page]!.includes(anchor))
  const target = page ? `/config/${page}#${anchor}` : legacyConfigSections[anchor]
  if (target) {
    void router.replace(target)
  }
})
</script>

<template>
  <div hidden />
</template>
