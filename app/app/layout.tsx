import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WalletProvider } from '@/lib/wallet/context'

export const metadata: Metadata = {
  title: 'Merchant Dashboard — VeilPay',
  description: 'Manage and monitor privacy-preserving invoices on Midnight.',
  robots: { index: false },
}

export default async function AppRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  return <WalletProvider>{children}</WalletProvider>
}
