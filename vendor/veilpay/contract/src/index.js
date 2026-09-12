import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
export * as VeilPay from "./managed/veilpay/contract/index.js";
export * from "./witnesses.js";
export * as VeilPay2 from "./managed/veilpay2/contract/index.js";
export * from "./witnesses2.js";
import * as CompiledVeilPayContract from "./managed/veilpay/contract/index.js";
import * as Witnesses from "./witnesses.js";
import * as CompiledVeilPay2Contract from "./managed/veilpay2/contract/index.js";
import * as Witnesses2 from "./witnesses2.js";
export const CompiledVeilPayContractContract = CompiledContract.make("VeilPay", (CompiledVeilPayContract.Contract)).pipe(CompiledContract.withWitnesses(Witnesses.witnesses), CompiledContract.withCompiledFileAssets("./managed/veilpay"));
export const CompiledVeilPay2ContractContract = CompiledContract.make("VeilPay2", (CompiledVeilPay2Contract.Contract)).pipe(CompiledContract.withWitnesses(Witnesses2.witnesses2), CompiledContract.withCompiledFileAssets("./managed/veilpay2"));
//# sourceMappingURL=index.js.map