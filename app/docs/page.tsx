import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Terminal,
  Shield,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Code2,
  Workflow,
  Lock,
  Unlock,
  KeyRound,
  FileCode,
  FileJson,
  Cpu,
} from 'lucide-react'
import { AppHeader } from '@/components/site/app-header'
import { CodeBlock } from '@/components/docs/code-block'
import { Pipeline } from '@/components/site/pipeline'
import { midnightPublicConfig } from '@/lib/config'

export const metadata: Metadata = {
  title: 'VeilPay Developer Documentation | Protocol & SDK Reference',
  description:
    'Comprehensive technical documentation for VeilPay: private programmable payment intents on Midnight blockchain, typed TypeScript SDK, and Zero-Knowledge verification boundary.',
}

const installCode = `npm install @veilpay/sdk
# or
pnpm add @veilpay/sdk
# or
yarn add @veilpay/sdk`

const initCode = `import { VeilPayClient } from '@veilpay/sdk'
// In the current repository codebase, import from internal service boundary:
// import { listPaymentIntents, fetchPaymentIntent, createPaymentIntentApi, cancelPaymentIntentApi } from '@/lib/payments/service'
// import { getCheckoutIntent, submitCheckoutPayment } from '@/lib/payments/payment-checkout'
// import { getMidnightClient } from '@/lib/midnight/client'

// Initializing configuration
export const veilpay = new VeilPayClient({
  network: process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK || 'midnight-preprod',
  contractAddress: process.env.NEXT_PUBLIC_MIDNIGHT_CONTRACT_ADDRESS,
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
})`

const createIntentCode = `import { createPaymentIntentApi } from '@/lib/payments/service'
import type { PaymentConditions } from '@/lib/payments/types'

const conditions: PaymentConditions = {
  amount: {
    kind: 'exactly', // 'exactly' | 'at_least' | 'range'
    asset: 'tDUST',  // 'tDUST' | 'DUST' | 'USDC'
    amount: '125.00',
  },
  recipient: 'mn_merchant_alpha_9942a',
  expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  reference: 'INV-2026-4019',
}

const { intent, midnightStatus } = await createPaymentIntentApi(conditions)

console.log('Intent ID:', intent.id) // e.g. pi_4a91...
console.log('Status:', intent.status) // 'awaiting_payment'
console.log('Midnight Protocol Status:', midnightStatus) // 'published' | 'integration_pending'`

const readStateCode = `import { fetchPaymentIntent, getPaymentStatusApi } from '@/lib/payments/service'

// Fetch complete structured intent
const intent = await fetchPaymentIntent('pi_4a91...')
console.log(intent.status) // 'awaiting_payment' | 'verifying' | 'verified' | 'cancelled' | 'expired'
console.log(intent.conditions.amount) // { kind: 'exactly', asset: 'tDUST', amount: '125.00' }

// Or fetch status only
const status = await getPaymentStatusApi('pi_4a91...')`

const cancelIntentCode = `import { cancelPaymentIntentApi } from '@/lib/payments/service'

try {
  // Irreversible cancellation: only valid before payment verification
  const cancelledIntent = await cancelPaymentIntentApi('pi_4a91...')
  console.log('Successfully cancelled:', cancelledIntent.status) // 'cancelled'
} catch (err) {
  // Throws 403 (unauthorized/different merchant) or 400 (already verified or expired)
  console.error('Cancellation failed:', err.message)
}`

const payIntentCode = `import { submitCheckoutPayment } from '@/lib/payments/payment-checkout'

// Invoked from payer application / checkout UI with connected wallet
const response = await submitCheckoutPayment('pi_4a91...', {
  payerAddress: 'mn_payer_wallet_address_0x82...',
  network: 'midnight-preprod',
})

if (response.success && response.status === 'verified') {
  console.log('Payment verified with Zero-Knowledge proof!')
} else if (response.code === 'MIDNIGHT_INTEGRATION_PENDING') {
  // Honest protocol state: displays missing deployed contract and prover server capabilities
  console.info('Midnight contract or proof server endpoint is awaiting deployment')
}`

