# VeilPay v1 vs v2 - What Changed and Why

Audience: integration agents and developers. Read this before touching either
contract. Both are compiled, tested, and live on Midnight Preprod.

## The one-line difference

- **v1 proves that a payment happened. v2 makes a payment happen.**
- v1 is a zero-knowledge *oracle*: a merchant records an intent, a customer
  proves (in-circuit, without revealing who they are) that they know the
  payment secret, and the intent flips to `PAID`. No coins move; the real
  settlement is assumed to have occurred off-chain (card, bank, another chain).
- v2 is a zero-knowledge *payment*: the same secret proof additionally spends
  a real shielded zswap coin - `intent.amount` goes to the merchant's coin
  public key inside the transaction, excess returns to the payer as change.
  This is NullPay-class behavior: private, verifiable payment that actually
  settles value on-chain.

**The goal of v2** is product parity with NullPay (built on Aleo) ported to
Midnight: a customer pays a merchant in a shielded token such that the
merchant receives provable confirmation and a public receipt exists, yet
neither the payer's identity, the coin spent, nor the balance history is
public. v1 cannot do this because it has no token custody at all.

## Contract-level diff

| | v1 `veilpay.compact` | v2 `veilpay2.compact` |
|---|---|---|
| Live address | `0x304666ce...9d719f` (block 2508900) | `0x85a0f911...583a7` (block 2521381) |
| Deployment artifact | `deployments/preprod.json` | `deployments/preprod-v2.json` |
| Source file | `contract/src/veilpay.compact` | `contract/src/veilpay2.compact` |
| Compiled module | `contract/src/managed/veilpay/` | `contract/src/managed/veilpay2/` |
| TS wrapper | `api/src/index.ts` (`VeilPayContract`) | `api/src/index2.ts` (v2 wrapper) |
| Lifecycle CLI | `npm --workspace cli run preprod-tx` | `npm --workspace cli run preprod-tx2` |
| Live verifier script | `scripts/verify-live.mjs` | `scripts/verify-v2-live.mjs` |
| Moves token value | **No** - status oracle only | **Yes** - `sendShielded` coin in, merchant coin key out |
| `createIntent` args | `(amount, expiresAt)` | `(amount, expiresAt, tokenColor, merchantCoinPk)` |
| `pay` signature | `pay(intentId): []` | `pay(intentId, coin: QualifiedShieldedCoinInfo): ShieldedSendResult` |
| Extra ledger | - | `receipts: Map<Uint<64>, Bytes<32>>` |
| Extra witness | - | `receiptSecret()` (long-lived payer receipt key) |
| Intent fields | merchantId, amount, expiresAt, status, secretCommitment, paidAmount, refundedAmount | all of v1's **plus** `merchantCoinPk` and `tokenColor` |
| Tests | 10 contract tests | 11 dedicated v2 tests (21/21 total in CI) |

## What v2 added, circuit by circuit

### `createIntent(amount, expiresAt, tokenColor, merchantCoinPk)`

The merchant now registers *where the money lands* (`merchantCoinPk`, a zswap
coin public key) and *which token is acceptable* (`tokenColor`). A zero
`tokenColor` (`0x00...00`) makes an **open intent** that accepts any shielded
token color. Everything else (id counter, payment-secret commitment,
merchant identity `H(merchantSecretKey)`) is inherited from v1.

### `pay(intentId, coin)` - the real transfer

1. Re-checks v1's conditions: intent exists, `ACTIVE`, not expired, and the
   witness `paymentSecret` matches the stored `secretCommitment`. This is the
   anonymity mechanism: any holder of the secret can pay; no payer identity is
   ever disclosed.
2. Checks the coin: `coin.value >= intent.amount`, and if the intent is not
   open, `coin.color == intent.tokenColor`.
3. `sendShielded(disclose(coin), merchant, intent.amount)` consumes the
   payer's shielded coin and pays the merchant's coin key. Change (if the
   coin over-covers the price) goes back to the payer inside the same
   transaction via `sendImmediateShielded` (official burn-with-change pattern).
4. Writes a **payer receipt commitment** into the public `receipts` map:
   `H("veilpay:receipt:" || id || amount || receiptSecret)`. Anyone can see a
   receipt exists; only the payer holds `receiptSecret`, so the payer can
   prove "I made this payment" later without linking to any wallet.

Public result: status flips to `PAID`. The coin consumed, its owner, and its
tree position are never public.

### `refund` / `cancel`

Same authorization model as v1 (`merchantId == H(merchantSecretKey)`), same
state transitions and replay guard via `sequence`. v2's `refund` marks the
intent and records `refundedAmount` but does **not** push coins back - the
merchant sends the refund from their own wallet out-of-band. This is NullPay
Model A: the contract never holds custody, so it can never go insolvent.

### `isPaid(intentId)`

Unchanged pure read in both versions.

## Lifecycle, side by side

```text
v1 (oracle)                        v2 (NullPay-parity)
---------------                    ------------------------------
merchant createIntent              merchant createIntent
  -> id, paymentSecret               (+ tokenColor, merchantCoinPk)
                                       -> id, paymentSecret
customer receives link/QR          customer receives link/QR
pays off-chain (card/bank/...)     payer wallet holds a shielded coin
customer pay(id)                   customer pay(id, coin)
  proves secret only                 proves secret AND spends coin
  intent = PAID                      amount -> merchant coin key
merchant reconciles off-chain        change -> payer
                                     receipt commitment -> public map
                                     intent = PAID
                                   merchant verifies in-band, or refunds
                                     from their wallet (refund marks state)
```

## What this means for the website/app integration

- Build against **v2 only**. It is a superset of v1's guarantees; v1 stays
  deployed purely as the oracle use-case and as audit history.
- The intent's money destination is the merchant's zswap coin public key, so
  a merchant must supply one at `createIntent`. v1 had no concept of this.
- `pay` is not a one-liner like v1's: the payer's client must provide a real
  `QualifiedShieldedCoinInfo` (nonce, color, value, `mt_index`) - the wallet
  must own at least one synced shielded coin of the right color. Until a
  funded shielded coin exists on preprod for the payer, integrations can
  exercise `createIntent`, `isPaid`, refund bookkeeping, and reads, but a
  value-moving `pay` will fail its coin assertions.
- Accept-any-token (`tokenColor = 0`) is the default UX for an MVP checkout;
  pin the color once you choose a specific preprod token.
- The public `receipts` map is the verification surface for "show me proof I
  paid" flows: recompute `H(id || amount || receiptSecret)` client-side and
  compare with `receipts.lookup(id)`.

## Token support

There is no native VeilPay token. v2 settles in **any zswap shielded coin
color** on Midnight preprod. `tokenColor` is exactly the 32-byte coin color;
open intents accept any. Value never touches contract custody: coins move
payer-coin -> merchant-coin (plus change) inside the `pay` transaction, and
refunds are merchant-wallet out-of-band.

## Shared privacy invariants (both versions)

- Merchant identity is `H(merchantSecretKey)`, never an address.
- The payment secret lives only in the payer's private state; on-chain there
  is only its commitment.
- Anything not explicitly `disclose`d stays private; v2's additional privacy
  win is that the coin, its owner, and the Merkle-tree position are consumed
  privately even though `PAID` is public.
