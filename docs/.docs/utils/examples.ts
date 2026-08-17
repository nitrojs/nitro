import type { NavItem } from 'undocs/src/server/content/types'

// Category order for examples - used in sidebar and examples page
export const categoryOrder = [
  'features',
  'config',
  'server side rendering',
  'backend frameworks',
  'integrations',
  'vite',
]

export const categoryIcons: Record<string, string> = {
  vite: 'i-logos-vitejs',
  'backend frameworks': 'i-lucide-puzzle',
  features: 'i-lucide-sparkles',
  config: 'i-lucide-settings',
  integrations: 'i-lucide-plug',
  'server side rendering': 'i-lucide-server',
  other: 'i-lucide-folder',
}

export interface ExampleGroup {
  category: string
  title: string
  icon: string
  items: NavItem[]
}

/**
 * Group `/examples/*` entries of the content navigation tree by their category.
 *
 * The category comes from each example's `navigation.category` frontmatter —
 * only the `navigation` object of a page's frontmatter is carried into the nav
 * tree by undocs, so plain top-level frontmatter keys are not available here.
 */
export function groupExamples(navigation: NavItem[] | undefined): ExampleGroup[] {
  const section = (navigation || []).find((item) => item.path === '/examples')
  // The section's own index page is re-emitted as its first child; drop it.
  const examples = (section?.children || []).filter((item) => item.path !== '/examples')

  const groups = new Map<string, NavItem[]>()
  for (const example of examples) {
    const category = String(example.category || 'other').toLowerCase()
    const group = groups.get(category)
    if (group) {
      group.push(example)
    } else {
      groups.set(category, [example])
    }
  }

  return [...groups].sort(byCategoryOrder).map(([category, items]) => ({
    category,
    title: titleCase(category),
    icon: categoryIcons[category] || categoryIcons.other,
    items,
  }))
}

function byCategoryOrder([a]: [string, unknown], [b]: [string, unknown]): number {
  const aIndex = categoryOrder.indexOf(a)
  const bIndex = categoryOrder.indexOf(b)
  if (aIndex === -1 && bIndex === -1) return a.localeCompare(b)
  if (aIndex === -1) return 1
  if (bIndex === -1) return -1
  return aIndex - bIndex
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase())
}
