# VeilPay v2: Building a NullPay-Class Protocol on Midnight

Reference product: [NullPay](https://github.com/geekofdhruv/NullPay) (Aleo).
This document maps its architecture onto Midnight, states the gap between our
deployed v1 oracle contract and a real payment protocol, and defines the
phased build plan.

## What NullPay Actually Does

From its README and deployed contracts
(`zk_pay_proofs_privacy_v29.aleo`, wallet contract v6):

1. **Invoice registry (on-chain).** `create_invoice_*` stores an invoice whose
   merchant address and amount are BHP256-hashed with a 128-bit salt. The
   chain sees commitments, not plaintext.
2. **Real token movement (on-chain).** `pay_invoice_usad` / `pay_invoice_usdcx`
   execute *actual private transfers*: Aleo's `transfer_private` for Credits,
   private token programs for stablecoins. The payer consumes their shielded
   records; the merchant receives shielded records. This is the part our v1
   does not have.
3. **Atomic dual receipts.** Every payment mints a `PayerReceipt` and a
   `MerchantReceipt` record in the same transition -- private proof of
   purchase for both sides.
4. **Replay protection.** Receipt tracking prevents paying twice with the
   same secret.
5. **Expiry by block height** enforced in the contract.
6. **Token-agnostic invoices** (`create_invoice_any`): donation links that
   accept any supported private token; the transition is chosen by the payer.
7. **Oracle conversion.** Pay in token X, settle an invoice denominated in
   token Y; the converted amount and compliance path are validated in-circuit.
8. **Off-chain stack.** Node/Express + Supabase backend (invoice lookups,
   AES-256-GCM-encrypted PII, realtime payment notifications), React frontend,
   hosted checkout, `@nullpay/node` SDK, CLI onboarding, MCP server, burner
   wallets with on-chain encrypted backup.

## Gap Analysis: VeilPay v1 vs NullPay

| Capability | NullPay | VeilPay v1 (deployed) |
|---|---|---|
| Invoice/intent registry with hashed merchant | yes | yes (`H(merchantSecretKey)`) |
| Payer anonymity via ZK | yes | yes (secret-commitment proof) |
| **On-chain token transfer** | **yes (private records)** | **no -- oracle only** |
| Receipts | dual on-chain records | none (status field only) |
| Replay protection | receipt tracking | state machine (ACTIVE-only pay) |
| Expiry | block height | ops counter (no block access in Compact) |
| Token support | Credits, USDCx, USAD | unit-agnostic number, no custody |
| Oracle conversion | yes | no |
| Backend indexer + realtime | Supabase | gateway indexer polling |
| SDK / hosted checkout / MCP | yes | docs only |

The single biggest gap: **v1 never moves value.** Everything else is
incremental.

## VeilPay v2 Design on Midnight

### Token movement model (Model A: direct transfer, NullPay-style)

Midnight contracts can consume and produce shielded coin records inside
circuits -- the official `compact-fungible-token` example is the template to
validate against before writing circuits. Model A keeps the payer -> merchant
transfer direct, exactly like NullPay:

- `pay(intentId)` consumes the *payer's* token records (zswap inputs supplied
  as circuit witnesses), asserts their total >= intent amount for the intent's
  `tokenType`, outputs one coin record to the **merchant's coin public key**
  (registered on the intent at creation), and marks the intent `PAID`.
- No contract custody, no escrow liability, minimal proving cost. Refunds
  become a merchant wallet transfer plus an on-chain `refund(intentId, amount)`
  status update (oracle-style accounting), which matches NullPay's model.
- Model B (contract escrow) is possible on Midnight but adds custody risk and
  proving cost for no NullPay parity benefit; defer it.

### Contract surface (v2)

