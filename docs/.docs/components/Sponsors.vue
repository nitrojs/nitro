<script setup lang="ts">
// `PageSponsors` fetches during setup, so it isn't registered for Markdown
// directly — it needs its own `<Suspense>` boundary to render on the server.
import { Suspense } from 'vue'
import PageSponsors from 'undocs/src/app/components/blocks/PageSponsors.vue'
</script>

<template>
  <Suspense>
    <PageSponsors />
  </Suspense>
</template>
