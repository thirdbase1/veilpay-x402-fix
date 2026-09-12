/**
 * VeilPay v2 API: private payment intents backed by REAL shielded token
 * transfers (NullPay parity). v1 (index.ts) stays as the oracle-only
 * generation; see docs/NULLPAY-V2-SPEC.md for the design.
 *
 * @packageDocumentation
 */

import * as VeilPay2 from '../../contract/src/managed/veilpay2/contract/index.js';

import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { type Logger } from 'pino';
import {
  type VeilPay2Contract,
  type VeilPay2Providers,
  type DeployedVeilPay2Contract,
  type Intent2View,
  veilPay2PrivateStateKey,
} from './common-types.js';
import { CompiledVeilPay2ContractContract } from '../../contract/src/index';
import * as utils from './utils/index.js';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { combineLatest, map, tap, from, type Observable } from 'rxjs';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import {
  type VeilPay2PrivateState,
  createVeilPay2PrivateState,
  withPaymentSecret2,
} from '../../contract/src/witnesses2.js';

/** A shielded coin ready to be spent in `pay` (zswap UTXO). */
export type SpendableCoin = {
  readonly nonce: Uint8Array;
  readonly color: Uint8Array;
  readonly value: bigint;
  readonly mtIndex: bigint;
};

const toQualified = (coin: SpendableCoin) => ({
  nonce: coin.nonce,
  color: coin.color,
  value: coin.value,
  mt_index: coin.mtIndex,
});

/**
 * An API for a deployed VeilPay v2 contract.
 *
 * @remarks
 * Private state adds a long-lived `receiptSecret` (payer receipts) on top of
 * v1's merchant key + payment secrets. `pay` consumes a caller-supplied
 * shielded coin; obtaining and proving possession of coins is the wallet's
 * job (see docs/NULLPAY-V2-SPEC.md, Phase 2).
 */
export class VeilPay2API {
  private constructor(
    public readonly deployedContract: DeployedVeilPay2Contract,
    private readonly providers: VeilPay2Providers,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    providers.privateStateProvider.setContractAddress(this.deployedContractAddress);
    this.state$ = combineLatest(
      [
        providers.publicDataProvider.contractStateObservable(this.deployedContractAddress, { type: 'latest' }).pipe(
          map((contractState) => VeilPay2.ledger(contractState.data)),
          tap((ledgerState) => logger?.trace({ ledgerSequence: ledgerState.sequence.toString() })),
        ),
        from(providers.privateStateProvider.get(veilPay2PrivateStateKey) as Promise<VeilPay2PrivateState>),
      ],
      (l, privateState) =>
        Array.from({ length: Number(l.sequence) }, (_, i) => {
          const id = BigInt(i + 1);
          const intent = l.intents.lookup(id);
          return {
            id,
            merchantId: toHex(intent.merchantId),
            merchantCoinPk: toHex(intent.merchantCoinPk),
            tokenColor: toHex(intent.tokenColor),
            amount: intent.amount,
            expiresAt: intent.expiresAt,
            status: intent.status,
            paidAmount: intent.paidAmount,
            refundedAmount: intent.refundedAmount,
            hasReceipt: l.receipts.member(id),
            isMine: toHex(intent.merchantId) === this.merchantIdentityHex(privateState),
          };
        }),
    );
  }

  private merchantIdentityHex(privateState: VeilPay2PrivateState): string {
    return toHex(
      VeilPay2.pureCircuits.merchantIdentityOf(privateState.merchantSecretKey),
    );
  }

  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<Intent2View[]>;

