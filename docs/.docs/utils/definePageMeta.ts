// `definePageMeta` stand-in for the undocs theme layer (there are no auto-imports).
//
// `layout` is resolved at BUILD time: the `undocs:user-theme` Vite plugin
// statically reads the `definePageMeta({ layout: "..." })` call in each
// `.docs/pages/**` file, so the value must stay a plain string literal. Nothing
// happens at runtime — `AppLayout` picks the layout before the page's
// `<script setup>` runs, so switching it here would break SSR/hydration.
export interface PageMeta {
  layout?: string
}

export function definePageMeta(_meta: PageMeta): void {
  // no-op, see above
}
