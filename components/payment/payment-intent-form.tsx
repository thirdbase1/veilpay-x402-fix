'use client'

import { useState, useMemo, useId, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWallet } from '@/lib/wallet/context'
import {
  SUPPORTED_ASSETS,
  AMOUNT_PREDICATES,
  validateConditions,
} from '@/lib/payments/intent'
import { createPaymentIntentApi } from '@/lib/payments/service'
import type {
  PaymentConditions,
  AssetSymbol,
  AmountPredicateKind,
} from '@/lib/payments/types'
import {
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Calendar,
  Wallet,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react'

export function PaymentIntentForm() {
  const router = useRouter()
  const { account, walletId } = useWallet()

  const amountId = useId()
  const amountMaxId = useId()
  const assetId = useId()
  const kindId = useId()
  const recipientId = useId()
  const expiryId = useId()
  const referenceId = useId()

  const [kind, setKind] = useState<AmountPredicateKind>('exactly')
  const [asset, setAsset] = useState<AssetSymbol>('tDUST')
  const [amount, setAmount] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [recipient, setRecipient] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [reference, setReference] = useState('')

  const [touched, setTouched] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Autofill recipient if wallet connects and recipient is currently empty
  useEffect(() => {
    if (account?.address && !recipient) {
      setRecipient(account.address)
    }
  }, [account, recipient])

  const conditions: PaymentConditions = useMemo(
    () => ({
      amount: {
        kind,
        asset,
        amount: amount.trim(),
        ...(kind === 'range' && amountMax.trim() ? { amountMax: amountMax.trim() } : {}),
      },
      recipient: recipient.trim(),
      ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
      ...(reference.trim() ? { reference: reference.trim() } : {}),
    }),
    [kind, asset, amount, amountMax, recipient, expiresAt, reference],
  )

  const validationIssues = useMemo(() => validateConditions(conditions), [conditions])
  const isValid = validationIssues.length === 0

  const getFieldError = (fieldName: string) => {
    if (!touched) return null
    return validationIssues.find((i) => i.field === fieldName)?.message
  }

  // Quick preset helper for expiration
  const setExpiryPreset = (hours: number) => {
    const d = new Date(Date.now() + hours * 3600 * 1000)
    // format to YYYY-MM-DDThh:mm for datetime-local input
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)
    setExpiresAt(local)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    setSubmitError(null)

    if (!isValid) return
    if (!walletId) {
      setSubmitError(
        'Connect your Midnight wallet extension first — invoices are signed from your own wallet.',
      )
      return
    }

    setIsSubmitting(true)

    try {
      const res = await createPaymentIntentApi(conditions, walletId)
      // Navigate to the newly created invoice route
      router.push(`/app/intents/${encodeURIComponent(res.intent.id)}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register invoice'
      setSubmitError(msg)
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
      {submitError && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/20 p-4 text-xs text-destructive"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-4 shrink-0 text-destructive mt-0.5" />
            <div>
              <p className="font-semibold">Creation Error</p>
              <p className="mt-1 text-destructive/90">{submitError}</p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1: Payment Condition / Requirement */}
      <div className="rounded-2xl border border-border/70 bg-card/40 p-6 backdrop-blur-sm space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            1. Payment Condition
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Specify the cryptographic condition a customer&apos;s payment must satisfy.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* Predicate */}
          <div>
            <label htmlFor={kindId} className="block text-xs font-medium text-foreground mb-1.5">
              Requirement Type
            </label>
            <select
              id={kindId}
              value={kind}
              onChange={(e) => setKind(e.target.value as AmountPredicateKind)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {AMOUNT_PREDICATES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label htmlFor={amountId} className="block text-xs font-medium text-foreground mb-1.5">
              {kind === 'range' ? 'Minimum Amount' : 'Required Amount'}
            </label>
            <input
              id={amountId}
              type="text"
              inputMode="decimal"
              placeholder="e.g. 50.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                getFieldError('amount') ? 'border-destructive/80 ring-1 ring-destructive/50' : 'border-border'
              }`}
            />
            {getFieldError('amount') && (
              <p className="mt-1 text-[11px] text-destructive">{getFieldError('amount')}</p>
            )}
          </div>

          {/* Asset */}
          <div>
            <label htmlFor={assetId} className="block text-xs font-medium text-foreground mb-1.5">
              Asset Token
            </label>
            <select
              id={assetId}
              value={asset}
              onChange={(e) => setAsset(e.target.value as AssetSymbol)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {SUPPORTED_ASSETS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Upper bound if Range */}
        {kind === 'range' && (
          <div className="max-w-xs pt-1">
            <label htmlFor={amountMaxId} className="block text-xs font-medium text-foreground mb-1.5">
              Maximum Amount ({asset})
            </label>
            <input
              id={amountMaxId}
              type="text"
              inputMode="decimal"
              placeholder="e.g. 100.00"
              value={amountMax}
              onChange={(e) => setAmountMax(e.target.value)}
              className={`w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                getFieldError('amountMax') ? 'border-destructive/80 ring-1 ring-destructive/50' : 'border-border'
              }`}
            />
            {getFieldError('amountMax') && (
              <p className="mt-1 text-[11px] text-destructive">{getFieldError('amountMax')}</p>
            )}
          </div>
        )}
      </div>

      {/* SECTION 2: Recipient Address */}
      <div className="rounded-2xl border border-border/70 bg-card/40 p-6 backdrop-blur-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              2. Merchant Recipient Address
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              The Midnight account that must receive the payment condition settlement.
            </p>
          </div>

          {account?.address && (
            <button
              type="button"
              onClick={() => setRecipient(account.address)}
              className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline self-start sm:self-auto"
            >
              <Wallet className="size-3.5" />
              Use connected wallet ({account.address.slice(0, 5)}...{account.address.slice(-3)})
            </button>
          )}
        </div>

        <div>
          <label htmlFor={recipientId} className="sr-only">
            Recipient Address
          </label>
          <input
            id={recipientId}
            type="text"
            placeholder="mn_address_or_recipient_account..."
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className={`w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              getFieldError('recipient') ? 'border-destructive/80 ring-1 ring-destructive/50' : 'border-border'
            }`}
          />
          {getFieldError('recipient') ? (
            <p className="mt-1 text-[11px] text-destructive">{getFieldError('recipient')}</p>
          ) : (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Must be your valid Midnight account identity. Payer will satisfy payment to this address.
            </p>
          )}
        </div>
      </div>

      {/* SECTION 3: Expiration & Metadata */}
      <div className="rounded-2xl border border-border/70 bg-card/40 p-6 backdrop-blur-sm space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            3. Expiration & Metadata
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure intent lifetime and merchant reconciliation reference.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {/* Expiration */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor={expiryId} className="text-xs font-medium text-foreground">
                Expiration (Optional)
              </label>
              <div className="flex items-center gap-1.5 font-mono text-[10px]">
                <button
                  type="button"
                  onClick={() => setExpiryPreset(1)}
                  className="rounded border border-border px-1.5 py-0.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                >
                  +1h
                </button>
                <button
                  type="button"
                  onClick={() => setExpiryPreset(24)}
                  className="rounded border border-border px-1.5 py-0.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                >
                  +24h
                </button>
                <button
                  type="button"
                  onClick={() => setExpiryPreset(168)}
                  className="rounded border border-border px-1.5 py-0.5 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                >
                  +7d
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                id={expiryId}
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className={`w-full rounded-lg border bg-background px-3 py-2 text-xs font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  getFieldError('expiresAt') ? 'border-destructive/80 ring-1 ring-destructive/50' : 'border-border'
                }`}
              />
              <Calendar className="absolute right-3 top-2.5 size-4 text-muted-foreground pointer-events-none" />
            </div>
            {getFieldError('expiresAt') ? (
              <p className="mt-1 text-[11px] text-destructive">{getFieldError('expiresAt')}</p>
            ) : (
              <p className="mt-1 text-[11px] text-muted-foreground">
                After expiration, the intent will reject late proofs and transition to expired.
              </p>
            )}
          </div>

          {/* Reference / Memo */}
          <div>
            <label htmlFor={referenceId} className="block text-xs font-medium text-foreground mb-1.5">
              Merchant Reference (Optional)
            </label>
            <input
              id={referenceId}
              type="text"
              placeholder="e.g. Order #4102 or Invoice 2026-08"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Internal correlation handle. Stored as metadata, not payer identity.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 4: Privacy Architecture Notice */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <ShieldCheck className="size-5 text-primary shrink-0 mt-0.5" />
        <div className="text-xs leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">VeilPay Privacy Guarantee</p>
          <p className="mt-0.5">
            VeilPay is designed to show merchants only the payment information required to verify this intent.
            The customer&apos;s wallet balance, address history, and broader activity remain undisclosed.
          </p>
        </div>
      </div>

      {/* Form Submission Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <HelpCircle className="size-3.5" />
          <span>Intent will be registered with status <strong className="text-primary font-mono">awaiting_payment</strong></span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => router.push('/app')}
            className="w-full sm:w-auto rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Registering Intent...
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3.5" />
                Create Invoice
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  )
}
