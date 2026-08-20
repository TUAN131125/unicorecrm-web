import process from "node:process";

const required = [
  "UNICORE_PROVIDER_BASE_URL",
  "UNICORE_PROVIDER_ACCESS_TOKEN",
  "UNICORE_PROVIDER_WORKSPACE_ID",
  "UNICORE_PROVIDER_PAYMENT_RECORD_ID",
  "UNICORE_PROVIDER_PAYMENT_RECORD_VERSION",
  "UNICORE_PROVIDER_ALLOCATION_ID",
  "UNICORE_PROVIDER_ALLOCATION_VERSION",
  "UNICORE_PROVIDER_INVOICE_ID",
  "UNICORE_PROVIDER_SECONDARY_ACCESS_TOKEN",
  "UNICORE_PROVIDER_SECONDARY_WORKSPACE_ID",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`[payment-ledger-provider] BLOCKED_EXTERNAL missing ${missing.join(", ")}`);
  process.exit(2);
}
const baseUrl = process.env.UNICORE_PROVIDER_BASE_URL.replace(/\/$/u, "");
const paymentRecordId = process.env.UNICORE_PROVIDER_PAYMENT_RECORD_ID;
const invoiceId = process.env.UNICORE_PROVIDER_INVOICE_ID;
function headers({token=process.env.UNICORE_PROVIDER_ACCESS_TOKEN,workspace=process.env.UNICORE_PROVIDER_WORKSPACE_ID,idempotencyKey,version}={}) {
  return {
    Authorization:`Bearer ${token}`,
    "X-Workspace-Id":workspace,
    "X-Request-Id":`p04-${crypto.randomUUID()}`,
    "X-Correlation-Id":`p04-${crypto.randomUUID()}`,
    ...(idempotencyKey?{"Idempotency-Key":idempotencyKey}:{}),
    ...(version?{"If-Match":String(version)}:{}),
    "Content-Type":"application/json",
  };
}
async function call(operationId,path,{method="GET",body,expectedStatus=200,...headerOptions}={}){
  const response=await fetch(`${baseUrl}${path}`,{method,headers:headers(headerOptions),...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await response.json();
  if(response.status!==expectedStatus) throw new Error(`${operationId}: expected ${expectedStatus}, got ${response.status}: ${JSON.stringify(data)}`);
  return data;
}
function assert(value,message){if(!value) throw new Error(message);}
function assertOutcome(body,aggregateId){for(const key of ["commandId","correlationId","aggregateId","aggregateType","version","occurredAt","outcome","result"]) assert(body[key]!==undefined,`${key} missing`);assert(body.aggregateId===aggregateId,`aggregateId mismatch for ${aggregateId}`);}
const allocationKey=`p04-allocation-${crypto.randomUUID()}`;
const allocationBody={source:{type:"PAYMENT_RECORD",id:paymentRecordId},targets:[{invoiceId,amount:{amount:"1.00",currency:process.env.UNICORE_PROVIDER_CURRENCY??"USD"}}]};
const allocation=await call("allocatePaymentSource","/payment-allocations",{method:"POST",body:allocationBody,idempotencyKey:allocationKey,version:process.env.UNICORE_PROVIDER_PAYMENT_RECORD_VERSION});
assertOutcome(allocation,paymentRecordId);assert(Array.isArray(allocation.result.allocations),"allocations missing");
const replay=await call("allocatePaymentSource-replay","/payment-allocations",{method:"POST",body:allocationBody,idempotencyKey:allocationKey,version:process.env.UNICORE_PROVIDER_PAYMENT_RECORD_VERSION});
assert(replay.outcome==="REPLAYED"||replay.commandId===allocation.commandId,"allocation replay not proven");
const refundKey=`p04-refund-${crypto.randomUUID()}`;
const refund=await call("createRefundIntent","/refund-intents",{method:"POST",expectedStatus:202,body:{source:{type:"PAYMENT_RECORD",id:paymentRecordId},amount:{amount:"1.00",currency:process.env.UNICORE_PROVIDER_CURRENCY??"USD"},reasonCode:"PROVIDER_CONTRACT",reason:"P0.4 provider contract"},idempotencyKey:refundKey,version:allocation.version});
assert(refund.result?.state==="CREATED","Refund intent not created asynchronously");
const refundRead=await call("getRefund",`/refunds/${encodeURIComponent(refund.aggregateId)}`);assert(Number.isInteger(refundRead.resourceVersion),"Refund resourceVersion missing");
const denied=await call("getRefund-cross-workspace",`/refunds/${encodeURIComponent(refund.aggregateId)}`,{expectedStatus:403,token:process.env.UNICORE_PROVIDER_SECONDARY_ACCESS_TOKEN,workspace:process.env.UNICORE_PROVIDER_SECONDARY_WORKSPACE_ID});
assert(denied.code==="WORKSPACE_MISMATCH"||denied.code==="RESOURCE_NOT_FOUND","Cross-workspace refund disclosure");
console.log("[payment-ledger-provider] PASS allocation replay, refund intent/read and workspace isolation");
