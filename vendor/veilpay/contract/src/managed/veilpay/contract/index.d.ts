import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum IntentStatus { ACTIVE = 0, PAID = 1, REFUNDED = 2, CANCELLED = 3 }

export type Intent = { merchantId: Uint8Array;
                       amount: bigint;
                       expiresAt: bigint;
                       status: IntentStatus;
                       secretCommitment: Uint8Array;
                       paidAmount: bigint;
                       refundedAmount: bigint
                     };

export type Witnesses<PS> = {
  merchantSecretKey(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  paymentSecret(context: __compactRuntime.WitnessContext<Ledger, PS>,
                intentId_0: bigint): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  createIntent(context: __compactRuntime.CircuitContext<PS>,
               amount_0: bigint,
               expiresAt_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
  pay(context: __compactRuntime.CircuitContext<PS>, intentId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  refund(context: __compactRuntime.CircuitContext<PS>,
         intentId_0: bigint,
         refundAmount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  cancel(context: __compactRuntime.CircuitContext<PS>, intentId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  isPaid(context: __compactRuntime.CircuitContext<PS>, intentId_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
}

export type ProvableCircuits<PS> = {
  createIntent(context: __compactRuntime.CircuitContext<PS>,
               amount_0: bigint,
               expiresAt_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
  pay(context: __compactRuntime.CircuitContext<PS>, intentId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  refund(context: __compactRuntime.CircuitContext<PS>,
         intentId_0: bigint,
         refundAmount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  cancel(context: __compactRuntime.CircuitContext<PS>, intentId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  isPaid(context: __compactRuntime.CircuitContext<PS>, intentId_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
}

export type PureCircuits = {
  merchantIdentityOf(sk_0: Uint8Array): Uint8Array;
  commitment(intentId_0: bigint, secret_0: Uint8Array): Uint8Array;
}

export type Circuits<PS> = {
  merchantIdentityOf(context: __compactRuntime.CircuitContext<PS>,
                     sk_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  commitment(context: __compactRuntime.CircuitContext<PS>,
             intentId_0: bigint,
             secret_0: Uint8Array): __compactRuntime.CircuitResults<PS, Uint8Array>;
  createIntent(context: __compactRuntime.CircuitContext<PS>,
               amount_0: bigint,
               expiresAt_0: bigint): __compactRuntime.CircuitResults<PS, bigint>;
  pay(context: __compactRuntime.CircuitContext<PS>, intentId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  refund(context: __compactRuntime.CircuitContext<PS>,
         intentId_0: bigint,
         refundAmount_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  cancel(context: __compactRuntime.CircuitContext<PS>, intentId_0: bigint): __compactRuntime.CircuitResults<PS, []>;
  isPaid(context: __compactRuntime.CircuitContext<PS>, intentId_0: bigint): __compactRuntime.CircuitResults<PS, boolean>;
}

export type Ledger = {
  readonly sequence: bigint;
  intents: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): Intent;
    [Symbol.iterator](): Iterator<[bigint, Intent]>
  };
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): __compactRuntime.ConstructorResult<PS>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
