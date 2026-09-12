import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";

export * as VeilPay from "./managed/veilpay/contract/index.js";
export * from "./witnesses";

export * as VeilPay2 from "./managed/veilpay2/contract/index.js";
export * from "./witnesses2";

import * as CompiledVeilPayContract from "./managed/veilpay/contract/index.js";
import * as Witnesses from "./witnesses";
import * as CompiledVeilPay2Contract from "./managed/veilpay2/contract/index.js";
import * as Witnesses2 from "./witnesses2";

export const CompiledVeilPayContractContract = CompiledContract.make<
  CompiledVeilPayContract.Contract<Witnesses.VeilPayPrivateState>
>("VeilPay", CompiledVeilPayContract.Contract<Witnesses.VeilPayPrivateState>).pipe(
  CompiledContract.withWitnesses(Witnesses.witnesses),
  CompiledContract.withCompiledFileAssets("./managed/veilpay"),
);

export const CompiledVeilPay2ContractContract = CompiledContract.make<
  CompiledVeilPay2Contract.Contract<Witnesses2.VeilPay2PrivateState>
>("VeilPay2", CompiledVeilPay2Contract.Contract<Witnesses2.VeilPay2PrivateState>).pipe(
  CompiledContract.withWitnesses(Witnesses2.witnesses2),
  CompiledContract.withCompiledFileAssets("./managed/veilpay2"),
);
