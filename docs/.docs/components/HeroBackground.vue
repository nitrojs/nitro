<script setup lang="ts">
import { ref, onMounted, defineAsyncComponent } from 'vue'

const Shader = defineAsyncComponent(() => import('shaders/vue').then(m => m.Shader))
const ChromaFlow = defineAsyncComponent(() => import('shaders/vue').then(m => m.ChromaFlow))

const enabled = ref(false)
const ready = ref(false)

// The app shell paints its own themed `hero` aura behind the landing, which is
// redundant once the shader draws. The CSS below hides it by DEFAULT and this
// puts it back for visitors who turn out not to be getting a shader — the
// inverse of the obvious wiring, because the landing is prerendered: the aura
// ships in the SSR markup and paints from the first frame, so hiding it from JS
// meant it was always briefly visible before the shader took over. Hidden by
// default it simply never paints, and only the fallback path pays a fade-in.
//
// Deliberately not cleared on unmount: it records a fact about the visitor's
// machine, not about this page, so keeping it avoids a flicker if they navigate
// away and come back.
function useAura() {
  document.documentElement.classList.add('no-hero-shader')
}

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
  useAura()
  console.info(`[hero] shader background stopped — the GPU reported \`${reason}\`. Falling back to the aura backdrop.`)
}

onMounted(() => {
  const reason = skipReason()
  if (reason) {
    useAura()
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
/* Hide the app shell's hero aura up front, and fade it back in only for the
   visitors `no-hero-shader` marks as not getting a shader. This stylesheet is a
   render-blocking `<link>` in the prerendered landing's `<head>`, so the aura
   never paints for anyone else — no fallback glow flashing past before the
   shader arrives.

   Unscoped on purpose: `.aura--hero` belongs to undocs' own `AuraBackground`,
   mounted up in the app shell. Only the hero variant is touched — `.aura--docs`
   still runs on every other page, where this component never mounts. Opacity is
   set on the wrapper, which composes with the per-theme opacity `AuraBackground`
   puts on its inner layer rather than fighting it. */
.aura--hero {
  opacity: 0;
  transition: opacity 700ms;
}

:root.no-hero-shader .aura--hero {
  opacity: 1;
}
</style>
