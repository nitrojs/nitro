<template>
  <section class="relative bg-neutral-50 dark:bg-neutral-950/30 py-20 md:py-28">
    <div class="absolute inset-0 dotted-bg" />
    <div class="relative max-w-6xl mx-auto px-6">
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <slot name="body" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.dotted-bg {
  background-image: radial-gradient(circle, rgb(0 0 0 / 0.1) 1px, transparent 1px);
  background-size: 20px 20px;
}

:root.dark .dotted-bg {
  background-image: radial-gradient(circle, rgb(255 255 255 / 0.07) 1px, transparent 1px);
}
</style>