const typesDefinitionCode = `export type AssetSymbol = 'DUST' | 'tDUST' | 'USDC'
export type AmountPredicateKind = 'exactly' | 'at_least' | 'range'

export interface AmountCondition {
  kind: AmountPredicateKind
  asset: AssetSymbol
  amount: string     // String representation avoids floating-point rounding errors
  amountMax?: string // Required when kind === 'range'
}

export interface PaymentConditions {
  amount: AmountCondition
  recipient: string  // Merchant-controlled receive address
  expiresAt?: string // ISO-8601 timestamp string
  reference?: string // Public correlation handle (Order ID, Invoice no.)
}

export type PaymentIntentStatus =
  | 'draft'
  | 'awaiting_payment'
  | 'verifying'
  | 'verified'
  | 'expired'
  | 'failed'
  | 'cancelled'

export interface PaymentIntent {
  id: string
  conditions: PaymentConditions
  status: PaymentIntentStatus
  createdAt: string
  updatedAt?: string
  network?: string
  onChainReference?: string
}

export interface VerificationResult {
  intentId: string
  satisfied: boolean
  status: 'verified' | 'failed' | 'expired'
  proofReference?: string
  verifiedAt?: string
}`

const midnightClientSeamCode = `export interface MidnightClient {
  readonly ready: boolean

  // Register intent on Midnight Compact smart contract
  createIntent(intent: PaymentIntent): Promise<PaymentIntent>

  // Query state from Midnight indexer / ledger
  getIntent(intentId: string): Promise<PaymentIntent>

  // Verify ZK proof against contract without revealing payer identity
  verify(intentId: string): Promise<VerificationResult>
}`

