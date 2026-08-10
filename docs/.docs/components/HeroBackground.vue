<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue'

const Shader = defineAsyncComponent(() => import('shaders/vue').then(m => m.Shader))
const ChromaFlow = defineAsyncComponent(() => import('shaders/vue').then(m => m.ChromaFlow))

const enabled = ref(false)
const ready = ref(false)

// The app shell paints its own themed `hero` aura behind the landing, which is
// redundant once the shader is actually drawing. Flag the document only while
// the shader is live — everyone who never gets one (no WebGPU, mobile, low-end,
// or a GPU that gave up) still gets the aura as the fallback backdrop.
const live = computed(() => enabled.value && ready.value)
watch(live, (isLive: boolean) => {
  document.documentElement.classList.toggle('has-hero-shader', isLive)
})
onUnmounted(() => document.documentElement.classList.remove('has-hero-shader'))

// Why the shader is not running, or `null` when nothing rules it out. `shaders`
// v3 is WebGPU-only — there is no WebGL2 fallback anymore, and on a browser
// without WebGPU it just renders a transparent canvas. Checking `navigator.gpu`
// (what the library's own `isWebGPUSupported()` does) keeps us from downloading
// the renderer at all on Firefox / Safari < 26. It only rules out browsers with
// no WebGPU API — a blocklisted driver or a denied adapter surfaces later
// through `@unavailable`.
function skipReason(): string | null {
  const deviceMemory = (navigator as any).deviceMemory as number | undefined

  if (!('gpu' in navigator)) {
    return 'this browser has no WebGPU — `navigator.gpu` is undefined (Firefox, Safari < 26). The renderer is WebGPU-only since v3, so there is nothing to fall back to'
  }
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768) {
    return `mobile or narrow viewport (${window.innerWidth}px) — not worth the battery for a decorative background`
  }
  if (deviceMemory !== undefined && deviceMemory < 4) {
    return `navigator.deviceMemory is ${deviceMemory} GB (< 4)`
  }
  if (navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency < 4) {
    return `navigator.hardwareConcurrency is ${navigator.hardwareConcurrency} (< 4)`
  }
  return null
}

// Logged rather than silent: without it a missing hero shader is indis-
// tinguishable from a broken one, and the library itself stays quiet by design.
function onUnavailable(reason: string) {
  enabled.value = false
  console.info(`[hero] shader background stopped — the GPU reported \`${reason}\`. Falling back to the aura backdrop.`)
}

onMounted(() => {
  const reason = skipReason()
  if (reason) {
    console.info(`[hero] shader background disabled — ${reason}. Falling back to the aura backdrop.`)
    return
  }
  enabled.value = true
})
</script>

<template>
  <!-- Faded in on the renderer's first frame so a failed init never leaves a
       blank canvas sitting on top of the hero, and torn down again if the GPU
       gives up later (denied adapter, lost device). `disable-telemetry` opts the
       docs site out of the usage beacon the renderer otherwise samples. -->
  <Shader
    v-if="enabled"
    class="absolute inset-0 w-full h-full -z-10 transition-opacity duration-700"
    :class="ready ? 'opacity-100' : 'opacity-0'"
    disable-telemetry
    @ready="ready = true"
    @unavailable="onUnavailable"
  >
    <ChromaFlow
      base-color="oklch(71.2% 0.194 13.428)"
      up-color="oklch(70.2% 0.183 293.541)"
      down-color="oklch(70.2% 0.183 293.541)"
      right-color="oklch(70.2% 0.183 293.541)"
      left-color="oklch(70.2% 0.183 293.541)"
      :opacity="0.5"
      :intensity="0.7"
    />
  </Shader>
</template>

<style>
/* Cross-fade the app shell's hero aura out on the same curve the shader fades
   in on, so the landing never shows both glows stacked. Unscoped on purpose:
   `.aura--hero` belongs to undocs' own `AuraBackground`, mounted up in the app
   shell. Only the hero variant is touched — `.aura--docs` still runs on every
   other page, where this component never mounts. */
.aura--hero {
  transition: opacity 700ms;
}

:root.has-hero-shader .aura--hero {
  opacity: 0;
}
</style>
