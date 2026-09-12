/**
 * VeilPay API: deploy/join a payment-intent contract and drive it.
 *
 * @packageDocumentation
 */

import * as VeilPay from '../../contract/src/managed/veilpay/contract/index.js';

import { type ContractAddress, convertFieldToBytes } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { type Logger } from 'pino';
import {
  type VeilPayContract,
  type VeilPayProviders,
  type DeployedVeilPayContract,
  type PrivateStateId,
  type IntentView,
  veilPayPrivateStateKey,
} from './common-types.js';
import { CompiledVeilPayContractContract } from '../../contract/src/index.js';
import * as utils from './utils/index.js';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { combineLatest, map, tap, from, type Observable } from 'rxjs';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { type VeilPayPrivateState, createVeilPayPrivateState, withPaymentSecret } from '../../contract/src/witnesses.js';

export * from './common-types.js';

/** Snapshot of every intent currently in the public ledger. */
export type LedgerSnapshot = {
  sequence: bigint;
  intents: IntentView[];
};

/**
 * An API for a deployed VeilPay contract.
 *
 * @remarks
 * Private state holds the merchant secret key plus any payment secrets the
 * local participant knows (merchants learn them when they create intents;
 * customers receive them out-of-band through checkout links).
 */
export class VeilPayAPI {
  private constructor(
    public readonly deployedContract: DeployedVeilPayContract,
    private readonly providers: VeilPayProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    providers.privateStateProvider.setContractAddress(this.deployedContractAddress);
    this.state$ = combineLatest(
      [
        providers.publicDataProvider.contractStateObservable(this.deployedContractAddress, { type: 'latest' }).pipe(
          map((contractState) => VeilPay.ledger(contractState.data)),
          tap((ledgerState) => logger?.trace({ ledgerSequence: ledgerState.sequence.toString() })),
        ),
        from(providers.privateStateProvider.get(veilPayPrivateStateKey) as Promise<VeilPayPrivateState>),
      ],
      (ledgerState, privateState) =>
        // The generated Ledger exposes the map handle; enumerate ids 1..sequence
        // (ids are dense because `sequence` doubles as the id source).
        Array.from({ length: Number(ledgerState.sequence) }, (_, i) => {
          const id = BigInt(i + 1);
          const intent = ledgerState.intents.lookup(id);
          return {
            id,
            merchantId: toHex(intent.merchantId),
            amount: intent.amount,
            expiresAt: intent.expiresAt,
            status: intent.status,
            paidAmount: intent.paidAmount,
            refundedAmount: intent.refundedAmount,
            isMine: toHex(intent.merchantId) === this.merchantIdentityHex(privateState),
          };
        }),
    );
  }

  private merchantIdentityHex(privateState: VeilPayPrivateState): string {
    return toHex(
      VeilPay.pureCircuits.merchantIdentityOf(privateState.merchantSecretKey),
    );
  }

  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<LedgerSnapshot['intents']>;

  /** Merchant creates a payment intent; returns the new id. */
  async createIntent(amount: bigint, expiresAt: bigint, paymentSecret: Uint8Array): Promise<bigint> {
    this.logger?.info(`creating intent for amount ${amount}`);
    // Pre-seed the predicted id so the paymentSecret witness resolves during
    // the proven call. Ids are dense: next id === current sequence + 1.
    const providers = this.providers;
    const privateState = (await providers.privateStateProvider.get(veilPayPrivateStateKey))!;
    const contractState = await providers.publicDataProvider.queryContractState(this.deployedContractAddress);
    const sequence = contractState ? VeilPay.ledger(contractState.data).sequence : 0n;
    await providers.privateStateProvider.set(
      veilPayPrivateStateKey,
      withPaymentSecret(privateState, sequence + 1n, paymentSecret),
    );

    const txData = await this.deployedContract.callTx.createIntent(amount, expiresAt);
    // Circuit results live on `txData.private` (`public` only carries state/transcript).
    const id = txData.private.result;
    this.logger?.info(`intent created with id ${id}`);
    return id;
  }

  /** Customer settles an intent. Requires knowledge of its payment secret. */
  async pay(intentId: bigint, paymentSecret: Uint8Array): Promise<void> {
    this.logger?.info(`paying intent ${intentId}`);
    const providers = this.providers;
    const privateState = (await providers.privateStateProvider.get(veilPayPrivateStateKey))!;
    await providers.privateStateProvider.set(
      veilPayPrivateStateKey,
      withPaymentSecret(privateState, intentId, paymentSecret),
    );
    await this.deployedContract.callTx.pay(intentId);
  }

  /** Merchant refunds a paid intent (partial refunds not yet modeled). */
  async refund(intentId: bigint, refundAmount: bigint): Promise<void> {
    this.logger?.info(`refunding intent ${intentId}`);
    await this.deployedContract.callTx.refund(intentId, refundAmount);
  }

  /** Merchant cancels an unpaid intent. */
  async cancel(intentId: bigint): Promise<void> {
    this.logger?.info(`cancelling intent ${intentId}`);
    await this.deployedContract.callTx.cancel(intentId);
  }

  /** Public verification: was this intent settled? Reads ledger via indexer. */
  async isPaid(intentId: bigint): Promise<boolean> {
    const contractState = await this.providers.publicDataProvider.queryContractState(
      this.deployedContractAddress,
    );
    if (!contractState) return false;
    const l = VeilPay.ledger(contractState.data);
    if (!l.intents.member(intentId)) return false;
    const status = l.intents.lookup(intentId).status;
    return status === VeilPay.IntentStatus.PAID || status === VeilPay.IntentStatus.REFUNDED;
  }

  /** Deploy a fresh VeilPay contract. */
  static async deploy(providers: VeilPayProviders, logger?: Logger): Promise<VeilPayAPI> {
    logger?.info('deployContract');
    const deployed = await deployContract(providers, {
      compiledContract: CompiledVeilPayContractContract,
      privateStateId: veilPayPrivateStateKey,
      initialPrivateState: createVeilPayPrivateState(utils.randomBytes(32)),
    });
    return new VeilPayAPI(deployed, providers, logger);
  }

  /** Join an already-deployed VeilPay contract by address. */
  static async join(providers: VeilPayProviders, contractAddress: ContractAddress, logger?: Logger): Promise<VeilPayAPI> {
    logger?.info({ joinContract: { contractAddress } });
    const deployed = await findDeployedContract<VeilPayContract>(providers, {
      contractAddress,
      compiledContract: CompiledVeilPayContractContract,
      privateStateId: veilPayPrivateStateKey,
      initialPrivateState: await VeilPayAPI.getPrivateState(providers, contractAddress),
    });
    return new VeilPayAPI(deployed, providers, logger);
  }

  private static async getPrivateState(
    providers: VeilPayProviders,
    contractAddress: ContractAddress,
  ): Promise<VeilPayPrivateState> {
    providers.privateStateProvider.setContractAddress(contractAddress);
    const existing = await providers.privateStateProvider.get(veilPayPrivateStateKey);
    return existing ?? createVeilPayPrivateState(utils.randomBytes(32));
  }
}
