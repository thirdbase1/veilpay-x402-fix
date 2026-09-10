'use client'

import { useState, useTransition, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawRedirect = searchParams.get('redirect') || '/app'
  const redirectTarget = (rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')) ? rawRedirect : '/app'
  const callbackError = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(
    callbackError ? 'Authentication session failed or expired. Please sign in again.' : null
  )
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    if (!email || !password) {
      setErrorMessage('Please enter both your email and password.')
      return
    }

    startTransition(async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (error) {
          if (error.message.toLowerCase().includes('email not confirmed')) {
            setErrorMessage('Your email address has not been confirmed yet. Please verify your inbox.')
          } else if (error.message.toLowerCase().includes('invalid login credentials')) {
            setErrorMessage('Invalid email or password. Please verify your credentials.')
          } else {
            setErrorMessage(error.message)
          }
          return
        }

        if (data.user) {
          // Check if user has an active merchant profile
          const { data: profile } = await supabase
            .from('merchant_profiles')
            .select('onboarding_status')
            .eq('auth_user_id', data.user.id)
            .maybeSingle()

          if (!profile || profile.onboarding_status !== 'completed') {
            router.push('/onboarding')
          } else {
            router.push(redirectTarget)
          }
          router.refresh()
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred during sign in.'
        setErrorMessage(message)
      }
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card/60 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
      <div className="space-y-2 mb-6">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-mono text-primary font-medium">
          Merchant Portal
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Sign in to VeilPay
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Access your merchant dashboard, intents, and settlement proofs.
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200"
        >
          <AlertCircle className="size-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-xs font-medium text-muted-foreground uppercase tracking-wider"
          >
            Business Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60 pointer-events-none" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="merchant@domain.com"
              className="w-full rounded-lg border border-border bg-background/80 py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-xs font-medium text-muted-foreground uppercase tracking-wider"
            >
              Password
            </label>
            <Link
              href="/auth/reset-password"
              className="text-xs text-primary/80 hover:text-primary transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60 pointer-events-none" />
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
              className="w-full rounded-lg border border-border bg-background/80 py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full mt-2 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Authenticating...</span>
            </>
          ) : (
            <>
              <span>Sign In to Dashboard</span>
              <ArrowRight className="size-4" />
            </>
          )}
        </button>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/60" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-mono text-muted-foreground">
            <span className="bg-card px-2">or quick evaluation</span>
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            setErrorMessage(null)
            try {
              const res = await fetch('/api/auth/demo-session', { method: 'POST' })
              const data = await res.json()
              if (!res.ok) throw new Error(data.error || 'Demo sign in failed')
              router.push('/app')
              router.refresh()
            } catch (err: unknown) {
              setErrorMessage(err instanceof Error ? err.message : 'Demo sign in failed')
            }
          }}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-border/80 bg-secondary/80 py-2.5 px-4 text-xs font-semibold text-foreground hover:bg-secondary transition-colors"
        >
          <span>Continue as Demo Merchant</span>
          <ArrowRight className="size-3.5 text-muted-foreground" />
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-border/50 text-center">
        <p className="text-xs text-muted-foreground">
          New to VeilPay?{' '}
          <Link
            href="/auth/signup"
            className="font-medium text-primary hover:underline transition-all"
          >
            Create Merchant Account
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-center text-xs text-muted-foreground py-8">Loading authentication...</div>}>
      <LoginForm />
    </Suspense>
  )
}
