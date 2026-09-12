import { routes } from '@/lib/config'

export interface NavLink {
  label: string
  href: string
  /** Whether this is an in-page anchor on the landing page. */
  anchor?: boolean
}

export const primaryNav: NavLink[] = [
  { label: 'Product', href: '#product', anchor: true },
  { label: 'How It Works', href: '#how-it-works', anchor: true },
  { label: 'Privacy', href: '#privacy', anchor: true },
  { label: 'Developers', href: '#developers', anchor: true },
]

export const utilityNav = {
  explorer: { label: 'Explorer', href: routes.explorer },
  app: { label: 'Launch App', href: routes.app },
} as const
