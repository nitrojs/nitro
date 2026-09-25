import { onMounted, ref, type Ref } from 'vue'

/**
 * Resolves after mount, which is early enough for every animation on the
 * landing: they are all `whileInView`, so nothing can have run yet. Keeping the
 * initial value `false` also keeps the SSR markup and the first client render
 * in agreement — the media query is not answerable on the server.
 */
export function useReducedMotion(): Ref<boolean> {
  const reduced = ref(false)

  onMounted(() => {
    reduced.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  return reduced
}
