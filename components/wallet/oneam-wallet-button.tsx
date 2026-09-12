'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { ChevronDown, LogOut, LayoutDashboard, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { shortPublicKey } from '@/lib/wallet/oneam-auth'
import { WalletConnectModal } from './wallet-connect-modal'
import { cn } from '@/lib/utils'

interface OneAmWalletButtonProps {
  className?: string
}

/**
 * The 1AM Wallet nav control. When no wallet is connected, clicking it opens
 * the inline connect dialog. When connected, it shows the wallet identity and
 * opens a menu with the merchant console and sign-out.
 */
export function OneAmWalletButton({ className }: OneAmWalletButtonProps) {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setLoaded(true))

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  async function handleSignOut() {
    setSigningOut(true)
    setMenuOpen(false)
    try {
      await createClient().auth.signOut()
      // Also drop the remembered wallet connection so the next connect is a
      // fresh sign-in instead of a silent session restore.
      window.localStorage.removeItem('veilpay.connectedWalletId')
      router.refresh()
    } finally {
      setSigningOut(false)
    }
  }

  const pubkey =
    session && typeof session.user.user_metadata?.wallet_pubkey === 'string'
      ? (session.user.user_metadata.wallet_pubkey as string)
      : null

  if (!loaded) {
    return (
      <span
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-muted-foreground',
          className,
        )}
        aria-hidden="true"
      >
        <Loader2 className="size-4 animate-spin" />
      </span>
    )
  }

  return (
    <>
      {session && pubkey ? (
        <div ref={menuRef} className={cn('relative', className)}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Image src="/wallets/1am.png" alt="" aria-hidden="true" width={16} height={16} className="size-4 rounded-full" />
            <span className="font-mono text-xs">{shortPublicKey(pubkey)}</span>
            <ChevronDown className={cn('size-3.5 transition-transform', menuOpen && 'rotate-180')} />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-lg border border-border bg-card shadow-xl"
            >
              <div className="border-b border-border/70 px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  1AM Wallet
                </p>
                <p className="font-mono text-xs text-foreground">{shortPublicKey(pubkey)}</p>
              </div>
              <Link
                href="/app"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring-inset"
              >
                <LayoutDashboard className="size-4 text-muted-foreground" />
                Merchant Console
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-destructive transition-colors hover:bg-secondary disabled:opacity-50"
              >
                {signingOut ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LogOut className="size-4" />
                )}
                Sign Out
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
        >
          <Image src="/wallets/1am.png" alt="" aria-hidden="true" width={16} height={16} className="size-4 rounded-full" />
          <span>1AM Wallet</span>
        </button>
      )}

      <WalletConnectModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
