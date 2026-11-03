import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { repositoryRoot } from '../../scripts/quality/core/repo-context.mjs';
import { loadClientOwnership, loadQualityGateIds } from '../../scripts/api/openapi/load.mjs';
import { collectOperations, primarySuccessStatus, responseType, successResponseSchemas, validateDocument } from '../../scripts/api/openapi/validate.mjs';
import { normalizeOpenApi, buildApiOperationCatalog } from '../../scripts/api/openapi/normalize.mjs';
import { renderGeneratedArtifacts } from '../../scripts/api/openapi/render.mjs';
import { generatedOutputs } from '../../scripts/api/openapi/write-or-check.mjs';
import crypto from 'node:crypto';

const document = JSON.parse(fs.readFileSync(path.join(repositoryRoot,'docs/api/openapi.json'),'utf8'));
const ownership=loadClientOwnership(), gates=loadQualityGateIds();
const createId='createOutboundWebhookSubscription';
const operation = doc => collectOperations(doc).find(row=>row.operationId===createId).operation;
const candidate=()=>{
  const doc=structuredClone(document), op=operation(doc);
  op.responses['200']=structuredClone(op.responses['201']);
  op['x-primary-success-status']='201';
  return doc;
};

test('explicit 201 remains primary with declared 200 replay; both use named schemas',()=>{
  const op=operation(candidate());
  assert.equal(primarySuccessStatus(op),'201');
  assert.equal(responseType(op),'OutboundWebhookMutationResponse');
  assert.deepEqual(successResponseSchemas(op),{'200':'OutboundWebhookMutationResponse','201':'OutboundWebhookMutationResponse'});
});
test('invalid or undeclared explicit primary fails rather than falling back',()=>{
  for(const status of ['203','default','400',201]) {
    const doc=candidate();operation(doc)['x-primary-success-status']=status;
    assert.throws(()=>validateDocument(doc,ownership,gates),/invalid or undeclared primary/);
  }
});
test('missing schema in the secondary success fails validation',()=>{
  const doc=candidate();operation(doc).responses['200'].content={};
  assert.throws(()=>validateDocument(doc,ownership,gates),/status 200.*named success/);
});
test('unresolved secondary response reference fails validation',()=>{
  const doc=candidate();operation(doc).responses['200'].content['application/json'].schema.$ref='#/components/schemas/Missing';
  assert.throws(()=>validateDocument(doc,ownership,gates),/missing success schema Missing/);
});
test('all existing primary statuses remain unchanged, including legacy multiple successes',()=>{
  const before=normalizeOpenApi(document,ownership), after=normalizeOpenApi(candidate(),ownership);
  assert.equal(before.operations.length,328);
  for(let i=0;i<before.operations.length;i++)assert.equal(after.operations[i].successStatus,before.operations[i].successStatus,before.operations[i].operationId);
  assert.equal(primarySuccessStatus(collectOperations(document).find(o=>o.operationId==='signIn').operation),'200');
  assert.equal(primarySuccessStatus(collectOperations(document).find(o=>o.operationId==='createCommunicationChannelAccount').operation),'200');
});
test('operation catalog and runtime schema map agree on primary and declared responses',()=>{
  const normalized=normalizeOpenApi(candidate(),ownership);
  const catalog=buildApiOperationCatalog(normalized,'offline-test');
  assert.equal(catalog.operations.find(o=>o.operationId===createId).response.successStatus,'201');
  const generated=renderGeneratedArtifacts(normalized,'offline-test');
  const line=generated.runtimeContractSource.split('\n').find(value=>value.startsWith('export const OPENAPI_OPERATION_RUNTIME_CONTRACTS = '));
  const contracts=JSON.parse(line.slice('export const OPENAPI_OPERATION_RUNTIME_CONTRACTS = '.length).replace(/ as const;$/u,''));
  assert.equal(contracts[createId].responseSchema,'OutboundWebhookMutationResponse');
  assert.deepEqual(contracts[createId].responseSchemas,{'200':'OutboundWebhookMutationResponse','201':'OutboundWebhookMutationResponse'});
});

