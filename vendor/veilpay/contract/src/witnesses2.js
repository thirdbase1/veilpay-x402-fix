export const createVeilPay2PrivateState = (merchantSecretKey, receiptSecret, paymentSecrets = {}) => ({ merchantSecretKey, paymentSecrets, receiptSecret });
export const withPaymentSecret2 = (state, intentId, secret) => ({
    merchantSecretKey: state.merchantSecretKey,
    receiptSecret: state.receiptSecret,
    paymentSecrets: { ...state.paymentSecrets, [intentId.toString()]: secret },
});
export const witnesses2 = {
    merchantSecretKey: ({ privateState, }) => [privateState, privateState.merchantSecretKey],
    paymentSecret: ({ privateState }, intentId) => {
        const secret = privateState.paymentSecrets[intentId.toString()];
        if (secret === undefined) {
            throw new Error(`No payment secret known for intent ${intentId}`);
        }
        return [privateState, secret];
    },
    receiptSecret: ({ privateState, }) => [privateState, privateState.receiptSecret],
};
//# sourceMappingURL=witnesses2.js.map