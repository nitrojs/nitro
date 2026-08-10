// Accent palette for the landing blocks.
//
// These class names MUST live in `.docs/**` — Tailwind only scans the theme
// layer (and undocs' own sources), not the docs Markdown, so utility classes
// written in frontmatter generate no CSS. Markdown passes a color NAME
// (`color: amber`) and the components resolve it here.
export interface Accent {
  /** Icon / label color. */
  text: string
  /** Icon chip + progress-bar tint. */
  bg: string
  /** Card border on hover. */
  border: string
  /** Solid progress-bar fill. */
  bar: string
}

export const accents = {
  amber: {
    text: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'group-hover:border-amber-500/30',
    bar: 'bg-amber-500',
  },
  sky: {
    text: 'text-sky-500',
    bg: 'bg-sky-500/10',
    border: 'group-hover:border-sky-500/30',
    bar: 'bg-sky-500',
  },
  emerald: {
    text: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'group-hover:border-emerald-500/30',
    bar: 'bg-emerald-500',
  },
  violet: {
    text: 'text-violet-500',
    bg: 'bg-violet-500/10',
    border: 'group-hover:border-violet-500/30',
    bar: 'bg-violet-500',
  },
  primary: {
    text: 'text-primary',
    bg: 'bg-primary/10',
    border: 'group-hover:border-primary/30',
    bar: 'bg-primary',
  },
} satisfies Record<string, Accent>

/**
 * Keeps the `themeColor` palette alive for Tailwind.
 *
 * undocs re-points `--primary` at `var(--color-<themeColor>-600)` (light) /
 * `-500` (dark) from a `<style>` tag injected at runtime — CSS that Tailwind
 * never parses. Tailwind v4 tree-shakes `--color-*` theme variables no scanned
 * source uses, so without a literal `rose` utility somewhere under `.docs/`,
 * those variables are dropped, `--primary` becomes invalid, and EVERY
 * `*-primary` utility silently dies: grey hero buttons, no aura, flat black
 * landing. Keep this in sync with `themeColor` in `.config/docs.yaml`.
 */
export const themePaletteKeepAlive = 'bg-rose-600 bg-rose-500'

export type AccentName = keyof typeof accents

export function accent(name?: string): Accent {
  return accents[name as AccentName] || accents.primary
}
