'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, Lock, Mail, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'

export default function SignUpPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successEmail, setSuccessEmail] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    if (!email || !password || !confirmPassword) {
      setErrorMessage('Please fill in all required fields.')
      return
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.')
      return
    }

    startTransition(async () => {
      try {
        const supabase = createClient()
        const redirectUrl =
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
          `${window.location.origin}/auth/callback?next=/onboarding`

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirectUrl,
          },
        })

        if (error) {
          setErrorMessage(error.message)
          return
        }

        // Check if session was granted immediately (email confirmation disabled or dev environment)
        if (data.session && data.user) {
          router.push('/onboarding')
          router.refresh()
          return
        }

        // If email confirmation required
        if (data.user && !data.session) {
          setSuccessEmail(email.trim())
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An error occurred during account creation.'
        setErrorMessage(message)
      }
    })
  }

  if (successEmail) {
    return (
      <div className="rounded-xl border border-border bg-card/60 backdrop-blur-xl p-6 sm:p-8 shadow-2xl space-y-5 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary">
          <CheckCircle2 className="size-6" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Check your email
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            We sent a verification link to{' '}
            <span className="font-mono text-foreground font-medium">{successEmail}</span>.
            Click the link to verify your merchant account and begin onboarding.
          </p>
        </div>
        <div className="pt-4 border-t border-border/50">
          <Link
            href="/auth/login"
            className="text-xs text-primary hover:underline font-medium"
          >
            Return to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card/60 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
      <div className="space-y-2 mb-6">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-mono text-primary font-medium">
          Merchant Registration
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Create VeilPay Account
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Deploy zero-knowledge payment intents with programmable privacy.
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
              placeholder="billing@company.com"
              className="w-full rounded-lg border border-border bg-background/80 py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="block text-xs font-medium text-muted-foreground uppercase tracking-wider"
          >
            Password (min. 8 characters)
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60 pointer-events-none" />
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
              className="w-full rounded-lg border border-border bg-background/80 py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="confirm-password"
            className="block text-xs font-medium text-muted-foreground uppercase tracking-wider"
          >
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60 pointer-events-none" />
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
              <span>Creating account...</span>
            </>
          ) : (
            <>
              <span>Continue to Onboarding</span>
              <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-border/50 text-center">
        <p className="text-xs text-muted-foreground">
          Already have an account?{' '}
          <Link
            href="/auth/login"
            className="font-medium text-primary hover:underline transition-all"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
