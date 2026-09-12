/**
 * VeilPay common types and abstractions.
 *
 * @module
 */

import { type MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { type FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { VeilPay } from '../../contract/src/index';
import type { VeilPayPrivateState } from '../../contract/src/witnesses';
import type { VeilPay2 } from '../../contract/src/index';
import type { VeilPay2PrivateState } from '../../contract/src/witnesses2';

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

// ─── v2 (shielded token transfers) ────────────────────────────────

export const veilPay2PrivateStateKey = 'veilPay2PrivateState';
export type PrivateStateId2 = typeof veilPay2PrivateStateKey;

export type PrivateStates2 = {
  readonly veilPay2PrivateState: VeilPay2PrivateState;
};

export type VeilPay2Contract = VeilPay2.Contract<VeilPay2PrivateState>;

export type VeilPay2CircuitKeys = Exclude<keyof VeilPay2Contract['impureCircuits'], number | symbol>;

export type VeilPay2Providers = MidnightProviders<VeilPay2CircuitKeys, PrivateStateId2, VeilPay2PrivateState>;

export type DeployedVeilPay2Contract = FoundContract<VeilPay2Contract>;

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

/** Public view of a v2 intent, including token routing metadata. */
export type Intent2View = {
  readonly id: bigint;
  readonly merchantId: string;
  readonly merchantCoinPk: string;
  readonly tokenColor: string;
  readonly amount: bigint;
  readonly expiresAt: bigint;
  readonly status: VeilPay2.IntentStatus;
  readonly paidAmount: bigint;
  readonly refundedAmount: bigint;
  readonly hasReceipt: boolean;
  readonly isMine: boolean;
};
