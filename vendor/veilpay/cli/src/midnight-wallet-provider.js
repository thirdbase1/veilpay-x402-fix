/*
 * This file is part of example-bboard.
 * Copyright (C) Midnight Foundation
 * SPDX-License-Identifier: Apache-2.0
 * Licensed under the Apache License, Version 2.0 (the "License");
 * You may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { DustSecretKey, LedgerParameters, ZswapSecretKeys, } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { ttlOneHour } from '@midnight-ntwrk/midnight-js-utils';
import { getInitialShieldedState } from './wallet-utils';
import { FluentWalletBuilder } from '@midnight-ntwrk/testkit-js';
/**
 * Provider class that implements wallet functionality for the Midnight network.
 * Handles transaction balancing, submission, and wallet state management.
 */
export class MidnightWalletProvider {
    logger;
    env;
    wallet;
    unshieldedKeystore;
    zswapSecretKeys;
    dustSecretKey;
    constructor(logger, environmentConfiguration, wallet, zswapSecretKeys, dustSecretKey, unshieldedKeystore) {
        this.logger = logger;
        this.env = environmentConfiguration;
        this.wallet = wallet;
        this.zswapSecretKeys = zswapSecretKeys;
        this.dustSecretKey = dustSecretKey;
        this.unshieldedKeystore = unshieldedKeystore;
    }
    getCoinPublicKey() {
        return this.zswapSecretKeys.coinPublicKey;
    }
    getEncryptionPublicKey() {
        return this.zswapSecretKeys.encryptionPublicKey;
    }
    async balanceTx(tx, ttl = ttlOneHour()) {
        const recipe = await this.wallet.balanceUnboundTransaction(tx, { shieldedSecretKeys: this.zswapSecretKeys, dustSecretKey: this.dustSecretKey }, { ttl });
        const signedRecipe = await this.wallet.signRecipe(recipe, (payload) => this.unshieldedKeystore.signData(payload));
        return this.wallet.finalizeRecipe(signedRecipe);
    }
    submitTx(tx) {
        return this.wallet.submitTransaction(tx);
    }
    // We do not wait for funds here; the CLI flow handles it explicitly.
    async start() {
        this.logger.info('Starting wallet...');
        await this.wallet.start(this.zswapSecretKeys, this.dustSecretKey);
    }
    async stop() {
        return this.wallet.stop();
    }
    static async build(logger, env, seed) {
        const dustOptions = {
            ledgerParams: LedgerParameters.initialParameters(),
            additionalFeeOverhead: env.walletNetworkId === 'undeployed' ? 500000000000000000n : 1000n,
            feeBlocksMargin: 5,
        };
        const builder = FluentWalletBuilder.forEnvironment(env).withDustOptions(dustOptions);
        const buildResult = seed
            ? await builder.withSeed(seed).buildWithoutStarting()
            : await builder.withRandomSeed().buildWithoutStarting();
        const { wallet, seeds, keystore } = buildResult;
        const initialState = await getInitialShieldedState(logger, wallet.shielded);
        logger.info(`Your wallet seed is: ${seeds.masterSeed} and your address is: ${initialState.address.coinPublicKeyString()}`);
        return new MidnightWalletProvider(logger, env, wallet, ZswapSecretKeys.fromSeed(seeds.shielded), DustSecretKey.fromSeed(seeds.dust), keystore);
    }
}
//# sourceMappingURL=midnight-wallet-provider.js.map