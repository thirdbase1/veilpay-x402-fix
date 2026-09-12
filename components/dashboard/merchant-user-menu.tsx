'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { shortPublicKey } from '@/lib/wallet/oneam-auth'
import { User, LogOut, ChevronDown, CheckCircle2, Shield, Loader2 } from 'lucide-react'

interface MerchantUserMenuProps {
  initialBusinessName?: string | null
}

export function MerchantUserMenu({ initialBusinessName }: MerchantUserMenuProps) {
  const router = useRouter()
  const [walletId, setWalletId] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState<string | null>(initialBusinessName || null)
  const [isOpen, setIsOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const pubkey = user.user_metadata?.wallet_pubkey
        setWalletId(typeof pubkey === 'string' ? pubkey : null)

        if (!businessName) {
          const { data: profile } = await supabase
            .from('merchant_profiles')
            .select('business_name')
            .eq('auth_user_id', user.id)
            .maybeSingle()

          if (profile?.business_name) {
            setBusinessName(profile.business_name)
          }
        }
      }
    }
    loadUser()
  }, [businessName])

  async function handleSignOut() {
    setIsSigningOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/auth/login')
      router.refresh()
    } catch {
      setIsSigningOut(false)
    }
  }

  const displayName = businessName || (walletId ? shortPublicKey(walletId) : 'Merchant')
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-border/80 bg-card/60 px-2.5 sm:px-3 text-xs text-foreground transition hover:border-border hover:bg-card focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="flex size-5 sm:size-6 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary font-mono shrink-0">
          {initial}
        </span>
        <span className="hidden sm:inline max-w-[100px] md:max-w-[140px] truncate font-medium text-foreground">
          {displayName}
        </span>
        <ChevronDown className="size-3 text-muted-foreground shrink-0 hidden sm:block" />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur-xl"
          role="menu"
        >
          <div className="mb-2 pb-2 border-b border-border/60">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-primary uppercase tracking-wider">
              <Shield className="size-3 text-primary" />
              <span>Verified Merchant</span>
            </div>
            <p className="mt-1 font-semibold text-xs text-foreground truncate">
              {displayName}
            </p>
            {walletId && (
              <p className="font-mono text-[11px] text-muted-foreground truncate">
                {shortPublicKey(walletId)}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <button
              type="button"
              disabled={isSigningOut}
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-rose-400 transition hover:bg-rose-950/20 disabled:opacity-50"
            >
              {isSigningOut ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <LogOut className="size-3.5" />
              )}
              <span>{isSigningOut ? 'Signing Out...' : 'Sign Out'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