const require=createRequire(path.join(repositoryRoot,'package.json'));
const {build}=require('esbuild');
const testRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
async function runtime(doc){
  const generated=renderGeneratedArtifacts(normalizeOpenApi(doc,ownership),'offline-test').runtimeContractSource;
  const result=await build({entryPoints:[path.join(testRoot,'src/platform/api/contracts/openApiRuntimeValidation.ts')],bundle:true,write:false,format:'esm',platform:'node',plugins:[{
    name:'offline-generated-contract',setup(builder){
      builder.onResolve({filter:/generatedOpenApiRuntimeContract$/},()=>({path:'contract',namespace:'offline'}));
      builder.onLoad({filter:/.*/,namespace:'offline'},()=>({contents:generated,loader:'ts'}));
    },
  }]});
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
}
// These are in-memory validation fixtures only; no API, connection or webhook is created.
const subscription={subscriptionId:'test',workspaceId:'test',name:'test',eventType:'test',endpointUrl:'https://example.invalid',status:'DRAFT',version:1,createdAt:'2026-10-22T00:00:00Z',updatedAt:'2026-10-22T00:00:00Z'};
test('runtime accepts COMMITTED/201 and REPLAYED/200 against declared response schema',async()=>{
  const {validateOpenApiResponse:validate}=await runtime(candidate());
  assert.equal(validate(createId,{subscription,outcome:'COMMITTED',signingSecret:'offline-validation-fixture'},201).valid,true);
  assert.equal(validate(createId,{subscription,outcome:'REPLAYED',signingSecret:null},200).valid,true);
  assert.equal(validate(createId,{subscription,outcome:'REPLAYED'},200).valid,true);
});
test('runtime rejects malformed payload for both declared success statuses',async()=>{
  const {validateOpenApiResponse:validate}=await runtime(candidate());
  for(const status of [200,201]) {
    assert.equal(validate(createId,{outcome:'COMMITTED'},status).valid,false);
    assert.equal(validate(createId,{subscription:{...subscription,version:'wrong'},outcome:'REPLAYED'},status).valid,false);
  }
});
test('runtime rejects undeclared success even with valid body or absent body',async()=>{
  const {validateOpenApiResponse:validate}=await runtime(candidate());
  for(const status of [202,204,299])for(const payload of [undefined,{subscription,outcome:'REPLAYED'}]) {
    const result=validate(createId,payload,status);
    assert.equal(result.valid,false);assert.match(result.issues[0].message,/no declared response/);
  }
});
test('current contract without replay response rejects HTTP 200 rather than using 201 schema',async()=>{
  const {validateOpenApiResponse:validate}=await runtime(document);
  assert.equal(validate(createId,{subscription,outcome:'REPLAYED'},200).valid,false);
  assert.equal(validate(createId,{subscription,outcome:'COMMITTED'},201).valid,true);
});

