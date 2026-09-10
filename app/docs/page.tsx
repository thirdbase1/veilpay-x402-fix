import type { Metadata } from 'next'
import { AppHeader } from '@/components/site/app-header'
import { CodeBlock } from '@/components/docs/code-block'
import { Pipeline } from '@/components/site/pipeline'

export const metadata: Metadata = {
  title: 'Protocol & SDK reference',
  description:
    'The typed integration boundary between a merchant application, VeilPay, and the Midnight verification layer.',
}

const paymentIntentType = `export type AssetSymbol = 'DUST' | 'tDUST' | 'USDC'

export type AmountPredicateKind = 'exactly' | 'at_least' | 'range'

export interface AmountCondition {
  kind: AmountPredicateKind
  asset: AssetSymbol
  amount: string        // decimal kept as string to avoid float rounding
  amountMax?: string    // only used when kind === 'range'
}

export interface PaymentConditions {
  amount: AmountCondition
  recipient: string     // merchant-controlled recipient address
  expiresAt?: string    // ISO-8601 expiry
  reference?: string    // public reconciliation handle (order/invoice id)
}

export interface PaymentIntent {
  id: string
  conditions: PaymentConditions
  status: PaymentIntentStatus
  createdAt: string
  network?: string
}`

const verificationType = `export type PaymentIntentStatus =
  | 'draft'
  | 'awaiting_payment'
  | 'verifying'
  | 'verified'
  | 'expired'
  | 'failed'

// The verification layer answers only the question the merchant needs.
// It carries no payer identity, balance, or transaction history.
export interface VerificationResult {
  intentId: string
  satisfied: boolean
  status: 'verified' | 'failed' | 'expired'
  proofReference?: string
  verifiedAt?: string
}`

const clientType = `import type { PaymentIntent, VerificationResult } from '@/lib/payments/types'

// The single seam between the app and the Midnight-backed protocol.
// Implementations live server-side and hold RPC/proving references
// that must never reach the browser.
export interface MidnightClient {
  readonly ready: boolean
  createIntent(intent: PaymentIntent): Promise<PaymentIntent>
  getIntent(intentId: string): Promise<PaymentIntent>
  verify(intentId: string): Promise<VerificationResult>
}`

const usageExample = `import { buildDraftIntent, validateConditions } from '@/lib/payments/intent'
import { getMidnightClient } from '@/lib/midnight/client'

const conditions = {
  amount: { kind: 'at_least', asset: 'tDUST', amount: '25.00' },
  recipient: merchantAddress,
  reference: 'order-1042',
}

const issues = validateConditions(conditions)
if (issues.length === 0) {
  const intent = buildDraftIntent(conditions, { network })
  // Throws MidnightNotConfiguredError until a real client is registered.
  const created = await getMidnightClient().createIntent(intent)
}`

const envExample = `# Public (browser-safe) — identifiers only, never credentials
NEXT_PUBLIC_MIDNIGHT_NETWORK=
NEXT_PUBLIC_MIDNIGHT_CONTRACT_ADDRESS=
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_REPO_URL=

# Server-only (never prefixed with NEXT_PUBLIC_) — set in your deployment
# MIDNIGHT_RPC_URL=
# MIDNIGHT_PROVING_KEY=`

const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'payment-intent', label: 'PaymentIntent' },
  { id: 'verification', label: 'Verification' },
  { id: 'client', label: 'MidnightClient' },
  { id: 'usage', label: 'Usage' },
  { id: 'configuration', label: 'Configuration' },
]

export default function DocsPage() {
  return (
    <>
      <AppHeader current="docs" />
      <main
        id="main"
        className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[200px_1fr] lg:gap-14"
      >
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Reference
          </p>
          <nav aria-label="Documentation" className="mt-4">
            <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="inline-block rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="flex min-w-0 flex-col gap-14">
          <section id="overview" className="scroll-mt-24">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Protocol &amp; SDK reference
            </h1>
            <p className="mt-4 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
              This reference reflects the actual typed integration boundary shipped in this
              build. It describes the contract between a merchant application, VeilPay, and the
              Midnight verification layer — not a finished implementation. The Midnight client
              is intentionally unimplemented here and throws a typed error until wired to a
              deployed contract.
            </p>
          </section>

          <section id="architecture" className="scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight">Architecture</h2>
            <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
              The application depends only on VeilPay&apos;s typed boundary. The Midnight
              verification layer is swapped in behind that boundary, so application code does
              not change when the real proving layer lands.
            </p>
            <div className="mt-5 rounded-xl border border-border/70 bg-card/40 p-5">
              <Pipeline
                steps={[
                  { label: 'Merchant application', tone: 'neutral' },
                  { label: 'VeilPay payment intent', tone: 'primary' },
                  { label: 'Midnight', tone: 'primary' },
                  { label: 'Verification', tone: 'accent' },
                ]}
              />
            </div>
          </section>

          <section id="payment-intent" className="scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight">PaymentIntent</h2>
            <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
              A payment intent describes what a merchant wants verified — never how Midnight
              proves it. These shapes survive once the real proving layer is wired in.
            </p>
            <div className="mt-5">
              <CodeBlock filename="lib/payments/types.ts" code={paymentIntentType} />
            </div>
          </section>

          <section id="verification" className="scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight">Verification</h2>
            <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
              The verification result answers the only question a merchant needs. It carries no
              payer identity, balance, or history.
            </p>
            <div className="mt-5">
              <CodeBlock filename="lib/payments/types.ts" code={verificationType} />
            </div>
          </section>

          <section id="client" className="scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight">MidnightClient</h2>
            <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
              The single seam through which the application talks to the privacy-preserving
              contract. Implementations belong on the server.
            </p>
            <div className="mt-5">
              <CodeBlock filename="lib/midnight/client.ts" code={clientType} />
            </div>
          </section>

          <section id="usage" className="scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight">Usage</h2>
            <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
              Validate conditions, build a typed draft intent, then hand it to the client. Until
              a real client is registered, <code className="font-mono text-foreground">createIntent</code>{' '}
              rejects with a typed <code className="font-mono text-foreground">MidnightNotConfiguredError</code>.
            </p>
            <div className="mt-5">
              <CodeBlock filename="example.ts" code={usageExample} />
            </div>
          </section>

          <section id="configuration" className="scroll-mt-24">
            <h2 className="text-xl font-semibold tracking-tight">Configuration</h2>
            <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
              All environment-dependent values come from configuration. Only browser-safe
              identifiers are exposed with the <code className="font-mono text-foreground">NEXT_PUBLIC_</code>{' '}
              prefix; RPC endpoints, proving keys, and secrets must remain server-only.
            </p>
            <div className="mt-5">
              <CodeBlock filename=".env.example" language="bash" code={envExample} />
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
