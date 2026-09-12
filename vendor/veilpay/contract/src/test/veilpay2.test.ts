import { VeilPay2Simulator, qualifiedCoin } from "./veilpay2-simulator.js";
import { IntentStatus } from "../managed/veilpay2/contract/index.js";
import { createVeilPay2PrivateState } from "../witnesses2.js";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect } from "vitest";
import { randomBytes } from "./utils.js";

setNetworkId("undeployed");

const AMOUNT = 1000n;
const FAR_FUTURE = 1_000_000n;
const ANY_TOKEN = new Uint8Array(32); // zero color = open intent
const TOKEN = randomBytes(32);
const merchantPk = () => randomBytes(32);

describe("VeilPay v2 contract (token-moving)", () => {
  it("creates an intent with token routing metadata", () => {
    const sim = VeilPay2Simulator.deploy(randomBytes(32), randomBytes(32));
    const [, id] = sim.createIntent(
      AMOUNT,
      FAR_FUTURE,
      TOKEN,
      merchantPk(),
      randomBytes(32),
    );
    const intent = sim.getLedger().intents.lookup(id);
    expect(intent.status).toEqual(IntentStatus.ACTIVE);
    expect(intent.amount).toEqual(AMOUNT);
    expect(intent.tokenColor).toEqual(TOKEN);
    expect(intent.merchantCoinPk.length).toEqual(32);
  });

  it("rejects a zero merchant coin key", () => {
    const sim = VeilPay2Simulator.deploy(randomBytes(32), randomBytes(32));
    expect(() =>
      sim.createIntent(AMOUNT, FAR_FUTURE, ANY_TOKEN, new Uint8Array(32), randomBytes(32)),
    ).toThrow();
  });

  it("pays: spends the payer coin, produces a merchant output, marks PAID", () => {
    const merchantKey = randomBytes(32);
    const receiptSecret = randomBytes(32);
    const sim = VeilPay2Simulator.deploy(merchantKey, receiptSecret);
    const secret = randomBytes(32);
    const mPk = merchantPk();
    const [, id] = sim.createIntent(AMOUNT, FAR_FUTURE, TOKEN, mPk, secret);

    const coin = qualifiedCoin(AMOUNT, TOKEN, randomBytes(32));
    const { ledger, result } = sim.pay(id, secret, coin, receiptSecret, merchantKey);

    const intent = ledger.intents.lookup(id);
    expect(intent.status).toEqual(IntentStatus.PAID);
    expect(intent.paidAmount).toEqual(AMOUNT);
    // Exact-value payment: the sent coin carries the full price, no change.
    expect(result.sent.value).toEqual(AMOUNT);
    expect(result.change.is_some).toEqual(false);
    // A receipt commitment is now stored for this intent.
    expect(ledger.receipts.member(id)).toEqual(true);
    expect(ledger.receipts.lookup(id).length).toEqual(32);
  });

  it("returns change to the payer when the coin exceeds the price", () => {
    const merchantKey = randomBytes(32);
    const receiptSecret = randomBytes(32);
    const sim = VeilPay2Simulator.deploy(merchantKey, receiptSecret);
    const secret = randomBytes(32);
    const [, id] = sim.createIntent(AMOUNT, FAR_FUTURE, ANY_TOKEN, merchantPk(), secret);

    const coin = qualifiedCoin(AMOUNT + 400n, TOKEN, randomBytes(32));
    const { result } = sim.pay(id, secret, coin, receiptSecret, merchantKey);

    expect(result.sent.value).toEqual(AMOUNT);
    expect(result.change.is_some).toEqual(true);
    expect(result.change.value?.value).toEqual(400n);
  });

  it("rejects a coin that cannot cover the intent", () => {
    const merchantKey = randomBytes(32);
    const receiptSecret = randomBytes(32);
    const sim = VeilPay2Simulator.deploy(merchantKey, receiptSecret);
    const secret = randomBytes(32);
    const [, id] = sim.createIntent(AMOUNT, FAR_FUTURE, ANY_TOKEN, merchantPk(), secret);

    const coin = qualifiedCoin(AMOUNT - 1n, TOKEN, randomBytes(32));
    expect(() => sim.pay(id, secret, coin, receiptSecret, merchantKey)).toThrow(
      "coin cannot cover intent",
    );
  });

  it("rejects the wrong token color on a priced intent", () => {
    const merchantKey = randomBytes(32);
    const receiptSecret = randomBytes(32);
    const sim = VeilPay2Simulator.deploy(merchantKey, receiptSecret);
    const secret = randomBytes(32);
    const [, id] = sim.createIntent(AMOUNT, FAR_FUTURE, TOKEN, merchantPk(), secret);

    const coin = qualifiedCoin(AMOUNT, randomBytes(32), randomBytes(32));
    expect(() => sim.pay(id, secret, coin, receiptSecret, merchantKey)).toThrow(
      "wrong token color",
    );
  });

  it("accepts any color on an open intent", () => {
    const merchantKey = randomBytes(32);
    const receiptSecret = randomBytes(32);
    const sim = VeilPay2Simulator.deploy(merchantKey, receiptSecret);
    const secret = randomBytes(32);
    const [, id] = sim.createIntent(AMOUNT, FAR_FUTURE, ANY_TOKEN, merchantPk(), secret);

    const coin = qualifiedCoin(AMOUNT, randomBytes(32), randomBytes(32));
    expect(() => sim.pay(id, secret, coin, receiptSecret, merchantKey)).not.toThrow();
  });

  it("rejects a payment with the wrong secret", () => {
    const merchantKey = randomBytes(32);
    const receiptSecret = randomBytes(32);
    const sim = VeilPay2Simulator.deploy(merchantKey, receiptSecret);
    const [, id] = sim.createIntent(AMOUNT, FAR_FUTURE, ANY_TOKEN, merchantPk(), randomBytes(32));

    const coin = qualifiedCoin(AMOUNT, TOKEN, randomBytes(32));
    expect(() => sim.pay(id, randomBytes(32), coin, receiptSecret, merchantKey)).toThrow(
      "invalid payment secret",
    );
  });

  it("refund updates status and amount (merchant only)", () => {
    const merchantKey = randomBytes(32);
    const receiptSecret = randomBytes(32);
    const sim = VeilPay2Simulator.deploy(merchantKey, receiptSecret);
    const secret = randomBytes(32);
    const [, id] = sim.createIntent(AMOUNT, FAR_FUTURE, ANY_TOKEN, merchantPk(), secret);
    sim.pay(id, secret, qualifiedCoin(AMOUNT, TOKEN, randomBytes(32)), receiptSecret, merchantKey);

    // A different merchant key must not be able to refund.
    sim.setPrivateState(
      createVeilPay2PrivateState(randomBytes(32), receiptSecret, {
        [id.toString()]: secret,
      }),
    );
    expect(() => sim.refund(id, AMOUNT)).toThrow("not the intent merchant");

    sim.setPrivateState(createVeilPay2PrivateState(merchantKey, receiptSecret));
    const ledger = sim.refund(id, AMOUNT);
    expect(ledger.intents.lookup(id).status).toEqual(IntentStatus.REFUNDED);
    expect(ledger.intents.lookup(id).refundedAmount).toEqual(AMOUNT);
  });

  it("cancel works before payment (merchant only)", () => {
    const merchantKey = randomBytes(32);
    const sim = VeilPay2Simulator.deploy(merchantKey, randomBytes(32));
    const [, id] = sim.createIntent(AMOUNT, FAR_FUTURE, ANY_TOKEN, merchantPk(), randomBytes(32));
    const ledger = sim.cancel(id);
    expect(ledger.intents.lookup(id).status).toEqual(IntentStatus.CANCELLED);
  });

  it("cannot pay after expiry", () => {
    const merchantKey = randomBytes(32);
    const receiptSecret = randomBytes(32);
    const sim = VeilPay2Simulator.deploy(merchantKey, receiptSecret);
    const secret = randomBytes(32);
    const [, id] = sim.createIntent(AMOUNT, 1n, ANY_TOKEN, merchantPk(), secret);
    sim.createIntent(AMOUNT, FAR_FUTURE, ANY_TOKEN, merchantPk(), randomBytes(32));

    const coin = qualifiedCoin(AMOUNT, TOKEN, randomBytes(32));
    expect(() => sim.pay(id, secret, coin, receiptSecret, merchantKey)).toThrow(
      "intent expired",
    );
  });
});