async function transport(doc=candidate()){
  const generated=renderGeneratedArtifacts(normalizeOpenApi(doc,ownership),'offline-test').runtimeContractSource;
  const source=(file)=>JSON.stringify(path.join(repositoryRoot,file).replaceAll('\\','/'));
  const result=await build({stdin:{contents:`export { FetchHttpClient } from ${source('src/platform/api/client/FetchHttpClient.ts')}; export { IntegrationConfigurationApiClient } from ${source('src/platform/api/generated/integrationConfigurationApi.ts')};`,resolveDir:repositoryRoot},bundle:true,write:false,format:'esm',platform:'node',alias:{'@':path.join(repositoryRoot,'src')},plugins:[{
    name:'offline-transport-contract',setup(builder){
      builder.onResolve({filter:/openApiRuntimeValidation$/},()=>({path:path.join(testRoot,'src/platform/api/contracts/openApiRuntimeValidation.ts')}));
      builder.onResolve({filter:/generatedOpenApiRuntimeContract$/},()=>({path:'contract',namespace:'offline'}));
      builder.onLoad({filter:/.*/,namespace:'offline'},()=>({contents:generated,loader:'ts'}));
    },
  }]});
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
}
const createBody={name:'offline',eventType:'offline',endpointUrl:'https://example.invalid'};
const options={baseUrl:'https://example.invalid/v1',accessTokenProvider:{getAccessToken:()=> 'offline'},workspaceIdProvider:{getWorkspaceId:()=> 'offline'},retryPolicy:{maxAttempts:3,baseDelayMs:0,maxDelayMs:0}};
test('generated client accepts both actual HTTP statuses without altering payload',async()=>{
  const {FetchHttpClient,IntegrationConfigurationApiClient}=await transport();
  for(const status of [201,200]){
    let count=0;
    const payload={subscription,outcome:status===201?'COMMITTED':'REPLAYED',signingSecret:status===201?'offline-validation-fixture':null};
    const http=new FetchHttpClient({...options,fetchImplementation:async(_url,init)=>{
      count++;assert.equal(init.method,'POST');assert.equal(new Headers(init.headers).get('Idempotency-Key'),'offline');
      return new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json'}});
    }});
    const result=await new IntegrationConfigurationApiClient(http).createOutboundWebhookSubscription(createBody,{idempotencyKey:'offline'});
    assert.deepEqual(result,payload);assert.equal(count,1);
  }
});
test('all three error codes preserve status, category and correlation with no retry',async()=>{
  const {FetchHttpClient}=await transport();
  for(const [code,status,category,operationId,body] of [
    ['EVENT_TYPE_INVALID',422,'VALIDATION',createId,createBody],
    ['ENDPOINT_NOT_ALLOWED',422,'VALIDATION',createId,createBody],
    ['DELIVERY_NOT_REPLAYABLE',409,'CONFLICT','replayOutboundWebhookDelivery',{}],
  ]){
    let count=0;
    const http=new FetchHttpClient({...options,fetchImplementation:async()=>{
      count++;return new Response(JSON.stringify({code,status,title:'Offline validation fixture',correlationId:'offline-correlation',retryable:false}),{status,headers:{'Content-Type':'application/problem+json'}});
    }});
    await assert.rejects(http.request({operationId,method:'POST',path:'/offline',body,idempotencyKey:'offline',retry:'never'}),error=>{
      assert.equal(error.code,code);assert.equal(error.status,status);assert.equal(error.category,category);assert.equal(error.correlationId,'offline-correlation');assert.equal(error.retryable,false);return true;
    });
    assert.equal(count,1);
  }
});
test('generated create default retry remains never even for retryable failure',async()=>{
  const {FetchHttpClient,IntegrationConfigurationApiClient}=await transport();let count=0;
  const http=new FetchHttpClient({...options,fetchImplementation:async()=>{count++;return new Response(JSON.stringify({code:'INTEGRATION_UNAVAILABLE',status:503,retryable:true}),{status:503,headers:{'Content-Type':'application/problem+json'}});}});
  await assert.rejects(new IntegrationConfigurationApiClient(http).createOutboundWebhookSubscription(createBody,{idempotencyKey:'offline'}));
  assert.equal(count,1);
});

test('current contract preserves every legacy primary and all27 generated bytes',()=>{
  const normalized=normalizeOpenApi(document,ownership);
  for(const row of normalized.operations){
    const expected=['200','201','202'].find(status=>row.operation.responses?.[status])??null;
    assert.equal(row.successStatus,expected,row.operationId);
  }
  const bytes=fs.readFileSync(path.join(repositoryRoot,'docs/api/openapi.json'));
  const digest=crypto.createHash('sha256').update(bytes).digest('hex');
  const outputs=generatedOutputs(renderGeneratedArtifacts(normalized,digest));
  assert.equal(outputs.length,27);
  for(const [file,source] of outputs)assert.equal(source,fs.readFileSync(path.join(repositoryRoot,file),'utf8'),file);
});

