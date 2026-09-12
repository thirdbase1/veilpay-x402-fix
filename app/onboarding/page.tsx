'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Wordmark } from '@/components/site/brand'
import {
  Building2,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react'

type OnboardingStep = 1 | 2 | 3 | 4

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<OnboardingStep>(1)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Step 1: Business Profile
  const [businessName, setBusinessName] = useState('')
  const [website, setWebsite] = useState('')
  const [description, setDescription] = useState('')

  // Step 2: Receiving Account
  const [receivingAddress, setReceivingAddress] = useState('')

  // Step 3: Privacy & Protocol Defaults
  const [privacyPreset, setPrivacyPreset] = useState<'strict' | 'standard'>('strict')
  const [autoExpireHours, setAutoExpireHours] = useState('24')

  function handleNextFromStep1() {
    setErrorMessage(null)
    if (!businessName.trim()) {
      setErrorMessage('Please enter your legal business or merchant brand name.')
      return
    }
    setStep(2)
  }

  function handleNextFromStep2() {
    setErrorMessage(null)
    setStep(3)
  }

  function handleNextFromStep3() {
    setErrorMessage(null)
    setStep(4)
  }

  async function handleCompleteOnboarding() {
    setErrorMessage(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/merchant/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessName,
            website,
            description,
            receivingAddress,
            privacyPreset,
            autoExpireHours: Number(autoExpireHours) || 24,
          }),
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Failed to finish onboarding.')
        }

        router.push('/app')
        router.refresh()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An error occurred while saving your profile.'
        setErrorMessage(message)
      }
    })
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-primary/20 selection:text-primary">
      {/* Top Header */}
      <header className="border-b border-border/40 bg-card/20 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <Link href="/" className="hover:opacity-90 transition-opacity">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <span className="text-foreground">Step {step}</span>
          <span>of 4</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-xl">
          {/* Progress Indicators */}
          <div className="mb-6 grid grid-cols-4 gap-2">
            {[
              { num: 1, label: 'Profile' },
              { num: 2, label: 'Settlement' },
              { num: 3, label: 'Privacy' },
              { num: 4, label: 'Review' },
            ].map((item) => {
              const isCurrent = step === item.num
              const isDone = step > item.num
              return (
                <div key={item.num} className="space-y-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-colors ${
                      isDone
                        ? 'bg-accent'
                        : isCurrent
                        ? 'bg-primary'
                        : 'bg-muted/60'
                    }`}
                  />
                  <p
                    className={`text-[11px] font-mono truncate ${
                      isCurrent
                        ? 'text-foreground font-semibold'
                        : isDone
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground/50'
                    }`}
                  >
                    {item.label}
                  </p>
                </div>
              )
            })}
          </div>

          <div className="rounded-xl border border-border bg-card/60 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
            {errorMessage && (
              <div
                role="alert"
                className="mb-6 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
              >
                <AlertCircle className="size-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* STEP 1: BUSINESS PROFILE */}
            {step === 1 && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-mono text-primary font-medium">
                    Step 1 &middot; Merchant Identity
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    Define your business profile
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    This identification will be visible to payers on your checkout receipts and invoices.
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="biz-name"
                      className="block text-xs font-semibold text-foreground tracking-tight"
                    >
                      Business or Merchant Name <span className="text-primary">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60 pointer-events-none" />
                      <input
                        id="biz-name"
                        type="text"
                        required
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="e.g. Acme Tech Labs or Satoshi Goods"
                        className="w-full rounded-lg border border-border bg-background/80 py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="biz-website"
                      className="block text-xs font-semibold text-foreground tracking-tight"
                    >
                      Website or Store URL <span className="text-muted-foreground font-normal">(Optional)</span>
                    </label>
                    <input
                      id="biz-website"
                      type="url"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://acme.org"
                      className="w-full rounded-lg border border-border bg-background/80 py-2.5 px-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="biz-desc"
                      className="block text-xs font-semibold text-foreground tracking-tight"
                    >
                      Short Description or Industry <span className="text-muted-foreground font-normal">(Optional)</span>
                    </label>
                    <input
                      id="biz-desc"
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Digital Software, Cloud Infrastructure, Private Services"
                      className="w-full rounded-lg border border-border bg-background/80 py-2.5 px-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleNextFromStep1}
                    className="flex items-center gap-2 rounded-lg bg-primary py-2.5 px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <span>Continue to Settlement</span>
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: RECEIVING ACCOUNT */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-mono text-primary font-medium">
                    Step 2 &middot; Settlement
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    Settlement & Destination Address
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Specify the default recipient address where cryptographic payment proofs and funds settle.
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="rec-addr"
                      className="block text-xs font-semibold text-foreground tracking-tight"
                    >
                      Default Midnight Recipient Address
                    </label>
                    <input
                      id="rec-addr"
                      type="text"
                      value={receivingAddress}
                      onChange={(e) => setReceivingAddress(e.target.value)}
                      placeholder="mn_merchant_destination_address..."
                      className="w-full rounded-lg border border-border bg-background/80 py-2.5 px-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    />
                    <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                      You can override this recipient on individual invoices at any time. If left blank, you will enter it during intent creation.
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3.5 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                      <ShieldCheck className="size-4 text-accent" />
                      <span>Privacy Settlement Architecture</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      VeilPay verifies payments on the Midnight network using zero-knowledge proofs. Payer wallet history, balance totals, and unassociated transactions remain completely shielded from your ledger.
                    </p>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="size-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextFromStep2}
                    className="flex items-center gap-2 rounded-lg bg-primary py-2.5 px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <span>Configure Privacy</span>
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: PRIVACY & DEFAULTS */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-mono text-primary font-medium">
                    Step 3 &middot; Protocol Defaults
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    Privacy and Expiration Presets
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Configure standard defaults applied when generating new invoices.
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <span className="block text-xs font-semibold text-foreground tracking-tight">
                      Privacy Disclosure Preset
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPrivacyPreset('strict')}
                        className={`text-left rounded-lg border p-3.5 space-y-1.5 transition-all ${
                          privacyPreset === 'strict'
                            ? 'border-primary bg-primary/10 ring-1 ring-primary'
                            : 'border-border bg-background/50 hover:border-border/80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">
                            Strict ZK Shielding
                          </span>
                          {privacyPreset === 'strict' && (
                            <CheckCircle2 className="size-3.5 text-primary" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Only condition proofs and receipt timestamps are disclosed. Payer address and balance are completely masked.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPrivacyPreset('standard')}
                        className={`text-left rounded-lg border p-3.5 space-y-1.5 transition-all ${
                          privacyPreset === 'standard'
                            ? 'border-primary bg-primary/10 ring-1 ring-primary'
                            : 'border-border bg-background/50 hover:border-border/80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">
                            Standard Verification
                          </span>
                          {privacyPreset === 'standard' && (
                            <CheckCircle2 className="size-3.5 text-primary" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Discloses proof of satisfaction plus payer confirmation identifier for dispute settlement.
                        </p>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="exp-hours"
                      className="block text-xs font-semibold text-foreground tracking-tight"
                    >
                      Default Intent Expiration
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60 pointer-events-none" />
                      <select
                        id="exp-hours"
                        value={autoExpireHours}
                        onChange={(e) => setAutoExpireHours(e.target.value)}
                        className="w-full rounded-lg border border-border bg-background/80 py-2.5 pl-9 pr-8 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors appearance-none"
                      >
                        <option value="1">1 Hour</option>
                        <option value="12">12 Hours</option>
                        <option value="24">24 Hours (Standard)</option>
                        <option value="72">3 Days (72 Hours)</option>
                        <option value="168">7 Days (168 Hours)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="size-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextFromStep3}
                    className="flex items-center gap-2 rounded-lg bg-primary py-2.5 px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <span>Review & Confirm</span>
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: REVIEW & FINISH */}
            {step === 4 && (
              <div className="space-y-5">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-mono text-primary font-medium">
                    Step 4 &middot; Review
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    Confirm merchant profile
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Review your parameters before entering the VeilPay merchant console.
                  </p>
                </div>

                <div className="rounded-lg border border-border/70 bg-card/40 p-4 space-y-3 divide-y divide-border/40 text-xs">
                  <div className="flex items-center justify-between pb-2">
                    <span className="text-muted-foreground">Business Name</span>
                    <span className="font-medium text-foreground">{businessName}</span>
                  </div>
                  {website && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-muted-foreground">Website</span>
                      <span className="font-mono text-foreground">{website}</span>
                    </div>
                  )}
                  {description && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-muted-foreground">Description</span>
                      <span className="text-foreground">{description}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground">Settlement Address</span>
                    <span className="font-mono text-foreground">
                      {receivingAddress ? (
                        `${receivingAddress.slice(0, 14)}...${receivingAddress.slice(-6)}`
                      ) : (
                        <span className="text-muted-foreground">Configured per-intent</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-muted-foreground">Privacy Preset</span>
                    <span className="capitalize text-accent font-medium">
                      {privacyPreset} ZK Mode
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-muted-foreground">Default Expiry</span>
                    <span className="font-medium text-foreground">
                      {autoExpireHours} Hours
                    </span>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-between">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => setStep(3)}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <ArrowLeft className="size-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={handleCompleteOnboarding}
                    className="flex items-center gap-2 rounded-lg bg-primary py-2.5 px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-lg shadow-primary/20"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Launching Dashboard...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4" />
                        <span>Complete Setup & Launch</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-4 px-6 text-center text-xs text-muted-foreground">
        VeilPay &middot; Midnight Privacy Payment Protocol
      </footer>
    </div>
  )
}
