import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Private Checkout | VeilPay',
  description:
    'Private payment verification on the Midnight network. Disclose only what the payment condition requires.',
  robots: {
    index: false,
    follow: false,
  },
}

export default function PayLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
