# Deployment Runbook

How the live VeilPay contract reached Midnight Preprod, what every tool was
for, and how this deploy compares with zarkbns/condition.

## Result

```
contract  0x304666ce3bb47edab2267a88eb650330042e1d6b1bea347d8f391b3fd09d719f
deploy tx 0x1efb51c863ac454b6aa8dfed4f57e486a19842bb7957f7239d00988d6337efe5
block     2,508,900  (Sep 11, 2026, 22:33 UTC)
explorer  https://preprod.midnightexplorer.com/contracts/0x3046...
```

## The Problem With The Official Path

The vanilla SDK deploy needs three things that were all broken or hostile from
this environment:

1. **Faucet.** POSTs a Cloudflare Turnstile token and returns "OK" while
   minting nothing. We verified the unshielded address stayed empty.
2. **Shielded sync.** The wallet SDK replays the entire zswap history; on
   preprod that stalls in `Wallet.Sync` before any deploy.
3. **Local proof server + RPC node.** Requires Docker and a reachable
   `wss://rpc.preprod.midnight.network`, whose websocket kept closing.

## The Sponsored Gateway Path

The 1AM gateway (`https://api-preprod.1am.xyz`) replaces all three. Session
auth is a BIP-340 Schnorr signature over a challenge with the NightExternal key
derived from our own seed, so the deployed contract belongs to our identity.

| Step | Endpoint | Notes |
|---|---|---|
| Auth | `/auth/challenge` + `/auth/verify` | cached in `cli/.veilpay-state/gw_session.json` |
| Prove | `/check` + `/prove` | wire-compatible with `httpClientProofProvider` |
| Balance | `/balance-only` | posts the proven tx bytes, gets a finalized tx + its Midnight tx hash; sponsors the dust fee |
| Submit | `/rpc/midnight` (`author_submitExtrinsic`) | polkadot-js `HttpProvider` has no subs, so the extrinsic is encoded and POSTed |
| Read | `/api/v4/graphql` (+ `/ws`) | authenticated indexer; a localhost relay injects the session header for the SDK |

## The Inclusion-Watch Bug And Fix

The SDK's `deployContract` awaits `publicDataProvider.watchForTxData(txId)`.
Its query polls `transactions(offset: { identifier })`, but our submit returns
the *extrinsic* hash -- the indexer's real identifiers are neither that hash
nor the Midnight tx hash. Result: the poll matched nothing and deploy hung
forever even though the contract was on-chain.

Verified live against the indexer:

```
identifier = 0x1efb51c8... (midnight hash) -> transactions: []
identifier = 0x32cd04cc... (extrinsic)     -> transactions: []
offset { hash: 0x1efb51c8... }             -> status SUCCESS, 2 identifiers
```

Fix: `cli/src/gateway-stack.ts` wraps the indexer provider and replaces both
watches with HTTP polling keyed by the tx *hash* the gateway reported from
`/balance-only` (`watchForTxData`) and by `contractAction(address)`
(`watchForDeployTxData`). Same fix makes every later circuit call resolve.

## Every Tool Used

| Tool | Role |
|---|---|
| Node 24.21 (bundled runtime) | all scripting and CLI execution |
| `@midnight-ntwrk/*` SDK 4.1.1 | contracts, proving provider, indexer provider, network-id |
| `@midnight-ntwrk/wallet-sdk-hd` | key derivation from seed (no wallet sync) |
| `@polkadot/api` | encode `midnight.sendMnTransaction` extrinsics |
| `@noble/curves` + `@noble/hashes` | BIP-340 Schnorr gateway auth |
| compactc 0.31.1 via CI action | compiled `contract/src/managed/veilpay` |
| vitest | 10 contract lifecycle tests (simulated ledger) |
| GitHub Actions | compile + typecheck + test + build + artifact upload |

Commands used, in order:

```bash
npm ci                                   # workspace install
npm --workspace contract run test        # 10/10 pass
npm --workspace cli run preprod-gateway  # gateway deploy (writes contract-address)
npm --workspace cli run preprod-tx -- status
npm --workspace cli run preprod-tx -- create 2500 50   # live: intent #1
npx tsc -p cli/tsconfig.json --noEmit    # typecheck after the polling fix
```

Note: two contracts exist on-chain from two deploy runs (`9747c13e...` at block
2,508,543 and `304666ce...` at block 2,508,900). `304666ce...` is canonical;
the first was the pre-fix deployment recorded before the watch fix landed.

## Comparison: zarkbns/condition

Audited the repo after full extraction (zipball of `main`, commit `5c7f98e`,
~60 MB, mostly compiled key/zkir artifacts). It is a privacy-preserving
parametric insurance dApp: three Compact contracts (`policy.compact`,
`settlement.compact`, `proofs.compact`), a pages-router Next.js frontend, a TS
reference runtime, and a three-tier deployer.

| Dimension | condition | VeilPay |
|---|---|---|
| Contracts | 3 contracts (policy / settlement / proofs), ~15 named circuits, capability secrets gate every privileged transition | v2: 1 contract, 5 circuits, one secret commitment per intent |
| Real value movement | **none** — no zswap/shielded-token usage anywhere in its `.compact` sources; settlement escrow is ledger bookkeeping + public receipts | v2 consumes a payer shielded coin and sends real token value to the merchant coin key via zswap (NullPay parity) |
| Compiled artifacts | contract modules (`index.js`/`d.ts`) committed under `contracts/managed-compact/`; browser key/zkir copies committed under `frontend/public/contracts/`; heavy local layout gitignored; `deploy/artifacts.json` pins verifier-key/zkir hashes from compactc 0.30.0 (built on Android/Termux via proot) | decoders, verifier keys, and bzkir/zkir committed under `contract/src/managed/` (only multi-MB `.prover` keys ignored, regenerable from the CI `veilpay-managed` artifact); `deployments/preprod-v2.json` pins the live address + circuit metadata |
| Deploy path | tiered: (1) preprod via wallet-sdk-facade with funded seed + **local proof server** + dust-wallet snapshot bootstrap to skip ~1.1M tree events, (2) local real-`compact-runtime` verification, (3) TS reference dry-run | single path: sponsored gateway — hosted `/check` + `/prove`, gateway-funded DUST balancing, `author_submitExtrinsic`; no faucet, no wallet sync |
| On-chain evidence | `docs/DEPLOYMENTS.md`: full lifecycle 2026-09-05, blocks 2421479–2421557, 8 txs (2 deploys + create/fund/enroll/trigger/link/settle), all `SUCCESS`, with curl re-verify commands | two live contracts; v2 at `0x85a0f911…` block 2521381 with intent #1 ACTIVE, verified by direct `queryContractState` read (`scripts/verify-v2-live.mjs`) |
| Indexer | official `indexer.preprod.midnight.network` v3 endpoints (their notes: `contractAction(address)` can return null for recent contracts) | authenticated 1AM v4 indexer through a local session-header relay; same address-lookup flakiness observed, worked around by hash-polling + direct state reads |
| Toolchain constraint | same compactc finding we hit: no caller identity or cross-contract calls, so authorization is proven in-circuit against commitments | same: `H(merchantSecretKey)` / `H(id, paymentSecret)` commitments |

Where we are ahead: VeilPay v2 actually moves shielded token value on-chain,
which condition's contracts do not attempt. Where they are ahead: committed
browser-served key/zkir artifacts (so their public `/verify` decodes real
on-chain state with zero setup), a mature two-source oracle trigger pattern,
and the dust-snapshot bootstrap — a good fallback if we ever must run the
vanilla funded-wallet path instead of the gateway.
