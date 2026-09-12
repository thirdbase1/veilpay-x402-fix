import {
  type CircuitContext,
  CostModel,
  QueryContext,
  sampleContractAddress,
  createConstructorContext,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger,
} from "../managed/veilpay2/contract/index.js";
import {
  type VeilPay2PrivateState,
  createVeilPay2PrivateState,
  withPaymentSecret2,
  witnesses2,
} from "../witnesses2.js";

/*
 * In-memory testbed for the v2 (token-moving) contract.
 *
 * Coins are consumed locally the way the official Midnight token-transfers
 * example tests do it: a ShieldedCoinInfo is constructed by hand and
 * "qualified" with an mt_index, which is sufficient for circuit execution
 * (Merkle proof checking happens at proof time on-chain, not in the
 * simulator). See docs/DEPLOYMENT.md and NULLPAY-V2-SPEC.md.
 */

export type EncodedCoinInfo = {
  nonce: Uint8Array;
  color: Uint8Array;
  value: bigint;
};

export type EncodedQualifiedCoin = EncodedCoinInfo & { mt_index: bigint };

export type EncodedSendResult = {
  sent: EncodedCoinInfo;
  change: { is_some: boolean; value?: EncodedCoinInfo };
};

export const qualifiedCoin = (
  value: bigint,
  color: Uint8Array,
  nonce: Uint8Array,
  mtIndex = 0n,
): EncodedQualifiedCoin => ({ nonce, color, value, mt_index: mtIndex });

export class VeilPay2Simulator {
  readonly contract: Contract<VeilPay2PrivateState>;
  circuitContext: CircuitContext<VeilPay2PrivateState>;

  constructor(privateState: VeilPay2PrivateState) {
    this.contract = new Contract<VeilPay2PrivateState>(witnesses2);
    const { currentPrivateState, currentContractState, currentZswapLocalState } =
      this.contract.initialState(
        createConstructorContext(privateState, "0".repeat(64)),
      );
    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(
        currentContractState.data,
        sampleContractAddress(),
      ),
    };
  }

  static deploy(
    merchantSecretKey: Uint8Array,
    receiptSecret: Uint8Array,
  ): VeilPay2Simulator {
    return new VeilPay2Simulator(
      createVeilPay2PrivateState(merchantSecretKey, receiptSecret),
    );
  }

  /** The zswap key that ownPublicKey() will see inside circuits (the payer). */
  setPayerCoinPublicKey(pk: Uint8Array): void {
    this.circuitContext.currentZswapLocalState = {
      ...this.circuitContext.currentZswapLocalState,
      coinPublicKey: { bytes: pk },
    };
  }

  getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  /** Outputs produced by circuit execution: [coin, recipient] per zswap output. */
  getZswapOutputs(): { coinInfo: EncodedCoinInfo; recipient: unknown }[] {
    return this.circuitContext.currentZswapLocalState
      .outputs as unknown as { coinInfo: EncodedCoinInfo; recipient: unknown }[];
  }

  setPrivateState(state: VeilPay2PrivateState): void {
    this.circuitContext.currentPrivateState = state;
  }

  createIntent(
    amount: bigint,
    expiresAt: bigint,
    tokenColor: Uint8Array,
    merchantCoinPk: Uint8Array,
    paymentSecret: Uint8Array,
  ): [Ledger, bigint] {
    const nextId = this.getLedger().sequence + 1n;
    this.circuitContext.currentPrivateState = withPaymentSecret2(
      this.circuitContext.currentPrivateState,
      nextId,
      paymentSecret,
    );
    const { context, result } = this.contract.impureCircuits.createIntent(
      this.circuitContext,
      amount,
      expiresAt,
      tokenColor,
      merchantCoinPk,
    );
    this.circuitContext = context;
    return [ledger(this.circuitContext.currentQueryContext.state), result as bigint];
  }

  /** Payer-side settle: needs the payment secret and the coin to spend. */
  pay(
    intentId: bigint,
    paymentSecret: Uint8Array,
    coin: EncodedQualifiedCoin,
    receiptSecret: Uint8Array,
    merchantSecretKey: Uint8Array,
  ): { ledger: Ledger; result: EncodedSendResult } {
    this.setPrivateState(
      withPaymentSecret2(
        createVeilPay2PrivateState(merchantSecretKey, receiptSecret),
        intentId,
        paymentSecret,
      ),
    );
    const { context, result } = this.contract.impureCircuits.pay(
      this.circuitContext,
      intentId,
      coin as never,
    );
    this.circuitContext = context;
    return {
      ledger: ledger(this.circuitContext.currentQueryContext.state),
      result: result as unknown as EncodedSendResult,
    };
  }

  refund(intentId: bigint, refundAmount: bigint): Ledger {
    this.circuitContext =
      this.contract.impureCircuits.refund(
        this.circuitContext,
        intentId,
        refundAmount,
      ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  cancel(intentId: bigint): Ledger {
    this.circuitContext =
      this.contract.impureCircuits.cancel(this.circuitContext, intentId).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }
}
