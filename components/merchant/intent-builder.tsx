'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy } from 'lucide-react'
import {
  AMOUNT_PREDICATES,
  SUPPORTED_ASSETS,
  buildDraftIntent,
  describeAmountCondition,
  validateConditions,
} from '@/lib/payments/intent'
import type {
  AmountPredicateKind,
  AssetSymbol,
  PaymentConditions,
  PaymentIntent,
} from '@/lib/payments/types'
import { createPaymentIntentApi } from '@/lib/payments/service'
import { midnightPublicConfig } from '@/lib/config'
import { cn } from '@/lib/utils'
import { useWallet } from '@/lib/wallet/context'

const inputClass =
  'w-full rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const labelClass = 'text-sm font-medium text-foreground'

function fieldError(issues: { field: string; message: string }[], field: string) {
  return issues.find((i) => i.field === field)?.message
}

export function IntentBuilder() {
  const router = useRouter()
  const { walletId } = useWallet()

  const [conditions, setConditions] = useState<PaymentConditions>({
    amount: { kind: 'exactly', asset: SUPPORTED_ASSETS[0], amount: '', amountMax: '' },
    recipient: '',
    expiresAt: '',
    reference: '',
  })
  const [touched, setTouched] = useState(false)
  const [copied, setCopied] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [createdIntent, setCreatedIntent] = useState<PaymentIntent | null>(null)
  // Set only after mount so the SSR and initial client render match (avoids a
  // hydration mismatch from a render-time timestamp).
  const [createdAt, setCreatedAt] = useState<string | null>(null)

  useEffect(() => {
    setCreatedAt(new Date().toISOString())
  }, [])

  const issues = useMemo(() => validateConditions(conditions), [conditions])
  const isValid = issues.length === 0

  const draft = useMemo(() => {
    // Normalize empties out of the payload so it reflects only what's set.
    const normalized: PaymentConditions = {
      amount: {
        kind: conditions.amount.kind,
        asset: conditions.amount.asset,
        amount: conditions.amount.amount.trim(),
        ...(conditions.amount.kind === 'range' && conditions.amount.amountMax
          ? { amountMax: conditions.amount.amountMax.trim() }
          : {}),
      },
      recipient: conditions.recipient.trim(),
      ...(conditions.expiresAt ? { expiresAt: conditions.expiresAt } : {}),
      ...(conditions.reference?.trim() ? { reference: conditions.reference.trim() } : {}),
    }
    const intent = buildDraftIntent(normalized, {
      id: 'pi_preview',
      network: midnightPublicConfig.network,
    })
    return {
      ...intent,
      createdAt: createdAt ?? '<generated on submission>',
    }
  }, [conditions, createdAt])

  const payloadJson = JSON.stringify(draft, null, 2)

  function update(patch: Partial<PaymentConditions>) {
    setConditions((prev) => ({ ...prev, ...patch }))
  }

  function updateAmount(patch: Partial<PaymentConditions['amount']>) {
    setConditions((prev) => ({ ...prev, amount: { ...prev.amount, ...patch } }))
  }

  async function copyPayload() {
    try {
      await navigator.clipboard.writeText(payloadJson)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const showError = (field: string) =>
    touched ? fieldError(issues, field) : undefined

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!isValid || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const { intent } = await createPaymentIntentApi(conditions, walletId)
      setCreatedIntent(intent)
      router.refresh()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create invoice')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr] lg:gap-8">
      {/* Form */}
      <form
        className="flex flex-col gap-5 rounded-2xl border border-border/70 bg-card/40 p-6"
        onSubmit={handleSubmit}
        noValidate
      >
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-1 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Payment conditions
          </legend>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr]">
            <div className="flex flex-col gap-1.5">
              <label className={labelClass} htmlFor="predicate">
                Amount predicate
              </label>
              <select
                id="predicate"
                className={inputClass}
                value={conditions.amount.kind}
                onChange={(e) =>
                  updateAmount({ kind: e.target.value as AmountPredicateKind })
                }
              >
                {AMOUNT_PREDICATES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelClass} htmlFor="asset">
                Asset
              </label>
              <select
                id="asset"
                className={inputClass}
                value={conditions.amount.asset}
                onChange={(e) => updateAmount({ asset: e.target.value as AssetSymbol })}
              >
                {SUPPORTED_ASSETS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            className={cn(
              'grid grid-cols-1 gap-4',
              conditions.amount.kind === 'range' && 'sm:grid-cols-2',
            )}
          >
            <div className="flex flex-col gap-1.5">
              <label className={labelClass} htmlFor="amount">
                {conditions.amount.kind === 'range' ? 'Minimum amount' : 'Amount'}
              </label>
              <input
                id="amount"
                inputMode="decimal"
                className={inputClass}
                placeholder="0.00"
                value={conditions.amount.amount}
                onChange={(e) => updateAmount({ amount: e.target.value })}
                aria-invalid={Boolean(showError('amount'))}
              />
              {showError('amount') && (
                <p className="text-xs text-destructive">{showError('amount')}</p>
              )}
            </div>

            {conditions.amount.kind === 'range' && (
              <div className="flex flex-col gap-1.5">
                <label className={labelClass} htmlFor="amountMax">
                  Maximum amount
                </label>
                <input
                  id="amountMax"
                  inputMode="decimal"
                  className={inputClass}
                  placeholder="0.00"
                  value={conditions.amount.amountMax ?? ''}
                  onChange={(e) => updateAmount({ amountMax: e.target.value })}
                  aria-invalid={Boolean(showError('amountMax'))}
                />
                {showError('amountMax') && (
                  <p className="text-xs text-destructive">{showError('amountMax')}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="recipient">
              Recipient address
            </label>
            <input
              id="recipient"
              className={cn(inputClass, 'font-mono')}
              placeholder="Midnight recipient address"
              value={conditions.recipient}
              onChange={(e) => update({ recipient: e.target.value })}
              aria-invalid={Boolean(showError('recipient'))}
            />
            {showError('recipient') && (
              <p className="text-xs text-destructive">{showError('recipient')}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className={labelClass} htmlFor="expiresAt">
                Expiry <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                id="expiresAt"
                type="datetime-local"
                className={inputClass}
                value={conditions.expiresAt ?? ''}
                onChange={(e) =>
                  update({ expiresAt: e.target.value ? new Date(e.target.value).toISOString() : '' })
                }
                aria-invalid={Boolean(showError('expiresAt'))}
              />
              {showError('expiresAt') && (
                <p className="text-xs text-destructive">{showError('expiresAt')}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={labelClass} htmlFor="reference">
                Reference <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                id="reference"
                className={inputClass}
                placeholder="order-1042"
                value={conditions.reference ?? ''}
                onChange={(e) => update({ reference: e.target.value })}
              />
            </div>
          </div>
        </fieldset>

        <div className="rounded-lg border border-border/60 bg-background/40 p-3 text-sm">
          <span className="text-muted-foreground">Summary: </span>
          <span className="text-foreground">{describeAmountCondition(conditions)}</span>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="submit"
            disabled={submitting || !isValid}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Issuing on-chain…' : 'Create invoice'}
          </button>
          {submitError && (
            <p className="text-xs text-destructive" role="alert">
              {submitError}
            </p>
          )}
          {createdIntent && (
            <div className="rounded-lg border border-border/60 bg-background/40 p-3 text-sm">
              <p className="font-medium text-foreground">
                Invoice issued on-chain — #{createdIntent.chainIntentId}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Share the payment link with your customer:
              </p>
              <code className="mt-1 block overflow-x-auto rounded-md border border-border/60 bg-background/60 p-2 font-mono text-xs text-foreground">
                {`/pay/${createdIntent.chainIntentId}?secret=${createdIntent.paymentSecret}`}
              </code>
            </div>
          )}
        </div>
      </form>

      {/* Typed payload preview */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/40 p-6">
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Typed PaymentIntent payload
          </p>
          <button
            type="button"
            onClick={copyPayload}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copied ? <Check className="size-3.5 text-accent" /> : <Copy className="size-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-lg border border-border/60 bg-background/60 p-4 font-mono text-xs leading-relaxed text-foreground">
          <code>{payloadJson}</code>
        </pre>
        <p className="text-xs text-muted-foreground">
          This is the exact typed structure passed to the Midnight client&apos;s{' '}
          <code className="font-mono text-foreground">createIntent()</code>. The{' '}
          <code className="font-mono text-foreground">id</code> shown is a preview placeholder;
          a real id is generated on submission.
        </p>
      </div>
    </div>
  )
}
