import { Ledger } from "./managed/veilpay/contract/index.js";
import { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

/*
 * Private state for a VeilPay participant.
 *
 * - merchantSecretKey identifies the merchant pseudonymously; its hash is
 *   the only merchant value that ever lands on the public ledger.
 * - paymentSecrets maps intent id -> payment secret. A merchant holds the
 *   secret when creating the intent (to embed its commitment); the secret
 *   then travels to the customer out-of-band (the checkout link). Paying
 *   proves knowledge of it without revealing who paid.
 */

export type VeilPayPrivateState = {
  readonly merchantSecretKey: Uint8Array;
  readonly paymentSecrets: Readonly<Record<string, Uint8Array>>;
};

export const createVeilPayPrivateState = (
  merchantSecretKey: Uint8Array,
  paymentSecrets: Record<string, Uint8Array> = {},
): VeilPayPrivateState => ({ merchantSecretKey, paymentSecrets });

export const withPaymentSecret = (
  state: VeilPayPrivateState,
  intentId: bigint,
  secret: Uint8Array,
): VeilPayPrivateState => ({
  merchantSecretKey: state.merchantSecretKey,
  paymentSecrets: { ...state.paymentSecrets, [intentId.toString()]: secret },
});

export const witnesses = {
  merchantSecretKey: ({
    privateState,
  }: WitnessContext<Ledger, VeilPayPrivateState>): [
    VeilPayPrivateState,
    Uint8Array,
  ] => [privateState, privateState.merchantSecretKey],

  paymentSecret: (
    { privateState }: WitnessContext<Ledger, VeilPayPrivateState>,
    intentId: bigint,
  ): [VeilPayPrivateState, Uint8Array] => {
    const secret = privateState.paymentSecrets[intentId.toString()];
    if (secret === undefined) {
      throw new Error(`No payment secret known for intent ${intentId}`);
    }
    return [privateState, secret];
  },
};
