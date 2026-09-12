import { VeilPaySimulator } from "./veilpay-simulator.js";
import { IntentStatus } from "../managed/veilpay/contract/index.js";
import { createVeilPayPrivateState } from "../witnesses.js";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect } from "vitest";
import { randomBytes } from "./utils.js";

setNetworkId("undeployed");

const AMOUNT = 1000n;
// Expires far in the future in "intent operations" units (see contract note).
const FAR_FUTURE = 1_000_000n;

describe("VeilPay smart contract", () => {
  it("starts with an empty ledger", () => {
    const sim = new VeilPaySimulator(randomBytes(32));
    expect(sim.getLedger().sequence).toEqual(0n);
    expect(sim.getLedger().intents.member(1n)).toEqual(false);
  });

  it("merchant creates an active intent", () => {
    const sim = new VeilPaySimulator(randomBytes(32));
    const secret = randomBytes(32);
    const [ledger, id] = sim.createIntent(AMOUNT, FAR_FUTURE, secret);

    expect(id).toEqual(1n);
    expect(ledger.sequence).toEqual(1n);
    const intent = ledger.intents.lookup(1n);
    expect(intent.status).toEqual(IntentStatus.ACTIVE);
    expect(intent.amount).toEqual(AMOUNT);
    expect(intent.paidAmount).toEqual(0n);
  });

  it("customer pays with the right secret", () => {
    const merchantKey = randomBytes(32);
    const sim = new VeilPaySimulator(merchantKey);
    const secret = randomBytes(32);
    const [, id] = sim.createIntent(AMOUNT, FAR_FUTURE, secret);

    const ledger = sim.pay(id, secret);
    const intent = ledger.intents.lookup(id);
    expect(intent.status).toEqual(IntentStatus.PAID);
    expect(intent.paidAmount).toEqual(AMOUNT);
    expect(sim.isPaid(id)).toEqual(true);
  });

  it("rejects payment with the wrong secret", () => {
    const sim = new VeilPaySimulator(randomBytes(32));
    const secret = randomBytes(32);
    const [, id] = sim.createIntent(AMOUNT, FAR_FUTURE, secret);

    expect(() => sim.pay(id, randomBytes(32))).toThrow();
  });

  it("rejects double payment", () => {
    const sim = new VeilPaySimulator(randomBytes(32));
    const secret = randomBytes(32);
    const [, id] = sim.createIntent(AMOUNT, FAR_FUTURE, secret);
    sim.pay(id, secret);

    expect(() => sim.pay(id, secret)).toThrow("intent not active");
  });

  it("only the merchant can refund", () => {
    const sim = new VeilPaySimulator(randomBytes(32));
    const secret = randomBytes(32);
    const [, id] = sim.createIntent(AMOUNT, FAR_FUTURE, secret);
    sim.pay(id, secret);

    sim.setPrivateState(createVeilPayPrivateState(randomBytes(32)));
    expect(() => sim.refund(id, AMOUNT)).toThrow("not the intent merchant");
  });

  it("merchant refunds up to the paid amount", () => {
    const merchantKey = randomBytes(32);
    const sim = new VeilPaySimulator(merchantKey);
    const secret = randomBytes(32);
    const [, id] = sim.createIntent(AMOUNT, FAR_FUTURE, secret);
    sim.pay(id, secret);

    sim.setPrivateState(createVeilPayPrivateState(merchantKey));
    const ledger = sim.refund(id, AMOUNT);
    expect(ledger.intents.lookup(id).status).toEqual(IntentStatus.REFUNDED);
    expect(ledger.intents.lookup(id).refundedAmount).toEqual(AMOUNT);
    // A paid (then refunded) intent still verifies as paid: the payment
    // happened.
    expect(sim.isPaid(id)).toEqual(true);
  });

  it("rejects refund above the paid amount", () => {
    const sim = new VeilPaySimulator(randomBytes(32));
    const secret = randomBytes(32);
    const [, id] = sim.createIntent(AMOUNT, FAR_FUTURE, secret);
    sim.pay(id, secret);

    expect(() => sim.refund(id, AMOUNT + 1n)).toThrow("refund exceeds paid amount");
  });

  it("merchant can cancel an unpaid intent", () => {
    const sim = new VeilPaySimulator(randomBytes(32));
    const secret = randomBytes(32);
    const [, id] = sim.createIntent(AMOUNT, FAR_FUTURE, secret);

    const ledger = sim.cancel(id);
    expect(ledger.intents.lookup(id).status).toEqual(IntentStatus.CANCELLED);
    expect(sim.isPaid(id)).toEqual(false);
  });

  it("cannot pay after expiry", () => {
    const sim = new VeilPaySimulator(randomBytes(32));
    const secret = randomBytes(32);
    // Expires in one intent-operation.
    const [, id] = sim.createIntent(AMOUNT, 1n, secret);
    // A second intent consumes the remaining liveness budget.
    sim.createIntent(AMOUNT, FAR_FUTURE, randomBytes(32));

    expect(() => sim.pay(id, secret)).toThrow("intent expired");
  });
});
