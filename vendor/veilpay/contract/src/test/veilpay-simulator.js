import { CostModel, QueryContext, sampleContractAddress, createConstructorContext, } from "@midnight-ntwrk/compact-runtime";
import { Contract, ledger } from "../managed/veilpay/contract/index.js";
import { createVeilPayPrivateState, withPaymentSecret, witnesses, } from "../witnesses.js";
/**
 * In-memory testbed for exercising the VeilPay contract locally (no chain,
 * no proof server). The returned `id`/ledger values mirror what a deployed
 * contract's callTx results would expose.
 */
export class VeilPaySimulator {
    contract;
    circuitContext;
    constructor(merchantSecretKey) {
        this.contract = new Contract(witnesses);
        const { currentPrivateState, currentContractState, currentZswapLocalState } = this.contract.initialState(createConstructorContext(createVeilPayPrivateState(merchantSecretKey), "0".repeat(64)));
        this.circuitContext = {
            currentPrivateState,
            currentZswapLocalState,
            costModel: CostModel.initialCostModel(),
            currentQueryContext: new QueryContext(currentContractState.data, sampleContractAddress()),
        };
    }
    getLedger() {
        return ledger(this.circuitContext.currentQueryContext.state);
    }
    getPrivateState() {
        return this.circuitContext.currentPrivateState;
    }
    /** Replace private state (e.g. switch from merchant to payer). */
    setPrivateState(state) {
        this.circuitContext.currentPrivateState = state;
    }
    /**
     * Merchant creates an intent; returns [newLedger, intentId].
     *
     * The circuit embeds commitment(id, paymentSecret(id)) at creation, so the
     * payment secret must be in private state under the *predicted* id before
     * we execute. The id is deterministic: createIntent increments sequence by
     * one, so nextId === current sequence + 1n.
     */
    createIntent(amount, expiresAt, paymentSecret) {
        const nextId = this.getLedger().sequence + 1n;
        this.circuitContext.currentPrivateState = withPaymentSecret(this.circuitContext.currentPrivateState, nextId, paymentSecret);
        const { context, result } = this.contract.impureCircuits.createIntent(this.circuitContext, amount, expiresAt);
        this.circuitContext = context;
        return [ledger(this.circuitContext.currentQueryContext.state), result];
    }
    pay(intentId, paymentSecret) {
        const payerState = createVeilPayPrivateState(this.circuitContext.currentPrivateState.merchantSecretKey, { [intentId.toString()]: paymentSecret });
        this.circuitContext.currentPrivateState = payerState;
        this.circuitContext =
            this.contract.impureCircuits.pay(this.circuitContext, intentId).context;
        return ledger(this.circuitContext.currentQueryContext.state);
    }
    refund(intentId, refundAmount) {
        this.circuitContext =
            this.contract.impureCircuits.refund(this.circuitContext, intentId, refundAmount).context;
        return ledger(this.circuitContext.currentQueryContext.state);
    }
    cancel(intentId) {
        this.circuitContext =
            this.contract.impureCircuits.cancel(this.circuitContext, intentId).context;
        return ledger(this.circuitContext.currentQueryContext.state);
    }
    isPaid(intentId) {
        // isPaid reads ledger but never writes; depending on compiler version it
        // lands in `circuits` or `pureCircuits`, so look it up defensively.
        const c = this.contract;
        const fn = c.circuits?.isPaid ?? c.pureCircuits?.isPaid;
        return fn(this.circuitContext, intentId).result;
    }
}
//# sourceMappingURL=veilpay-simulator.js.map