function noContent(status='204'){
  const doc=candidate(),op=operation(doc);
  delete op.responses['200'];delete op.responses['201'];
  op.responses[status]={description:'Declared no-content success.'};
  op['x-primary-success-status']=status;
  return doc;
}
test('204 and205 no-content agree across generator, catalog, runtime and client',async()=>{
  for(const status of ['204','205']){
    const doc=noContent(status),op=operation(doc);
    validateDocument(doc,ownership,gates);
    assert.equal(primarySuccessStatus(op),status);assert.equal(responseType(op),'void');
    assert.deepEqual(successResponseSchemas(op),{[status]:null});
    const normalized=normalizeOpenApi(doc,ownership);
    assert.equal(buildApiOperationCatalog(normalized,'offline-test').operations.find(o=>o.operationId===createId).response.schema,null);
    const generated=renderGeneratedArtifacts(normalized,'offline-test');
    assert.match(generated.renderedClients['src/platform/api/generated/integrationConfigurationApi.ts'],/createOutboundWebhookSubscription<TResponse = void/);
    const {validateOpenApiResponse:validate}=await runtime(doc);
    assert.equal(validate(createId,undefined,Number(status)).valid,true);
    for(const body of [null,{},'unexpected'])assert.equal(validate(createId,body,Number(status)).valid,false);
    assert.equal(validate(createId,{subscription,outcome:'COMMITTED'},201).valid,false);
    const {FetchHttpClient,IntegrationConfigurationApiClient}=await transport(doc);
    const http=new FetchHttpClient({...options,fetchImplementation:async()=>new Response(null,{status:Number(status)})});
    assert.equal(await new IntegrationConfigurationApiClient(http).createOutboundWebhookSubscription(createBody),undefined);
  }
});
test('legacy primary selection handles a declared no-content-only operation',()=>{
  const doc=noContent();delete operation(doc)['x-primary-success-status'];
  validateDocument(doc,ownership,gates);
  assert.equal(primarySuccessStatus(operation(doc)),'204');
});
test('secondary204 is declared without changing primary JSON schema',async()=>{
  const doc=candidate();operation(doc).responses['204']={description:'No content.'};
  validateDocument(doc,ownership,gates);
  assert.equal(primarySuccessStatus(operation(doc)),'201');
  assert.equal(responseType(operation(doc)),'OutboundWebhookMutationResponse');
  const {validateOpenApiResponse:validate}=await runtime(doc);
  assert.equal(validate(createId,undefined,204).valid,true);
  assert.equal(validate(createId,{subscription,outcome:'REPLAYED'},200).valid,true);
  assert.equal(validate(createId,{subscription,outcome:'COMMITTED'},201).valid,true);
});
test('204 response with content is invalid rather than silently discarding schema',()=>{
  const doc=noContent();operation(doc).responses['204'].content={'application/json':{schema:{$ref:'#/components/schemas/OutboundWebhookMutationResponse'}}};
  assert.throws(()=>validateDocument(doc,ownership,gates),/must not declare response content/);
});
test('BLOCKED operations reject every declared2xx and never validate a response',async()=>{
  const blockedId=collectOperations(document).find(o=>o.operation['x-contract-status']==='BLOCKED').operationId;
  for(const status of ['200','201','202','204','205','206','299','2XX']){
    const doc=structuredClone(document),op=collectOperations(doc).find(o=>o.operationId===blockedId).operation;
    op.responses[status]={description:'Must remain blocked.'};
    assert.throws(()=>validateDocument(doc,ownership,gates),/must not declare a success/);
  }
  const doc=structuredClone(document),op=collectOperations(doc).find(o=>o.operationId===blockedId).operation;
  op['x-primary-success-status']='204';
  assert.throws(()=>validateDocument(doc,ownership,gates),/must not declare a primary success/);
  const {validateOpenApiRequest,validateOpenApiResponse}=await runtime(document);
  assert.equal(validateOpenApiRequest(blockedId,undefined).valid,false);
  for(const status of [undefined,200,201,204])assert.equal(validateOpenApiResponse(blockedId,undefined,status).valid,false);
});
test('every currently declared JSON2xx schema validates and incomplete declarations fail',()=>{
  for(const row of collectOperations(document)){
    if(row.operation['x-contract-status']==='BLOCKED')continue;
    const schemas=successResponseSchemas(row.operation);
    for(const [status,response] of Object.entries(row.operation.responses).filter(([s])=>/^2\d\d$/u.test(s))){
      assert.equal(schemas[status],response.content['application/json'].schema.$ref.split('/').at(-1),row.operationId+':'+status);
    }
  }
  const doc=candidate();operation(doc).responses['202']={description:'Missing response schema.'};
  assert.throws(()=>validateDocument(doc,ownership,gates),/status 202.*named success/);
});
