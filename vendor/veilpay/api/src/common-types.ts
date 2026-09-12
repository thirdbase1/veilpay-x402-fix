/**
 * VeilPay common types and abstractions.
 *
 * @module
 */

import { type MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { type FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { VeilPay } from '../../contract/src/index.js';
import type { VeilPayPrivateState } from '../../contract/src/witnesses.js';

export const veilPayPrivateStateKey = 'veilPayPrivateState';
export type PrivateStateId = typeof veilPayPrivateStateKey;

export type PrivateStates = {
  readonly veilPayPrivateState: VeilPayPrivateState;
};

export type VeilPayContract = VeilPay.Contract<VeilPayPrivateState>;

/** Names of the impure (proven) circuits, used to type providers. */
export type VeilPayCircuitKeys = Exclude<keyof VeilPayContract['impureCircuits'], number | symbol>;

export type VeilPayProviders = MidnightProviders<VeilPayCircuitKeys, PrivateStateId, VeilPayPrivateState>;

export type DeployedVeilPayContract = FoundContract<VeilPayContract>;

/** Public view of a payment intent, for UIs and receipts. */
export type IntentView = {
  readonly id: bigint;
  readonly merchantId: string;
  readonly amount: bigint;
  readonly expiresAt: bigint;
  readonly status: VeilPay.IntentStatus;
  readonly paidAmount: bigint;
  readonly refundedAmount: bigint;
  readonly isMine: boolean;
};
