export const createVeilPayPrivateState = (merchantSecretKey, paymentSecrets = {}) => ({ merchantSecretKey, paymentSecrets });
export const withPaymentSecret = (state, intentId, secret) => ({
    merchantSecretKey: state.merchantSecretKey,
    paymentSecrets: { ...state.paymentSecrets, [intentId.toString()]: secret },
});
export const witnesses = {
    merchantSecretKey: ({ privateState, }) => [privateState, privateState.merchantSecretKey],
    paymentSecret: ({ privateState }, intentId) => {
        const secret = privateState.paymentSecrets[intentId.toString()];
        if (secret === undefined) {
            throw new Error(`No payment secret known for intent ${intentId}`);
        }
        return [privateState, secret];
    },
};
//# sourceMappingURL=witnesses.js.map