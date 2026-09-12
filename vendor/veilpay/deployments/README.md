# VeilPay Contract Artifacts

This directory is the source of truth for **where VeilPay lives** and **what it
can do**, so any agent or website can plug into the deployed contract without
rebuilding it.

## Files

| File | What it is |
|---|---|
| `preprod.json` | Deployment artifact: live contract address, deploy tx, block, network endpoints, compiler versions, source hash, and how it was deployed. |
| `veilpay-contract-info.json` | Compiler-generated circuit/state schema (circuits, witnesses, ledger shape). Read this to know the exact entry-point argument types. |
| `preprod-v2.json` | **v2** deployment artifact: the NullPay-parity contract with real shielded token transfers. |

## Live contracts

### v1 — private payment-intent oracle

- Address: `0x304666ce3bb47edab2267a88eb650330042e1d6b1bea347d8f391b3fd09d719f`
- Network: Midnight **Preprod**
- Explorer: https://preprod.midnightexplorer.com/contracts/0x304666ce3bb47edab2267a88eb650330042e1d6b1bea347d8f391b3fd09d719f
- Indexer: `https://api-preprod.1am.xyz/api/v4/graphql` (WS: `/ws`)
- RPC: `wss://rpc.preprod.midnight.network`

### v2 — shielded token transfers (NullPay parity)

- Address: `0x85a0f911bb554bf4b7e9a69bb2ee2c20a03b823b20274eade45c6b18f53583a7`
- Block 2,521,381 · deploy tx `0x80bc77767f62fe711c8f1095a261f5a5296de665d2523850ab9afdf8e5982ad2`
- Explorer: https://preprod.midnightexplorer.com/contracts/0x85a0f911bb554bf4b7e9a69bb2ee2c20a03b823b20274eade45c6b18f53583a7
- Deployed with `npm --workspace cli run preprod-gateway2` (same sponsored gateway path).

## What v1 does / does not do

v1 is a **private payment-intent oracle**: merchants create intents, payers
prove knowledge of a 32-byte payment secret through a ZK circuit, and the
contract records the attestation. It **does not custody or move tokens**.
The NullPay-parity plan (real shielded token transfers, receipts) is in
[../docs/NULLPAY-V2-SPEC.md](../docs/NULLPAY-V2-SPEC.md).

## What v2 does

`veilpay2.compact` keeps the same privacy model and **actually moves value**:
`pay(intentId, coin)` consumes a payer shielded coin (zswap UTXO), sends the
intent price to the merchant's registered coin public key, returns change to
the payer, and stores a payer receipt commitment — all without revealing who
paid or which coin was spent. Intents pin a `tokenColor` (or zero = accept any
token, NullPay's `create_invoice_any` equivalent).

## Circuit entry points (from contract-info.json)

- `createIntent(amount: Uint<128>, expiresAt: Uint<64>) -> Uint<64>` (proof)
- `pay(intentId: Uint<64>)` (proof; witness: `paymentSecret(intentId)`)
- `refund(intentId: Uint<64>, refundAmount: Uint<128>)` (proof)
- `cancel(intentId: Uint<64>)` (proof)
- `isPaid(intentId: Uint<64>) -> Boolean` (proof)
- Public reads: `sequence` (Counter), `intents` (Map<Uint<64>, Intent>)

Full v2 schemas (including the `coin: QualifiedShieldedCoinInfo` argument and
`receipts` ledger) are in `preprod-v2.json`.

## Rebuilding the managed artifacts

The lightweight compiled artifacts are committed: the contract decoders
(`managed/<name>/contract/index.js|d.ts`), `contract-info.json`, verifier keys,
and bzkir/zkir files for both `veilpay` (v1) and `veilpay2` (v2). A clone can
read on-chain state and verify proofs with no build step.

Only the multi-MB `.prover` keys stay gitignored. Regenerate a full layout when
`*.compact` changes:

1. CI: push to `main`; the workflow compiles both contracts and uploads a
   `veilpay-managed` artifact containing `veilpay/` and `veilpay2/`. Unzip into
   `contract/src/managed/`.
2. Local: `cd contract && npm ci && npm run build` with the Midnight toolchain.

Website integration lives in [../docs/WEBSITE-INTEGRATION.md](../docs/WEBSITE-INTEGRATION.md);
the deploy runbook in [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).
