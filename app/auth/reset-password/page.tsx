'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Mail, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    if (!email) {
      setErrorMessage('Please enter your account email.')
      return
    }

    startTransition(async () => {
      try {
        const supabase = createClient()
        const redirectUrl =
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
          `${window.location.origin}/auth/callback?next=/auth/reset-password`

        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: redirectUrl,
        })

        if (error) {
          setErrorMessage(error.message)
          return
        }

        setSuccess(true)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An error occurred.'
        setErrorMessage(message)
      }
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card/60 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
      <div className="space-y-2 mb-6">
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to sign in</span>
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Reset password
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Enter your registered merchant email to receive a password reset link.
        </p>
      </div>

      {success ? (
        <div className="rounded-lg border border-primary/20 bg-primary/10 p-4 space-y-2 text-center">
          <div className="mx-auto flex size-8 items-center justify-center rounded-full bg-primary/20 text-primary">
            <CheckCircle2 className="size-4" />
          </div>
          <p className="text-xs text-foreground font-medium">Check your inbox</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            If an account exists for <span className="font-mono text-foreground">{email}</span>, we have sent instructions to reset your password.
          </p>
        </div>
      ) : (
        <>
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
                Registered Email
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

            <button
              type="submit"
              disabled={isPending}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Sending reset link...</span>
                </>
              ) : (
                <span>Send Reset Link</span>
              )}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