  /** Merchant creates a priced intent; `tokenColor` zero bytes = open intent. */
  async createIntent(
    amount: bigint,
    expiresAt: bigint,
    tokenColor: Uint8Array,
    merchantCoinPk: Uint8Array,
    paymentSecret: Uint8Array,
  ): Promise<bigint> {
    this.logger?.info(`creating v2 intent for amount ${amount}`);
    const providers = this.providers;
    const privateState = (await providers.privateStateProvider.get(veilPay2PrivateStateKey))!;
    const contractState = await providers.publicDataProvider.queryContractState(this.deployedContractAddress);
    const sequence = contractState ? VeilPay2.ledger(contractState.data).sequence : 0n;
    await providers.privateStateProvider.set(
      veilPay2PrivateStateKey,
      withPaymentSecret2(privateState, sequence + 1n, paymentSecret),
    );

    const txData = await this.deployedContract.callTx.createIntent(
      amount,
      expiresAt,
      tokenColor,
      merchantCoinPk,
    );
    const id = txData.private.result;
    this.logger?.info(`v2 intent created with id ${id}`);
    return id;
  }

  /** Customer settles the intent AND moves real shielded value on-chain. */
  async pay(intentId: bigint, paymentSecret: Uint8Array, coin: SpendableCoin): Promise<void> {
    this.logger?.info(`paying v2 intent ${intentId} with coin worth ${coin.value}`);
    const providers = this.providers;
    const privateState = (await providers.privateStateProvider.get(veilPay2PrivateStateKey))!;
    await providers.privateStateProvider.set(
      veilPay2PrivateStateKey,
      withPaymentSecret2(privateState, intentId, paymentSecret),
    );
    await this.deployedContract.callTx.pay(intentId, toQualified(coin));
  }

  /** Merchant records a refund against a paid intent. */
  async refund(intentId: bigint, refundAmount: bigint): Promise<void> {
    this.logger?.info(`refunding v2 intent ${intentId}`);
    await this.deployedContract.callTx.refund(intentId, refundAmount);
  }

  /** Merchant cancels an unpaid intent. */
  async cancel(intentId: bigint): Promise<void> {
    this.logger?.info(`cancelling v2 intent ${intentId}`);
    await this.deployedContract.callTx.cancel(intentId);
  }

  /** Public verification: was this intent settled? */
  async isPaid(intentId: bigint): Promise<boolean> {
    const contractState = await this.providers.publicDataProvider.queryContractState(
      this.deployedContractAddress,
    );
    if (!contractState) return false;
    const l = VeilPay2.ledger(contractState.data);
    if (!l.intents.member(intentId)) return false;
    const status = l.intents.lookup(intentId).status;
    return status === VeilPay2.IntentStatus.PAID || status === VeilPay2.IntentStatus.REFUNDED;
  }

  /** Deploy a fresh v2 contract. */
  static async deploy(providers: VeilPay2Providers, logger?: Logger): Promise<VeilPay2API> {
    logger?.info('deployContract v2');
    const deployed = await deployContract(providers, {
      compiledContract: CompiledVeilPay2ContractContract,
      privateStateId: veilPay2PrivateStateKey,
      initialPrivateState: createVeilPay2PrivateState(utils.randomBytes(32), utils.randomBytes(32)),
    });
    return new VeilPay2API(deployed, providers, logger);
  }

  /** Join an already-deployed v2 contract by address. */
  static async join(
    providers: VeilPay2Providers,
    contractAddress: ContractAddress,
    logger?: Logger,
  ): Promise<VeilPay2API> {
    logger?.info({ joinContract: { contractAddress } });
    const deployed = await findDeployedContract<VeilPay2Contract>(providers, {
      contractAddress,
      compiledContract: CompiledVeilPay2ContractContract,
      privateStateId: veilPay2PrivateStateKey,
      initialPrivateState: await VeilPay2API.getPrivateState(providers, contractAddress),
    });
    return new VeilPay2API(deployed, providers, logger);
  }

  private static async getPrivateState(
    providers: VeilPay2Providers,
    contractAddress: ContractAddress,
  ): Promise<VeilPay2PrivateState> {
    providers.privateStateProvider.setContractAddress(contractAddress);
    const existing = await providers.privateStateProvider.get(veilPay2PrivateStateKey);
    return existing ?? createVeilPay2PrivateState(utils.randomBytes(32), utils.randomBytes(32));
  }
}
