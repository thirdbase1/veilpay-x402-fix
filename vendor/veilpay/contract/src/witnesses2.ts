import { Ledger } from "./managed/veilpay2/contract/index.js";
import { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

/*
 * Private state for a VeilPay v2 participant. Extends v1 with a long-lived
 * receiptSecret: the payer commits H(id || amount || receiptSecret) on-chain
 * at pay time, giving them a private, non-linkable proof of purchase.
 */

export type VeilPay2PrivateState = {
  readonly merchantSecretKey: Uint8Array;
  readonly paymentSecrets: Readonly<Record<string, Uint8Array>>;
  readonly receiptSecret: Uint8Array;
};

export const createVeilPay2PrivateState = (
  merchantSecretKey: Uint8Array,
  receiptSecret: Uint8Array,
  paymentSecrets: Record<string, Uint8Array> = {},
): VeilPay2PrivateState => ({ merchantSecretKey, paymentSecrets, receiptSecret });

export const withPaymentSecret2 = (
  state: VeilPay2PrivateState,
  intentId: bigint,
  secret: Uint8Array,
): VeilPay2PrivateState => ({
  merchantSecretKey: state.merchantSecretKey,
  receiptSecret: state.receiptSecret,
  paymentSecrets: { ...state.paymentSecrets, [intentId.toString()]: secret },
});

export const witnesses2 = {
  merchantSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, VeilPay2PrivateState>): [
    VeilPay2PrivateState,
    Uint8Array,
  ] => [privateState, privateState.merchantSecretKey],

  paymentSecret: (
    { privateState }: WitnessContext<Ledger, VeilPay2PrivateState>,
    intentId: bigint,
  ): [VeilPay2PrivateState, Uint8Array] => {
    const secret = privateState.paymentSecrets[intentId.toString()];
    if (secret === undefined) {
      throw new Error(`No payment secret known for intent ${intentId}`);
    }
    return [privateState, secret];
  },

  receiptSecret: ({
    privateState,
  }: WitnessContext<Ledger, VeilPay2PrivateState>): [
    VeilPay2PrivateState,
    Uint8Array,
  ] => [privateState, privateState.receiptSecret],
};