```
Intent {
  merchantId        Bytes<32>     // H(merchantSecretKey)          (as v1)
  merchantCoinPk    Bytes<32>     // NEW: where tokens land on pay
  tokenType         TokenType     // NEW: which token settles this intent
  amount            Uint<128>
  expiresAt         Uint<64>      // ops-counter TTL (unchanged, documented)
  status            IntentStatus
  secretCommitment  Bytes<32>     // unchanged
  paidAmount / refundedAmount
}

receipts: Map<Uint<64>, Bytes<32>>  // NEW: H(receiptSecret, intentId,
                                    //      paidAmount, tokenType) per payment

createIntent(tokenType, amount, merchantCoinPk, expiresAt) -> id
pay(intentId)            // consumes payer records, pays merchantCoinPk,
                         // emits receipt commitment, marks PAID
createOpenIntent(expiresAt, label) -> id   // NullPay's create_invoice_any:
                                           // tokenType/amount set at pay time
refund(intentId, refundAmount)             // merchant-only status update
cancel(intentId)                           // unchanged
isPaid(intentId) -> Boolean                // unchanged
receiptFor(intentId) -> Bytes<32>          // read a receipt commitment
```

Payer/merchant keep their `receiptSecret` privately; showing the commitment
plus the secret proves a specific payment without linking it to other
payments -- Midnight's equivalent of NullPay's dual records, minus record
minting (Midnight zswap coins are the value bearer; receipts are ledger
commitments).

### Expiry

Compact has no block-height oracle. Keep the ops-counter TTL for v2. A client
supplied block-height witness is possible but is a trust assumption (the
submitter can lie); NullPay can use block height natively in Leo because Leo
programs read chain context. Document this divergence honestly.

### Off-chain stack (Phase 2)

| NullPay piece | VeilPay equivalent |
|---|---|
| Supabase Postgres + realtime | Supabase (or Neon) intent index + push notifications; source of truth remains the chain |
| AES-256-GCM encrypted PII | same approach for merchant profile data |
| Hosted checkout | `/pay/[id]` route: amount, token, expiry, pay button (Lace/connector) |
| `@nullpay/node` | `@veilpay/sdk`: createIntent via server, getStatus via gateway indexer, webhook verification |
| CLI onboarding | existing `preprod-tx` driver, extended with merchant onboarding |
| MCP server | later phase; the gateway stack is already callable from agents |
| Burner wallets | fresh 32-byte seeds are already the identity primitive; add UI to generate/rotate |

Midnight-specific advantage we already have: hosted proving via the gateway
(browsers do not need to run proofs) and sponsored fees (customers do not need
dust) -- NullPay needed Wave 4 delegated proving to reach the same place.

## Phased Build Plan

1. **Phase 1 -- contract v2.** Validate coin-in/coin-out circuit patterns
   against the `compact-fungible-token` example; extend `veilpay.compact` with
   `tokenType`, `merchantCoinPk`, receipts, `pay` record consumption, and
   `createOpenIntent`; keep v1 tests green; add v2 tests; push, let CI compile,
   download managed artifacts, deploy v2 through the gateway stack.
2. **Phase 2 -- off-chain.** Supabase schema (intents, payments, merchants;
   encrypted profile fields), backend API routes, hosted `/pay/[id]` checkout
   with realtime status, `/verify/[id]` public proof page.
3. **Phase 3 -- SDK + webhooks.** `@veilpay/sdk` package (create intent,
   hosted session, poll status, verify webhook HMAC), merchant onboarding CLI.
4. **Phase 4 -- product depth.** Oracle conversion (in-circuit amount
   validation), multi-pay/campaign intents, card-like PIN profile, MCP server,
   selective-disclosure audit exports.

## Open Items To Validate During Phase 1

- Exact Compact syntax for consuming payer zswap records inside a contract
  circuit (template: `midnightntwrk` fungible-token example).
- Whether `TokenType` can be a public intent parameter vs stored bytes.
- Merchant coin public key derivation from the merchant seed (which HD role
  maps to coin keys) so `createIntent` can register it without a second
  circuit.
- Gateway support for transactions that carry coin I/O (proving path is
  hosted, so expected fine; submit path unchanged).
