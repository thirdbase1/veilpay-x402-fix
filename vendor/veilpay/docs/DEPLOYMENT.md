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

Audited the 64 MB repo (zipball of `main`, commit `5c7f98e`). It is a
privacy-preserving parametric insurance dApp: three Compact contracts
(`policy.compact`, `settlement.compact`, `proofs.compact`), a Next.js frontend,
services, and a tiered deployer.

| Dimension | condition | VeilPay |
|---|---|---|
| Contracts | 3 contracts, ~13 circuits, capability secrets (ZK commitments gate every privileged transition) | 1 contract, 5 circuits, one secret commitment per intent |
| Managed artifacts | gitignored; `deploy/artifacts.json` pins verifier-key/zkir hashes from a real compactc 0.30.0 build (Android/Termux/proot) | committed via CI (0.31.1 artifact upload), locally downloaded |
| Deployer tiers | (1) preprod with funded seed + local proot proof server + dust snapshot bootstrap, (2) local real-runtime verification, (3) reference dry-run | single tier: sponsored gateway (no faucet, no sync, hosted proving) |
| Deployment evidence | **no `deploy/deployments.json` in the repo** -- tier 1 never recorded a successful on-chain run there | live contract + explorer link + tx/block, plus a live lifecycle tx (intent #1) |
| Dust sync workaround | caches a deployer dust-wallet snapshot (`deploy/dust-wallet-snapshot.json`, gitignored) to skip ~1.1M events | skips wallet sync entirely; gateway balances fees |
| Indexer | hardcodes preprod v3-era endpoints in deploy, v4 in frontend env | authenticated 1AM v4 indexer via local session-header relay |
| Auth model | capability secrets proven in-circuit (no caller identity in compactc 0.30) | same principle: `H(merchantSecretKey)` and `H(id, paymentSecret)` commitments |

Takeaways we could borrow later: condition's capability-secret gating is a
clean pattern if VeilPay ever needs multi-party authorization, and their
dust-snapshot bootstrap is a good fallback if we ever must run the vanilla
wallet path. Their repo documents the same compactc limitation we hit: no
caller identity or cross-contract calls, so authorization must be proven
in-circuit against commitments.
