import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";

export * as VeilPay from "./managed/veilpay/contract/index.js";
export * from "./witnesses.js";

import * as CompiledVeilPayContract from "./managed/veilpay/contract/index.js";
import * as Witnesses from "./witnesses.js";

export const CompiledVeilPayContractContract = CompiledContract.make<
  CompiledVeilPayContract.Contract<Witnesses.VeilPayPrivateState>
>("VeilPay", CompiledVeilPayContract.Contract<Witnesses.VeilPayPrivateState>).pipe(
  CompiledContract.withWitnesses(Witnesses.witnesses),
  CompiledContract.withCompiledFileAssets("./managed/veilpay"),
);
