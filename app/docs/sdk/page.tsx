'use client'

import { useState, useEffect, useTransition, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Terminal,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Layers,
  ArrowRight,
  Code2,
  Wallet,
  Globe,
  RefreshCw,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react'
import { AppHeader } from '@/components/site/app-header'
import { CodeBlock } from '@/components/docs/code-block'
import { useWallet } from '@/lib/wallet/context'
import { midnightPublicConfig } from '@/lib/config'
import {
  listPaymentIntents,
  fetchPaymentIntent,
  createPaymentIntentApi,
  cancelPaymentIntentApi,
  getPaymentStatusApi,
} from '@/lib/payments/service'
import { submitCheckoutPayment } from '@/lib/payments/payment-checkout'
import type { PaymentConditions, PaymentIntentStatus } from '@/lib/payments/types'

type MethodKey =
  | 'createPaymentIntent'
  | 'fetchPaymentIntent'
  | 'listPaymentIntents'
  | 'cancelPaymentIntent'
  | 'submitCheckoutPayment'
  | 'getPaymentStatus'

interface MethodDef {
  id: MethodKey
  name: string
  category: 'Write' | 'Read' | 'Checkout'
  http: 'POST' | 'GET'
  description: string
  requiresWallet: boolean
  createsTransaction: boolean
}

const METHODS: MethodDef[] = [
  {
    id: 'createPaymentIntent',
    name: 'createPaymentIntentApi',
    category: 'Write',
    http: 'POST',
    description: 'Registers a new programmable payment intent with validated conditions.',
    requiresWallet: false,
    createsTransaction: true,
  },
  {
    id: 'fetchPaymentIntent',
    name: 'fetchPaymentIntent',
    category: 'Read',
    http: 'GET',
    description: 'Queries the complete authoritative state of an existing payment intent.',
    requiresWallet: false,
    createsTransaction: false,
  },
  {
    id: 'listPaymentIntents',
    name: 'listPaymentIntents',
    category: 'Read',
    http: 'GET',
    description: 'Lists and filters payment intents from the active protocol store.',
    requiresWallet: false,
    createsTransaction: false,
  },
  {
    id: 'cancelPaymentIntent',
    name: 'cancelPaymentIntentApi',
    category: 'Write',
    http: 'POST',
    description: 'Irreversibly cancels an active, unfulfilled payment intent.',
    requiresWallet: false,
    createsTransaction: true,
  },
  {
    id: 'submitCheckoutPayment',
    name: 'submitCheckoutPayment',
    category: 'Checkout',
    http: 'POST',
    description: 'Executes customer payment against Midnight contract with connected wallet.',
    requiresWallet: true,
    createsTransaction: true,
  },
  {
    id: 'getPaymentStatus',
    name: 'getPaymentStatusApi',
    category: 'Read',
    http: 'GET',
    description: 'Convenience lookup returning the exact status string of an intent.',
    requiresWallet: false,
    createsTransaction: false,
  },
]

function SdkExplorerContent() {
  const searchParams = useSearchParams()
  const initialMethod = (searchParams.get('method') as MethodKey) || 'createPaymentIntent'

  const [activeMethod, setActiveMethod] = useState<MethodKey>(
    METHODS.some((m) => m.id === initialMethod) ? initialMethod : 'createPaymentIntent',
  )

  // Wallet context
  const { status: walletStatus, account, connect, disconnect, error: walletError } = useWallet()

  // Preprod Network Config
  const [selectedNetwork, setSelectedNetwork] = useState(
    midnightPublicConfig.network || 'midnight-preprod',
  )

  // Interactive Form Inputs
  const [amount, setAmount] = useState('50.00')
  const [amountKind, setAmountKind] = useState<'exactly' | 'at_least' | 'range'>('exactly')
  const [amountMax, setAmountMax] = useState('100.00')
  const [asset, setAsset] = useState<'tDUST' | 'DUST' | 'USDC'>('tDUST')
  const [recipient, setRecipient] = useState(
    'mn_preview_merchant_destination_address_8892f39',
  )
  const [reference, setReference] = useState('EXPLORER-TEST-001')
  const [expiryHours, setExpiryHours] = useState('24')

  // Intent ID input for methods that take an ID
  const [targetIntentId, setTargetIntentId] = useState('')
const [paymentSecret, setPaymentSecret] = useState('')

  // List params
  const [listStatus, setListStatus] = useState<'all' | PaymentIntentStatus>('all')
  const [listLimit, setListLimit] = useState('5')

  // Execution states
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<unknown>(null)
  const [error, setError] = useState<string | null>(null)
  const [responseStatus, setResponseStatus] = useState<number | null>(null)
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null)
  const [copiedResult, setCopiedResult] = useState(false)

  // Live timestamps in the code preview must only exist client-side after
  // mount, otherwise server and client render different text (hydration error).
  const [previewExpiry, setPreviewExpiry] = useState<string | null>(null)
  useEffect(() => {
    setPreviewExpiry(
      new Date(Date.now() + Number(expiryHours || 24) * 3600 * 1000).toISOString(),
    )
  }, [expiryHours])

  // Update target intent ID if URL parameter exists
  useEffect(() => {
    const idParam = searchParams.get('id')
    if (idParam) {
      setTargetIntentId(idParam)
    }
    const methodParam = searchParams.get('method') as MethodKey
    if (methodParam && METHODS.some((m) => m.id === methodParam)) {
      setActiveMethod(methodParam)
    }
  }, [searchParams])

  const selectedDef = METHODS.find((m) => m.id === activeMethod) || METHODS[0]

  // Execute the selected method against the real VeilPay service layer
  const handleExecute = () => {
    setError(null)
    setResult(null)
    setResponseStatus(null)
    setExecutionTimeMs(null)

    const startTime = performance.now()

    startTransition(async () => {
      try {
        let resData: unknown = null

        if (activeMethod === 'createPaymentIntent') {
          const conditions: PaymentConditions = {
            amount: {
              kind: amountKind,
              asset,
              amount: amount.trim(),
              ...(amountKind === 'range' ? { amountMax: amountMax.trim() } : {}),
            },
            recipient: recipient.trim(),
            reference: reference.trim() || undefined,
            ...(Number(expiryHours) > 0
              ? {
                  expiresAt: new Date(
                    Date.now() + Number(expiryHours) * 3600 * 1000,
                  ).toISOString(),
                }
              : {}),
          }

          const response = await createPaymentIntentApi(conditions)
          resData = response
          setResponseStatus(200)

          // Automatically auto-fill targetIntentId for chaining!
          if (response?.intent?.id) {
            setTargetIntentId(response.intent.id)
          }
        } else if (activeMethod === 'fetchPaymentIntent') {
          if (!targetIntentId.trim()) {
            throw new Error('Please enter a valid Payment Intent ID (e.g. pi_...)')
          }
          const response = await fetchPaymentIntent(targetIntentId.trim())
          resData = response
          setResponseStatus(200)
        } else if (activeMethod === 'listPaymentIntents') {
          const response = await listPaymentIntents({
            status: listStatus === 'all' ? undefined : listStatus,
            pageSize: Number(listLimit) || 5,
          })
          resData = response
          setResponseStatus(200)
          if (response.intents.length > 0 && !targetIntentId) {
            setTargetIntentId(response.intents[0].id)
          }
        } else if (activeMethod === 'cancelPaymentIntent') {
          if (!targetIntentId.trim()) {
            throw new Error('Please enter a valid Payment Intent ID to cancel.')
          }
          const response = await cancelPaymentIntentApi(targetIntentId.trim())
          resData = response
          setResponseStatus(200)
        } else if (activeMethod === 'submitCheckoutPayment') {
          if (!targetIntentId.trim()) {
            throw new Error('Please enter a valid Payment Intent ID to pay.')
          }

          const response = await submitCheckoutPayment(targetIntentId.trim(), {
            paymentSecret: paymentSecret.trim(),
            network: selectedNetwork,
          })

          resData = response
          setResponseStatus(response.success ? 200 : 503)
        } else if (activeMethod === 'getPaymentStatus') {
          if (!targetIntentId.trim()) {
            throw new Error('Please enter a valid Payment Intent ID to check status.')
          }
          const status = await getPaymentStatusApi(targetIntentId.trim())
          resData = { intentId: targetIntentId.trim(), status }
          setResponseStatus(200)
        }

        const duration = Math.round(performance.now() - startTime)
        setExecutionTimeMs(duration)
        setResult(resData)
      } catch (err: unknown) {
        const duration = Math.round(performance.now() - startTime)
        setExecutionTimeMs(duration)
        const message = err instanceof Error ? err.message : 'Unknown execution failure'
        setError(message)
        setResponseStatus(400)
      }
    })
  }

  // Generate dynamic live TypeScript snippet based on user inputs
  const getDynamicCodeSnippet = () => {
    switch (activeMethod) {
      case 'createPaymentIntent':
        return `import { createPaymentIntentApi } from '@/lib/payments/service'

const conditions = {
  amount: {
    kind: '${amountKind}',
    asset: '${asset}',
    amount: '${amount}',${amountKind === 'range' ? `\n    amountMax: '${amountMax}',` : ''}
  },
  recipient: '${recipient}',
  reference: '${reference}',
  expiresAt: '${previewExpiry ?? '<expiry timestamp>'}',
}

const { intent, midnightStatus } = await createPaymentIntentApi(conditions)
console.log('Intent ID:', intent.id)
console.log('Status:', intent.status) // '${'awaiting_payment'}'`

      case 'fetchPaymentIntent':
        return `import { fetchPaymentIntent } from '@/lib/payments/service'

const intentId = '${targetIntentId || 'pi_example_id'}'
const intent = await fetchPaymentIntent(intentId)

console.log('Loaded Intent:', intent)
console.log('Status:', intent.status)`

      case 'listPaymentIntents':
        return `import { listPaymentIntents } from '@/lib/payments/service'

const result = await listPaymentIntents({
  status: '${listStatus}',
  pageSize: ${listLimit || 5},
})

console.log('Total Count:', result.total)
console.log('Intents:', result.intents)`

      case 'cancelPaymentIntent':
        return `import { cancelPaymentIntentApi } from '@/lib/payments/service'

const intentId = '${targetIntentId || 'pi_example_id'}'
const cancelled = await cancelPaymentIntentApi(intentId)

console.log('Status:', cancelled.status) // 'cancelled'`

      case 'submitCheckoutPayment':
        return `import { submitCheckoutPayment } from '@/lib/payments/payment-checkout'

const result = await submitCheckoutPayment('${targetIntentId || 'pi_example_id'}', {
  paymentSecret: '${paymentSecret || '64-hex-payment-secret-from-checkout-link'}',
  network: '${selectedNetwork}',
})

if (result.success) {
  console.log('Verified on Midnight network!')
} else {
  console.info(result.code, result.message)
}`

      case 'getPaymentStatus':
        return `import { getPaymentStatusApi } from '@/lib/payments/service'

const status = await getPaymentStatusApi('${targetIntentId || 'pi_example_id'}')
console.log('Current status:', status)`
    }
  }

  const copyResultJson = async () => {
    if (!result && !error) return
    const textToCopy = result ? JSON.stringify(result, null, 2) : String(error)
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopiedResult(true)
      setTimeout(() => setCopiedResult(false), 1600)
    } catch {
      setCopiedResult(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <AppHeader current="sdk" />

      {/* Explorer Top Bar */}
      <div className="border-b border-border/70 bg-card/30">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary">
              <Terminal className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
                  VeilPay SDK Explorer
                </span>
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary">
                  Interactive v1.0
                </span>
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Execute live typed SDK calls against the VeilPay protocol and Midnight Preprod.
              </p>
            </div>
          </div>

          {/* Network & Wallet Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Preprod Selector */}
            <div className="flex items-center rounded-lg border border-border/70 bg-background/80 px-2.5 py-1 text-xs font-mono">
              <Globe className="mr-1.5 size-3 text-muted-foreground" />
              <span className="text-muted-foreground mr-1">Target:</span>
              <select
                value={selectedNetwork}
                onChange={(e) => setSelectedNetwork(e.target.value)}
                className="bg-transparent text-primary font-medium focus:outline-none cursor-pointer"
              >
                <option value="midnight-preprod" className="bg-card text-foreground">
                  Midnight Preprod
                </option>
                <option value="midnight-testnet" className="bg-card text-foreground">
                  Midnight Testnet
                </option>
                <option value="local-sandbox" className="bg-card text-foreground">
                  Local Dev Node
                </option>
              </select>
            </div>

            {/* Wallet Connect Status */}
            {walletStatus === 'connected' && account ? (
              <div className="flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-mono text-accent">
                <span className="size-2 rounded-full bg-accent animate-pulse" />
                <span className="max-w-[110px] truncate" title={account.address}>
                  {account.address}
                </span>
                <button
                  type="button"
                  onClick={disconnect}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline ml-1"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={connect}
                disabled={walletStatus === 'connecting'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-secondary/80 px-3 py-1 text-xs font-medium text-foreground hover:bg-secondary transition disabled:opacity-50"
              >
                <Wallet className="size-3.5 text-primary" />
                <span>
                  {walletStatus === 'connecting' ? 'Connecting...' : 'Connect Midnight Wallet'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Explorer Workspace */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          {/* Left Navigation: Methods List */}
          <aside className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-card/40 p-3">
              <div className="px-2 py-1 text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                SDK Methods
              </div>
              <div className="mt-2 space-y-1">
                {METHODS.map((method) => {
                  const isActive = activeMethod === method.id
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => {
                        setActiveMethod(method.id)
                        setError(null)
                        setResult(null)
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-mono transition ${
                        isActive
                          ? 'bg-primary/15 text-primary border border-primary/30 font-semibold'
                          : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                            method.http === 'GET'
                              ? 'bg-primary/20 text-primary'
                              : 'bg-accent/20 text-accent'
                          }`}
                        >
                          {method.http}
                        </span>
                        <span className="truncate">{method.name}</span>
                      </div>
                      {method.requiresWallet && (
                        <Wallet className="size-3 text-amber-400 shrink-0" aria-label="Requires Wallet" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Quick Tips Box */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Info className="size-3.5 text-primary" />
                <span>Live SDK Binding</span>
              </div>
              <p className="leading-relaxed">
                All calls in this explorer execute through the real application service and API routes. No mocked transactions or fabricated block numbers.
              </p>
              <div className="pt-2">
                <Link
                  href="/docs#sdk-reference"
                  className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                >
                  <span>View full docs reference</span>
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          </aside>

          {/* Center / Right: Interactive Method Panel */}
          <main className="space-y-6">
            {/* Method Header */}
            <div className="rounded-xl border border-border/80 bg-card/50 p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-bold font-mono ${
                      selectedDef.http === 'GET'
                        ? 'bg-primary/20 text-primary'
                        : 'bg-accent/20 text-accent'
                    }`}
                  >
                    {selectedDef.http}
                  </span>
                  <h2 className="font-mono text-base sm:text-lg font-bold text-foreground">
                    {selectedDef.name}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                    Category: {selectedDef.category}
                  </span>
                  {selectedDef.requiresWallet && (
                    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-mono text-amber-400">
                      Wallet Required
                    </span>
                  )}
                  {selectedDef.createsTransaction && (
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-mono text-primary">
                      State Mutating
                    </span>
                  )}
                </div>
              </div>

              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {selectedDef.description}
              </p>
            </div>

            {/* Input Parameters Panel */}
            <div className="rounded-xl border border-border/80 bg-card/40 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Method Arguments &amp; Parameters
                </h3>
                <span className="text-[11px] text-muted-foreground">Adjust inputs to test edge cases</span>
              </div>

              {/* Method: createPaymentIntent inputs */}
              {activeMethod === 'createPaymentIntent' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Amount Predicate</label>
                    <select
                      value={amountKind}
                      onChange={(e) =>
                        setAmountKind(e.target.value as 'exactly' | 'at_least' | 'range')
                      }
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                    >
                      <option value="exactly">Exact Amount (kind: &apos;exactly&apos;)</option>
                      <option value="at_least">Minimum Threshold (kind: &apos;at_least&apos;)</option>
                      <option value="range">Price Range (kind: &apos;range&apos;)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Asset Token</label>
                    <select
                      value={asset}
                      onChange={(e) => setAsset(e.target.value as 'tDUST' | 'DUST' | 'USDC')}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                    >
                      <option value="tDUST">tDUST (Midnight Preprod Native)</option>
                      <option value="DUST">DUST (Mainnet Native)</option>
                      <option value="USDC">USDC (Bridged Unshielded)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      {amountKind === 'range' ? 'Minimum Amount' : 'Payment Amount'}
                    </label>
                    <input
                      type="text"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="e.g. 50.00"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>

                  {amountKind === 'range' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Maximum Amount</label>
                      <input
                        type="text"
                        value={amountMax}
                        onChange={(e) => setAmountMax(e.target.value)}
                        placeholder="e.g. 100.00"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium text-foreground">Recipient Address</label>
                    <input
                      type="text"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="Merchant receiving Midnight address"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Reference / Order ID</label>
                    <input
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="e.g. ORDER-9941"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Expiry (Hours)</label>
                    <input
                      type="number"
                      value={expiryHours}
                      onChange={(e) => setExpiryHours(e.target.value)}
                      min="1"
                      max="720"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Methods with targetIntentId */}
              {(activeMethod === 'fetchPaymentIntent' ||
                activeMethod === 'cancelPaymentIntent' ||
                activeMethod === 'submitCheckoutPayment' ||
                activeMethod === 'getPaymentStatus') && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-foreground">
                        Payment Intent ID (<code className="text-primary font-mono">id</code>)
                      </label>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const list = await listPaymentIntents({ pageSize: 1 })
                            if (list.intents.length > 0) {
                              setTargetIntentId(list.intents[0].id)
                            }
                          } catch {
                            // ignore
                          }
                        }}
                        className="text-[11px] text-primary hover:underline"
                      >
                        Load latest intent ID
                      </button>
                    </div>
                    <input
                      type="text"
                      value={targetIntentId}
                      onChange={(e) => setTargetIntentId(e.target.value)}
                      placeholder="e.g. pi_xxxxxxxxxxxx or click create intent first"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>

                  {activeMethod === 'submitCheckoutPayment' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">
                        Payment Secret (from checkout link)
                      </label>
                      <input
                        type="text"
                        value={paymentSecret}
                        onChange={(e) => setPaymentSecret(e.target.value)}
                        placeholder="64-character hex payment secret"
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
                      />
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        The one-time secret embedded in the customer checkout link fragment. It is
                        proven to the contract — never revealed.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Method: listPaymentIntents inputs */}
              {activeMethod === 'listPaymentIntents' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Status Filter</label>
                    <select
                      value={listStatus}
                      onChange={(e) => setListStatus(e.target.value as 'all' | PaymentIntentStatus)}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                    >
                      <option value="all">All Statuses</option>
                      <option value="awaiting_payment">Awaiting Payment</option>
                      <option value="verifying">Verifying</option>
                      <option value="verified">Verified</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="expired">Expired</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Page Size (Limit)</label>
                    <input
                      type="number"
                      value={listLimit}
                      onChange={(e) => setListLimit(e.target.value)}
                      min="1"
                      max="50"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Execute Trigger Button */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleExecute}
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs sm:text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm disabled:opacity-60"
                >
                  {isPending ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      <span>Executing Method...</span>
                    </>
                  ) : (
                    <>
                      <Play className="size-3.5 fill-current" />
                      <span>Execute {selectedDef.name}</span>
                    </>
                  )}
                </button>

                {executionTimeMs !== null && (
                  <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                    <Clock className="size-3.5 text-primary" />
                    <span>Duration: {executionTimeMs}ms</span>
                    {responseStatus && (
                      <span
                        className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          responseStatus < 300
                            ? 'bg-accent/20 text-accent'
                            : 'bg-destructive/20 text-destructive'
                        }`}
                      >
                        HTTP {responseStatus}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Generated Code Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                  Equivalent TypeScript Code
                </span>
                <span className="text-[11px] text-muted-foreground">Generated from active parameters</span>
              </div>
              <CodeBlock filename="sdk-snippet.ts" code={getDynamicCodeSnippet()} />
            </div>

            {/* Live Response & Result Panel */}
            <div className="rounded-xl border border-border/80 bg-card/60 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-foreground">
                    Execution Response / Output
                  </span>
                  {Boolean(result) && (
                    <span className="flex items-center gap-1 rounded bg-accent/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent">
                      <CheckCircle2 className="size-3" />
                      <span>SUCCESS</span>
                    </span>
                  )}
                  {error && (
                    <span className="flex items-center gap-1 rounded bg-destructive/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-destructive">
                      <AlertTriangle className="size-3" />
                      <span>ERROR</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copyResultJson}
                    disabled={!result && !error}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-40"
                  >
                    {copiedResult ? (
                      <Check className="size-3.5 text-accent" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    <span>{copiedResult ? 'Copied' : 'Copy Output'}</span>
                  </button>
                </div>
              </div>

              <div className="p-4 font-mono text-xs">
                {isPending && (
                  <div className="flex items-center gap-2 py-6 text-muted-foreground">
                    <RefreshCw className="size-4 animate-spin text-primary" />
                    <span>Communicating with VeilPay service and Midnight boundary...</span>
                  </div>
                )}

                {!isPending && !result && !error && (
                  <div className="py-8 text-center text-muted-foreground space-y-1">
                    <p>No execution has been dispatched yet.</p>
                    <p className="text-[11px] text-muted-foreground/70">
                      Click <strong className="text-foreground">&quot;Execute {selectedDef.name}&quot;</strong> above to invoke this method.
                    </p>
                  </div>
                )}

                {error && (
                  <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
                    <div className="font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="size-4" />
                      <span>Invocation Error:</span>
                    </div>
                    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed">
                      {error}
                    </pre>
                  </div>
                )}

                {Boolean(result) && (
                  <pre className="overflow-x-auto text-foreground leading-relaxed select-text max-h-[420px]">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

export default function SdkExplorer() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center font-mono text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <RefreshCw className="size-4 animate-spin text-primary" />
            <span>Loading VeilPay SDK Explorer...</span>
          </div>
        </div>
      }
    >
      <SdkExplorerContent />
    </Suspense>
  )
}