const docSections = [
  { id: 'overview', title: '1. Overview' },
  { id: 'architecture', title: '2. Architecture' },
  { id: 'payment-intent', title: '3. Payment Intent' },
  { id: 'quickstart', title: '4. SDK Quickstart' },
  { id: 'sdk-reference', title: '5. API & SDK Reference' },
  { id: 'payments', title: '6. Payments & Execution' },
  { id: 'privacy', title: '7. Privacy Guarantees' },
  { id: 'errors', title: '8. Error Reference' },
  { id: 'examples', title: '9. Integration Examples' },
]

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <AppHeader current="docs" />

      {/* Hero Header */}
      <div className="border-b border-border/60 bg-gradient-to-b from-card/30 to-background/50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8 sm:py-16">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-mono text-primary mb-4">
                <Terminal className="size-3.5" />
                <span>VeilPay Protocol v1.0 • Midnight Preprod</span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                VeilPay Developer Documentation
              </h1>
              <p className="mt-3 max-w-2xl text-base text-muted-foreground leading-relaxed">
                Build privacy-preserving programmable payments on the Midnight blockchain.
                Decouple payment fulfillment verification from customer identity exposure.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/docs/sdk"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs sm:text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
              >
                <Terminal className="size-4" />
                <span>Open SDK Explorer</span>
                <ArrowRight className="size-3.5" />
              </Link>
              <Link
                href="/app/create"
                className="inline-flex items-center gap-2 rounded-lg border border-border/80 bg-secondary/80 px-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground hover:bg-secondary transition"
              >
                <span>Merchant Dashboard</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8 sm:py-12">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[240px_1fr] lg:gap-14">
          {/* Sticky Sidebar Navigation */}
          <aside className="hidden lg:block lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)] lg:overflow-y-auto pr-4">
            <div className="space-y-6">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground font-semibold">
                  Documentation Guide
                </p>
                <nav className="mt-3">
                  <ul className="space-y-1">
                    {docSections.map((s) => (
                      <li key={s.id}>
                        <a
                          href={`#${s.id}`}
                          className="block rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
                        >
                          {s.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-primary font-mono text-xs font-semibold">
                  <Terminal className="size-4" />
                  <span>SDK Playground</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Test VeilPay methods directly in your browser against Midnight Preprod with live parameter inspection.
                </p>
                <Link
                  href="/docs/sdk"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
                >
                  <span>Launch Explorer</span>
                  <ExternalLink className="size-3" />
                </Link>
              </div>

              <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-2">
                <div className="text-[11px] font-mono text-muted-foreground uppercase font-semibold">
                  Active Network Target
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-muted-foreground">Network:</span>
                  <span className="text-primary font-medium">
                    {midnightPublicConfig.network || 'midnight-preprod'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-muted-foreground">Asset:</span>
                  <span className="text-foreground font-medium">tDUST / DUST</span>
                </div>
              </div>
            </div>
          </aside>

          {/* Content Area */}
          <div className="min-w-0 space-y-16">
            {/* 1. Overview */}
            <section id="overview" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-2 text-primary font-mono text-xs tracking-wider uppercase font-semibold">
                <Shield className="size-4" />
                <span>Protocol Fundamentals</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">1. Overview</h2>
              <div className="prose prose-invert max-w-none text-muted-foreground leading-relaxed space-y-4 text-sm sm:text-base">
                <p>
                  <strong className="text-foreground">VeilPay</strong> is a privacy-first payment intent protocol built on the{' '}
                  <strong className="text-foreground">Midnight blockchain</strong>. In conventional blockchain payments,
                  every transaction publicly exposes the customer&apos;s wallet balance, entire transaction history, and
                  associated activity to both the merchant and the entire world.
                </p>
                <p>
                  VeilPay replaces raw address-to-address transfers with{' '}
                  <strong className="text-foreground">Private Programmable Payment Intents</strong>. A payment intent defines
                  the cryptographic conditions required for a payment to be marked satisfied (amount predicate, destination,
                  deadline, and correlation reference). Midnight&apos;s Zero-Knowledge (ZK) proofs allow the customer to
                  prove that the conditions were fulfilled without revealing their source wallet address, overall balance, or
                  unrelated transaction graph.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-2">
                <div className="rounded-xl border border-border/70 bg-card/40 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-primary font-medium text-sm">
                    <Lock className="size-4" />
                    <span>Zero-Knowledge Proofs</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Verify compliance with predicate conditions without disclosing buyer addresses or holding amounts.
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/40 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-accent font-medium text-sm">
                    <Workflow className="size-4" />
                    <span>Programmable Predicates</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Support for exact values, minimum thresholds (&quot;at least&quot;), or flexible price ranges.
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-card/40 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-foreground font-medium text-sm">
                    <Layers className="size-4" />
                    <span>Midnight Preprod Ready</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Designed for Compact smart contracts on Midnight testnet/preprod, using tDUST and unshielded tokens.
                  </p>
                </div>
              </div>
            </section>

            {/* 2. Architecture */}
            <section id="architecture" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-2 text-primary font-mono text-xs tracking-wider uppercase font-semibold">
                <Cpu className="size-4" />
                <span>System Design</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">2. Architecture</h2>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                The VeilPay protocol orchestrates five actors. The application communicates only through typed boundaries,
                keeping private keys and prover workloads strictly segregated.
              </p>

              <div className="rounded-xl border border-border/70 bg-card/40 p-5">
                <Pipeline
                  steps={[
                    { label: 'Merchant', tone: 'neutral' },
                    { label: 'VeilPay Intent', tone: 'primary' },
                    { label: 'Midnight Prover & ZK Proof', tone: 'primary' },
                    { label: 'Contract Verification', tone: 'accent' },
                  ]}
                />
              </div>

              <div className="overflow-x-auto rounded-xl border border-border/70 mt-6">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="border-b border-border bg-muted/40 font-mono text-muted-foreground uppercase text-[11px]">
                    <tr>
                      <th className="p-3 sm:p-4">Component</th>
                      <th className="p-3 sm:p-4">Role in VeilPay</th>
                      <th className="p-3 sm:p-4">Information Visible</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-sans">
                    <tr>
                      <td className="p-3 sm:p-4 font-semibold text-foreground">Merchant</td>
                      <td className="p-3 sm:p-4 text-muted-foreground">Defines payment conditions, registers intent, receives settlement</td>
                      <td className="p-3 sm:p-4 text-muted-foreground">Intent ID, status, amount, reference, settlement tx</td>
                    </tr>
                    <tr>
                      <td className="p-3 sm:p-4 font-semibold text-foreground">Customer / Payer</td>
                      <td className="p-3 sm:p-4 text-muted-foreground">Satisfies intent using Midnight-compatible wallet (Lace)</td>
                      <td className="p-3 sm:p-4 text-muted-foreground">Payer wallet address remains <strong className="text-primary font-mono">PRIVATE</strong> to merchant</td>
                    </tr>
                    <tr>
                      <td className="p-3 sm:p-4 font-semibold text-foreground">VeilPay Contract</td>
                      <td className="p-3 sm:p-4 text-muted-foreground">Midnight Compact contract enforcing conditions and replay defense</td>
                      <td className="p-3 sm:p-4 text-muted-foreground">Intent commitment hash, expiration, satisfaction boolean</td>
                    </tr>
                    <tr>
                      <td className="p-3 sm:p-4 font-semibold text-foreground">Midnight Network</td>
                      <td className="p-3 sm:p-4 text-muted-foreground">Decentralized ledger running Midnight consensus &amp; verification</td>
                      <td className="p-3 sm:p-4 text-muted-foreground">Valid ZK proof without transaction graph linkage</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 3. Payment Intent */}
            <section id="payment-intent" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-2 text-primary font-mono text-xs tracking-wider uppercase font-semibold">
                <Workflow className="size-4" />
                <span>Lifecycle State Machine</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">3. Payment Intent Lifecycle</h2>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                Every payment in VeilPay is governed by a strict state machine. Transitions are unidirectional and cryptographically enforced:
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-primary">AWAITING_PAYMENT</span>
                    <span className="size-2 rounded-full bg-primary animate-pulse" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Intent is published and open. Waiting for customer wallet interaction.
                  </p>
                </div>

                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-amber-400">VERIFYING</span>
                    <span className="size-2 rounded-full bg-amber-400 animate-spin" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Transaction detected. ZK proof generated and submitted to Midnight contract.
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-emerald-400">VERIFIED</span>
                    <CheckCircle2 className="size-3.5 text-emerald-400" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Contract verified proof. Payment conditions completely fulfilled. Final state.
                  </p>
                </div>

                <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-rose-400">CANCELLED / EXPIRED</span>
                    <AlertTriangle className="size-3.5 text-rose-400" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Merchant revoked intent or deadline elapsed before fulfillment. Terminal state.
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <CodeBlock filename="lib/payments/types.ts" code={typesDefinitionCode} />
              </div>
            </section>

            {/* 4. SDK Quickstart */}
            <section id="quickstart" className="scroll-mt-24 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-primary font-mono text-xs tracking-wider uppercase font-semibold">
                    <Terminal className="size-4" />
                    <span>Getting Started</span>
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl mt-1">4. SDK Quickstart</h2>
                </div>
                <Link
                  href="/docs/sdk"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
                >
                  <span>Test in Explorer</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>

              <div className="space-y-4">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/20 text-xs font-mono font-bold text-primary">1</span>
                  <span>Install Package</span>
                </h3>
                <CodeBlock filename="terminal" language="bash" code={installCode} />
              </div>

              <div className="space-y-4">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/20 text-xs font-mono font-bold text-primary">2</span>
                  <span>Client Initialization</span>
                </h3>
                <CodeBlock filename="veilpay.ts" code={initCode} />
              </div>

              <div className="space-y-4">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/20 text-xs font-mono font-bold text-primary">3</span>
                  <span>Create a Payment Intent</span>
                </h3>
                <CodeBlock filename="create-intent.ts" code={createIntentCode} />
              </div>

              <div className="space-y-4">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/20 text-xs font-mono font-bold text-primary">4</span>
                  <span>Read Intent State</span>
                </h3>
                <CodeBlock filename="read-intent.ts" code={readStateCode} />
              </div>

              <div className="space-y-4">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/20 text-xs font-mono font-bold text-primary">5</span>
                  <span>Customer Payment Submission</span>
                </h3>
                <CodeBlock filename="pay-intent.ts" code={payIntentCode} />
              </div>
            </section>

            {/* 5. API / SDK Reference */}
            <section id="sdk-reference" className="scroll-mt-24 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-primary font-mono text-xs tracking-wider uppercase font-semibold">
                    <Code2 className="size-4" />
                    <span>Public Functions</span>
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl mt-1">5. API &amp; SDK Reference</h2>
                </div>
                <Link
                  href="/docs/sdk"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition"
                >
                  <Terminal className="size-3.5" />
                  <span>Try in Explorer</span>
                </Link>
              </div>

              <p className="text-muted-foreground text-sm leading-relaxed">
                Every public method implemented in the VeilPay service layer is documented below with parameters, return types, wallet requirements, and on-chain transaction status:
              </p>

              {/* Method 1: listPaymentIntents */}
              <div className="rounded-xl border border-border/80 bg-card/40 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded bg-primary/20 px-2 py-0.5 font-mono text-xs font-bold text-primary">GET</span>
                    <h3 className="font-mono text-sm sm:text-base font-semibold text-foreground">listPaymentIntents(params?)</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      No Wallet Req.
                    </span>
                    <span className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      Read-Only
                    </span>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Fetches paginated, filtered, and sorted payment intents registered for the current authenticated merchant.
                </p>
                <div className="space-y-2 text-xs font-mono">
                  <div className="text-muted-foreground">
                    <strong className="text-foreground">Parameters:</strong>{' '}
                    <code className="text-primary">{'{ search?: string, status?: PaymentIntentStatus | "all", sort?: string, page?: number, pageSize?: number }'}</code>
                  </div>
                  <div className="text-muted-foreground">
                    <strong className="text-foreground">Returns:</strong>{' '}
                    <code className="text-foreground">Promise&lt;ListPaymentIntentsResponse&gt;</code> (intents list, total count, pagination metadata)
                  </div>
                  <div className="text-muted-foreground">
                    <strong className="text-foreground">Errors:</strong>{' '}
                    <code className="text-destructive">500 Internal server error</code>
                  </div>
                </div>
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Defined in <code className="text-foreground">lib/payments/service.ts</code></span>
                  <Link href="/docs/sdk?method=listPaymentIntents" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                    Try method <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>

              {/* Method 2: fetchPaymentIntent */}
              <div className="rounded-xl border border-border/80 bg-card/40 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded bg-primary/20 px-2 py-0.5 font-mono text-xs font-bold text-primary">GET</span>
                    <h3 className="font-mono text-sm sm:text-base font-semibold text-foreground">fetchPaymentIntent(id)</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      No Wallet Req.
                    </span>
                    <span className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      Read-Only
                    </span>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Fetches the complete authoritative state of a single payment intent by its unique ID.
                </p>
                <div className="space-y-2 text-xs font-mono">
                  <div className="text-muted-foreground">
                    <strong className="text-foreground">Parameters:</strong>{' '}
                    <code className="text-primary">id: string</code> (e.g. <code className="text-foreground">&quot;pi_4a91...&quot;</code>)
                  </div>
                  <div className="text-muted-foreground">
                    <strong className="text-foreground">Returns:</strong>{' '}
                    <code className="text-foreground">Promise&lt;PaymentIntent&gt;</code>
                  </div>
                  <div className="text-muted-foreground">
                    <strong className="text-foreground">Errors:</strong>{' '}
                    <code className="text-destructive">404 Payment intent not found</code>, <code className="text-destructive">500 Server error</code>
                  </div>
                </div>
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Defined in <code className="text-foreground">lib/payments/service.ts</code></span>
                  <Link href="/docs/sdk?method=fetchPaymentIntent" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                    Try method <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>

              {/* Method 3: createPaymentIntentApi */}
              <div className="rounded-xl border border-border/80 bg-card/40 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded bg-accent/20 px-2 py-0.5 font-mono text-xs font-bold text-accent">POST</span>
                    <h3 className="font-mono text-sm sm:text-base font-semibold text-foreground">createPaymentIntentApi(conditions)</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      No Wallet Req.
                    </span>
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-mono text-primary">
                      Creates State / Tx
                    </span>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Validates payment conditions and registers a new payment intent with status <code className="font-mono text-foreground">awaiting_payment</code>.
                </p>
                <div className="space-y-2 text-xs font-mono">
                  <div className="text-muted-foreground">
                    <strong className="text-foreground">Parameters:</strong>{' '}
                    <code className="text-primary">conditions: PaymentConditions</code> (amount, recipient, expiresAt, reference)
                  </div>
                  <div className="text-muted-foreground">
                    <strong className="text-foreground">Returns:</strong>{' '}
                    <code className="text-foreground">Promise&lt;{'{ intent: PaymentIntent, midnightStatus: string }'}&gt;</code>
                  </div>
                  <div className="text-muted-foreground">
                    <strong className="text-foreground">Errors:</strong>{' '}
                    <code className="text-destructive">422 Validation failed</code>, <code className="text-destructive">400 Bad request</code>
                  </div>
                </div>
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Defined in <code className="text-foreground">lib/payments/service.ts</code></span>
                  <Link href="/docs/sdk?method=createPaymentIntentApi" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                    Try method <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>

              {/* Method 4: cancelPaymentIntentApi */}
              <div className="rounded-xl border border-border/80 bg-card/40 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded bg-rose-500/20 px-2 py-0.5 font-mono text-xs font-bold text-rose-400">POST</span>
                    <h3 className="font-mono text-sm sm:text-base font-semibold text-foreground">cancelPaymentIntentApi(id)</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      Merchant Auth Req.
                    </span>
                    <span className="rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                      Mutating
                    </span>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Irreversibly cancels an active payment intent. Only permitted while status is <code className="font-mono text-foreground">draft</code> or <code className="font-mono text-foreground">awaiting_payment</code>.
                </p>
                <div className="space-y-2 text-xs font-mono">
                  <div className="text-muted-foreground">
                    <strong className="text-foreground">Parameters:</strong>{' '}
                    <code className="text-primary">id: string</code>
                  </div>
                  <div className="text-muted-foreground">
                    <strong className="text-foreground">Returns:</strong>{' '}
                    <code className="text-foreground">Promise&lt;PaymentIntent&gt;</code> with <code className="text-foreground">status === &quot;cancelled&quot;</code>
                  </div>
                  <div className="text-muted-foreground">
                    <strong className="text-foreground">Errors:</strong>{' '}
                    <code className="text-destructive">403 Unauthorized</code>, <code className="text-destructive">400 Cannot cancel verified or expired intent</code>
                  </div>
                </div>
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Defined in <code className="text-foreground">lib/payments/service.ts</code></span>
                  <Link href="/docs/sdk?method=cancelPaymentIntentApi" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                    Try method <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>

              {/* Method 5: submitCheckoutPayment */}
              <div className="rounded-xl border border-border/80 bg-card/40 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded bg-accent/20 px-2 py-0.5 font-mono text-xs font-bold text-accent">POST</span>
                    <h3 className="font-mono text-sm sm:text-base font-semibold text-foreground">submitCheckoutPayment(intentId, payload)</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-mono text-amber-400">
                      Wallet Req.
                    </span>
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-mono text-primary">
                      On-Chain ZK Proof
                    </span>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Submits a customer settlement against an active payment intent. Delegates to the Midnight proving server and verification contract.
                </p>
                <div className="space-y-2 text-xs font-mono">
                  <div className="text-muted-foreground">
                    <strong className="text-foreground">Parameters:</strong>{' '}
                    <code className="text-primary">intentId: string, payload: {'{ payerAddress: string, network?: string }'}</code>
                  </div>
                  <div className="text-muted-foreground">
                    <strong className="text-foreground">Returns:</strong>{' '}
                    <code className="text-foreground">Promise&lt;PaySubmitResponse&gt;</code> ({'{ success, status, missingCapabilities? }'})
                  </div>
                  <div className="text-muted-foreground">
                    <strong className="text-foreground">Errors / Statuses:</strong>{' '}
                    <code className="text-amber-400">503 MIDNIGHT_INTEGRATION_PENDING</code>, <code className="text-destructive">400 INTENT_EXPIRED</code>, <code className="text-destructive">422 Verification failed</code>
                  </div>
                </div>
                <div className="pt-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Defined in <code className="text-foreground">lib/payments/payment-checkout.ts</code></span>
                  <Link href="/docs/sdk?method=submitCheckoutPayment" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                    Try method <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>

              {/* Protocol Seam */}
              <div className="space-y-3 pt-4">
                <h3 className="text-base font-semibold text-foreground">Protocol Boundary Interface (MidnightClient)</h3>
                <p className="text-xs text-muted-foreground">
                  The internal typed contract boundary on the server. Used to bind custom Midnight Compact contracts and proof-server endpoints.
                </p>
                <CodeBlock filename="lib/midnight/client.ts" code={midnightClientSeamCode} />
              </div>
            </section>

            {/* 6. Payments */}
            <section id="payments" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-2 text-primary font-mono text-xs tracking-wider uppercase font-semibold">
                <Layers className="size-4" />
                <span>Execution Mechanics</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">6. Payments &amp; Settlement</h2>
              <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                <p>
                  VeilPay processes payments using <strong className="text-foreground">tNIGHT / DUST</strong> native tokens and
                  unshielded tokens on Midnight testnet/preprod.
                </p>
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground text-sm">Transaction Lifecycle &amp; Replay Defense:</h3>
                  <ol className="list-decimal list-inside space-y-2 pl-2 text-xs sm:text-sm">
                    <li>
                      <strong className="text-foreground">Unique Intent Binding:</strong> Each intent has a cryptographically
                      unique UUID (<code className="font-mono text-primary">pi_...</code>). A single intent ID can only be verified once.
                    </li>
                    <li>
                      <strong className="text-foreground">Zero-Knowledge Proof Generation:</strong> The payer&apos;s client/wallet
                      constructs private inputs proving ownership of sufficient funds and satisfaction of the recipient and amount predicates.
                    </li>
                    <li>
                      <strong className="text-foreground">Settlement Nullifier:</strong> Once verified on Midnight, a unique nullifier
                      is committed to prevent replay attacks across blocks or intents.
                    </li>
                    <li>
                      <strong className="text-foreground">Failed Payment Scenarios:</strong> If the transaction deadline elapses,
                      or if the payer provides an amount insufficient for the predicate (e.g. providing 10 tDUST for an &quot;at least 50&quot; intent),
                      the proof generation or contract verification will reject with <code className="font-mono text-destructive">422 VERIFICATION_FAILED</code>.
                    </li>
                  </ol>
                </div>
              </div>
            </section>

            {/* 7. Privacy */}
            <section id="privacy" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-2 text-primary font-mono text-xs tracking-wider uppercase font-semibold">
                <Shield className="size-4" />
                <span>Cryptographic Secrecy</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">7. Privacy Guarantees</h2>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                To build transparent and trustworthy systems, VeilPay explicitly documents what information is public,
                what remains private, and what the contract actually proves.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Public */}
                <div className="rounded-xl border border-border/80 bg-card/50 p-5 space-y-3">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                    <Unlock className="size-4" />
                    <span>Public Information</span>
                  </div>
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400">•</span>
                      <span><strong>Intent Requirements:</strong> Required amount condition, asset symbol (tDUST), and deadline.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400">•</span>
                      <span><strong>Merchant Address:</strong> The recipient account designated to receive settlement.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400">•</span>
                      <span><strong>Reference Handle:</strong> Non-secret order identifier (e.g. Invoice #2026-01).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400">•</span>
                      <span><strong>Satisfaction State:</strong> Boolean confirmation on-chain that the conditions were met.</span>
                    </li>
                  </ul>
                </div>

                {/* Private */}
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-3">
                  <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                    <Lock className="size-4" />
                    <span>Strictly Private (ZK Shielded)</span>
                  </div>
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span><strong>Payer Wallet Address:</strong> Never revealed to the merchant or exposed on public ledger.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span><strong>Payer Account Balance:</strong> Total holdings remain entirely hidden.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span><strong>Transaction History:</strong> Previous and subsequent purchases cannot be linked or profiled.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span><strong>Actual Amount Paid in Range:</strong> If predicate is between $10-$50, exact paid value can remain shielded.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 8. Errors */}
            <section id="errors" className="scroll-mt-24 space-y-4">
              <div className="flex items-center gap-2 text-primary font-mono text-xs tracking-wider uppercase font-semibold">
                <AlertTriangle className="size-4" />
                <span>Developer Diagnostics</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">8. Error Reference</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Summary of implemented error codes and failure conditions returned by the VeilPay SDK and HTTP API:
              </p>

              <div className="overflow-x-auto rounded-xl border border-border/70">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="border-b border-border bg-muted/40 font-mono text-muted-foreground uppercase text-[11px]">
                    <tr>
                      <th className="p-3">Error Code</th>
                      <th className="p-3">HTTP</th>
                      <th className="p-3">Description</th>
                      <th className="p-3">Remedy</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-mono text-xs">
                    <tr>
                      <td className="p-3 font-semibold text-destructive">MIDNIGHT_NOT_CONFIGURED</td>
                      <td className="p-3 text-muted-foreground">503</td>
                      <td className="p-3 text-muted-foreground font-sans">MidnightClient is called while contract or proof-server is not wired.</td>
                      <td className="p-3 text-foreground font-sans">Set <code className="text-primary">NEXT_PUBLIC_MIDNIGHT_CONTRACT_ADDRESS</code> in environment.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-destructive">INTENT_EXPIRED</td>
                      <td className="p-3 text-muted-foreground">400</td>
                      <td className="p-3 text-muted-foreground font-sans">The intent&apos;s <code className="text-primary">expiresAt</code> timestamp is in the past.</td>
                      <td className="p-3 text-foreground font-sans">Create a new intent with a valid future expiration deadline.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-destructive">INTENT_CANCELLED</td>
                      <td className="p-3 text-muted-foreground">400</td>
                      <td className="p-3 text-muted-foreground font-sans">Attempted to satisfy or modify an intent cancelled by merchant.</td>
                      <td className="p-3 text-foreground font-sans">Check merchant intent status or reissue order intent.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-destructive">WALLET_REQUIRED</td>
                      <td className="p-3 text-muted-foreground">400</td>
                      <td className="p-3 text-muted-foreground font-sans">Payment attempted without an active payer account address.</td>
                      <td className="p-3 text-foreground font-sans">Connect Lace / Midnight wallet before executing checkout.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-destructive">VALIDATION_FAILED</td>
                      <td className="p-3 text-muted-foreground">422</td>
                      <td className="p-3 text-muted-foreground font-sans">Missing amount, invalid decimal, or empty recipient address.</td>
                      <td className="p-3 text-foreground font-sans">Check <code className="text-primary">issues[]</code> array returned in response.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 9. Integration Examples */}
            <section id="examples" className="scroll-mt-24 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-primary font-mono text-xs tracking-wider uppercase font-semibold">
                    <FileCode className="size-4" />
                    <span>Complete Snippets</span>
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl mt-1">9. Integration Examples</h2>
                </div>
                <Link
                  href="/docs/sdk"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
                >
                  <Terminal className="size-3.5" />
                  <span>Interactive Explorer</span>
                </Link>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Next.js Route Handler Example (Server-side intent generation)</h3>
                <CodeBlock
                  filename="app/api/checkout/create-intent/route.ts"
                  code={`import { NextResponse } from 'next/server'
import { createPaymentIntentApi } from '@/lib/payments/service'

export async function POST(request: Request) {
  const { orderId, totalAmount, merchantVaultAddress } = await request.json()

  const { intent } = await createPaymentIntentApi({
    amount: {
      kind: 'at_least',
      asset: 'tDUST',
      amount: totalAmount,
    },
    recipient: merchantVaultAddress,
    reference: orderId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  })

  return NextResponse.json({
    checkoutUrl: \`\${process.env.NEXT_PUBLIC_SITE_URL}/pay/\${intent.id}\`,
    intentId: intent.id,
  })
}`}
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Intent Polling &amp; Verification Listener</h3>
                <CodeBlock
                  filename="hooks/use-intent-listener.ts"
                  code={`import useSWR from 'swr'
import { fetchPaymentIntent } from '@/lib/payments/service'

export function usePaymentIntentPolling(intentId: string) {
  const { data: intent, error, mutate } = useSWR(
    intentId ? \`/api/intents/\${intentId}\` : null,
    () => fetchPaymentIntent(intentId),
    {
      refreshInterval: (currentIntent) =>
        currentIntent?.status === 'verified' || currentIntent?.status === 'cancelled'
          ? 0
          : 3000,
    }
  )

  return {
    intent,
    isVerified: intent?.status === 'verified',
    isLoading: !error && !intent,
    error,
    refresh: mutate,
  }
}`}
                />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
