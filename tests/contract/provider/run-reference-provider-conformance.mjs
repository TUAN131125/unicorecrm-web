import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { repositoryRoot } from '../../../scripts/quality/core/repo-context.mjs';
import { createReferenceProviderHost } from './reference-host/referenceProviderHost.mjs';
import { sampleFromSchema, validateSchema } from './reference-host/schemaRuntime.mjs';
const spec=JSON.parse(fs.readFileSync(path.join(repositoryRoot,'docs/api/openapi.json'),'utf8'));
const operations=new Map();for(const [route,item] of Object.entries(spec.paths))for(const method of ['get','post','put','patch','delete'])if(item[method])operations.set(item[method].operationId,{route,method:method.toUpperCase(),operation:item[method]});
const packs=[];const base=path.join(repositoryRoot,'tests/fixtures/backend-contract');for(const dir of fs.readdirSync(base).sort()){const file=path.join(base,dir,'provider-scenarios.json');if(fs.existsSync(file))packs.push({id:dir,...JSON.parse(fs.readFileSync(file,'utf8'))});}
const externalBaseUrl=process.env.UNICORE_REFERENCE_PROVIDER_BASE_URL?.trim();
const host=externalBaseUrl?null:createReferenceProviderHost();
const {baseUrl}=externalBaseUrl?{baseUrl:externalBaseUrl}:await host.start();let passed=0;
try{
 for(const pack of packs){for(const scenario of pack.scenarios){await runScenario(pack.id,scenario);passed++;}}
 console.log(`[reference-provider] PASS ${passed}/${packs.reduce((n,p)=>n+p.scenarios.length,0)} scenarios across ${packs.length} packs using actual OpenAPI paths and schemas`);
}finally{if(host)await host.stop();}
async function runScenario(pack,scenario){
 const record=operations.get(scenario.operationId);if(!record)throw new Error(`${pack}/${scenario.id}: unknown operation ${scenario.operationId}`);if(record.operation['x-contract-status']!=='PRODUCTION_CONTRACT_READY')throw new Error(`${pack}/${scenario.id}: operation is blocked`);
 const pathValue=record.route.replace(/\{([^}]+)\}/gu,(_,name)=>encodeURIComponent(seedId(name)));
 const requestSchema=record.operation.requestBody?.content?.['application/json']?.schema;let body=requestSchema?sampleFromSchema(spec,requestSchema,scenario.operationId):undefined;
 if(scenario.forbiddenFields?.length){body??={};body[scenario.forbiddenFields[0]]='frontend-authority-forbidden';}
 const key=`reference-${pack}-${scenario.operationId}-${crypto.randomUUID()}`;const baseHeaders={Authorization:'Bearer provider-alpha','X-Workspace-Id':'workspace-alpha','X-Request-Id':`request-${crypto.randomUUID()}`,'X-Correlation-Id':`correlation-${crypto.randomUUID()}`,'X-Conformance-Pack':pack,'X-Conformance-Scenario-Id':scenario.id,'Content-Type':'application/json'};
 if(record.operation['x-idempotency-policy']==='REQUIRED')baseHeaders['Idempotency-Key']=key;
 if(record.operation['x-concurrency-policy']==='IF_MATCH_REQUIRED')baseHeaders['If-Match']=scenario.id.includes('stale')?'0':'1';
 if(scenario.id.includes('cross-workspace'))baseHeaders['X-Workspace-Id']='workspace-beta';
 if(scenario.expectedOutcome==='REPLAYED'||scenario.id.includes('replay')){
   await invoke(record,pathValue,body,{...baseHeaders,'X-Conformance-Phase':'warmup'},undefined);
 }
 if((scenario.expectedCode??scenario.expectedProblemCode??scenario.errorCode)==='IDEMPOTENCY_KEY_REUSED'||scenario.id.includes('different-payload')){
   await invoke(record,pathValue,body,{...baseHeaders,'X-Conformance-Phase':'warmup'},undefined);
   body=structuredClone(body??{});mutateFirstScalar(body);
 }
 const result=await invoke(record,pathValue,body,baseHeaders,scenario);
 const expectedStatus=scenario.expectedStatus??(scenario.expectedCode||scenario.expectedProblemCode||scenario.errorCode?result.status:undefined);
 if(expectedStatus!==undefined&&result.status!==expectedStatus)throw new Error(`${pack}/${scenario.id}: expected ${expectedStatus}, got ${result.status}`);
 const expectedCode=scenario.expectedCode??scenario.expectedProblemCode??scenario.errorCode;if(expectedCode&&result.body.code!==expectedCode)throw new Error(`${pack}/${scenario.id}: expected ${expectedCode}, got ${result.body.code}`);
 if(scenario.expectedOutcome&&result.body.outcome!==scenario.expectedOutcome)throw new Error(`${pack}/${scenario.id}: expected outcome ${scenario.expectedOutcome}`);
 if(scenario.expectedState&&!containsValueForKey(result.body,'state',scenario.expectedState))throw new Error(`${pack}/${scenario.id}: state ${scenario.expectedState} missing`);
 if(scenario.expectedResult&&!isSubset(result.body.result,scenario.expectedResult))throw new Error(`${pack}/${scenario.id}: expectedResult mismatch`);
}
async function invoke(record,pathValue,body,headers,scenario){
 const response=await fetch(`${baseUrl}${pathValue}`,{method:record.method,headers,body:body===undefined?undefined:JSON.stringify(body)});const value=await response.json();const schema=responseSchema(record.operation,response.status);const issues=validateSchema(spec,schema,value);if(issues.length){console.error(JSON.stringify({operationId:record.operation.operationId,status:response.status,value},null,2));throw new Error(`${record.operation.operationId}: response schema invalid: ${issues.join('; ')}`);}return {status:response.status,body:value};
}
function responseSchema(op,status){const r=op.responses[String(status)]??op.responses.default;if(!r)throw new Error(`${op.operationId}: response ${status} missing`);return r.content?.['application/json']?.schema??r.content?.['application/problem+json']?.schema;}
function seedId(name){return ({leadId:'fixture-lead',productId:'fixture-product',bookingId:'fixture-shipping',returnId:'fixture-return',resolutionId:'fixture-resolution',dealId:'fixture-deal',quoteId:'fixture-quote',orderId:'fixture-order',invoiceId:'fixture-invoice',paymentId:'fixture-payment',paymentRecordId:'fixture-payment',allocationId:'fixture-allocation',refundId:'fixture-refund',planId:'fixture-plan',intentId:'fixture-intent',caseId:'fixture-case',taskId:'fixture-task',approvalId:'fixture-approval'}[name]??`fixture-${name.replace(/Id$/u,'').toLowerCase()}`);}
function mutateFirstScalar(value){if(!value||typeof value!=='object')return false;for(const key of Object.keys(value)){const current=value[key];if(typeof current==='string'){value[key]=current+'x';return true;}if(typeof current==='number'){value[key]=current+1;return true;}if(current&&typeof current==='object'&&mutateFirstScalar(current))return true;}return false;}
function containsValueForKey(v,key,expected){if(!v||typeof v!=='object')return false;if(v[key]===expected)return true;return Object.values(v).some(x=>containsValueForKey(x,key,expected));}
function isSubset(value,subset){if(!subset||typeof subset!=='object')return Object.is(value,subset);if(!value||typeof value!=='object')return false;return Object.entries(subset).every(([k,v])=>isSubset(value[k],v));}
