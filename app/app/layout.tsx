import type { Metadata } from 'next'
import { WalletProvider } from '@/lib/wallet/context'

export const metadata: Metadata = {
  title: 'Merchant Dashboard — VeilPay',
  description: 'Manage and monitor privacy-preserving payment intents on Midnight.',
  robots: { index: false },
}

export default function AppRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <WalletProvider>{children}</WalletProvider>
}
