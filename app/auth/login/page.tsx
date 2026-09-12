'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { WalletConnectForm } from '@/components/wallet/wallet-connect-form'

function LoginPageInner() {
  const searchParams = useSearchParams()
  const rawRedirect = searchParams.get('redirect') || '/app'
  const redirectTarget =
    rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/app'
  const callbackError = searchParams.get('error')

  return (
    <div className="rounded-xl border border-border bg-card/60 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
      <WalletConnectForm
        redirect={redirectTarget}
        initialError={
          callbackError
            ? 'Authentication session failed or expired. Please connect your wallet again.'
            : null
        }
      />
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center text-xs text-muted-foreground py-8">Loading wallet login...</div>
      }
    >
      <LoginPageInner />
    </Suspense>
  )
}
