# VeilPay

Privacy-preserving payment intents on Midnight Preprod. A merchant publishes a
checkout request on-chain; a customer settles it by proving knowledge of a
payment secret inside a ZK circuit. The public ledger records **that** a
payment is verified and its amount -- never who paid.

## Live Deployment

| Field | Value |
|---|---|
| Network | Midnight Preprod |
| Contract | `0x304666ce3bb47edab2267a88eb650330042e1d6b1bea347d8f391b3fd09d719f` |
| Deploy tx | `0x1efb51c863ac454b6aa8dfed4f57e486a19842bb7957f7239d00988d6337efe5` |
| Block | 2,508,900 (Sep 11, 2026, 22:33 UTC) |
| Explorer | [preprod.midnightexplorer.com](https://preprod.midnightexplorer.com/contracts/0x304666ce3bb47edab2267a88eb650330042e1d6b1bea347d8f391b3fd09d719f) |

Intent #1 (amount 2500) was created live on this contract via
`npm --workspace cli run preprod-tx -- create 2500 50`.

## Repo Layout

```
contract/   veilpay.compact + compiled managed artifacts + 10 vitest tests
api/        VeilPayAPI: deploy/join contract, createIntent/pay/refund/cancel
cli/        faucet-path CLI + sponsored-gateway deploy & lifecycle drivers
scripts/    verify-live.mjs (read-only live ledger check)
 docs/       V1-VS-V2.md (start here), WEBSITE-INTEGRATION.md, DEPLOYMENT.md
```

## Quickstart

```bash
npm install
npm --workspace contract run test          # 10 tests, simulated ledger

# read the live contract (needs a cached gateway session in cli/.veilpay-state)
node --experimental-specifier-resolution=node scripts/verify-live.mjs

# lifecycle against the deployed contract
npm --workspace cli run preprod-tx -- status
npm --workspace cli run preprod-tx -- create <amount> [ttlOps]
npm --workspace cli run preprod-tx -- pay <id> <secretHex>
```

## Docs

- [docs/V1-VS-V2.md](docs/V1-VS-V2.md) -- what v1 and v2 each are, why v2
  exists (NullPay parity: real shielded token transfers), and which one to
  integrate against.
- [docs/WEBSITE-INTEGRATION.md](docs/WEBSITE-INTEGRATION.md) -- build a website
  on the deployed contract: architecture, provider singleton, API-route
  recipes, lifecycle semantics, gotchas.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) -- how this contract got to preprod
  through the sponsored gateway, every tool used, and how the deploy compares
  with zarkbns/condition.

## License

Apache-2.0
