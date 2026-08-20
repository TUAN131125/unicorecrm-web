import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { repositoryRoot } from '../../../../scripts/quality/core/repo-context.mjs';
import { sampleFromSchema, validateSchema, mergeSubset, setFirstProperty } from './schemaRuntime.mjs';
const spec=JSON.parse(fs.readFileSync(path.join(repositoryRoot,'docs/api/openapi.json'),'utf8'));
const tokens=new Map([['provider-alpha',new Set(['workspace-alpha'])],['provider-beta',new Set(['workspace-beta'])],['provider-multi',new Set(['workspace-alpha','workspace-beta'])]]);
const operations=[];
for(const [route,item] of Object.entries(spec.paths))for(const method of ['get','post','put','patch','delete'])if(item[method])operations.push(compile(route,method.toUpperCase(),item[method]));
operations.sort((left,right)=>routeSpecificity(right.route)-routeSpecificity(left.route)||right.route.length-left.route.length);
const scenarios=loadScenarios();
export function createReferenceProviderHost(){
 const state={idempotency:new Map(),versions:new Map()};
 const server=http.createServer((req,res)=>void handle(req,res,state).catch(e=>problem(res,500,'REFERENCE_HOST_FAILURE',e instanceof Error?e.message:String(e))));
 return {async start(){await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.off('error',reject);resolve();});});const a=server.address();return {baseUrl:`http://127.0.0.1:${a.port}`};},async stop(){if(!server.listening)return;await new Promise((r,j)=>server.close(e=>e?j(e):r()));server.closeAllConnections?.();}};
}
async function handle(req,res,state){
 const url=new URL(req.url??'/','http://reference.test');
 if(url.pathname==='/health'){json(res,200,{status:'ok',authority:'reference-provider-host',contractVersion:spec.info.version});return;}
 const matched=operations.find(op=>op.method===req.method&&op.regex.test(url.pathname));if(!matched){problem(res,404,'RESOURCE_NOT_FOUND',`No OpenAPI operation owns ${req.method} ${url.pathname}.`);return;}
 const token=(req.headers.authorization??'').replace(/^Bearer\s+/u,'');const authRequired=operationRequiresAuthentication(matched.operation);const memberships=token?tokens.get(token):undefined;
 if(authRequired&&!memberships){problem(res,401,'AUTHENTICATION_REQUIRED','A valid reference-host token is required.');return;}
 const workspace=String(req.headers['x-workspace-id']??'');const workspaceRequired=matched.operation['x-workspace-required']!==false;
 if(workspaceRequired&&!workspace){problem(res,400,'WORKSPACE_CONTEXT_REQUIRED','X-Workspace-Id is required.');return;}if(workspaceRequired&&!memberships?.has(workspace)){problem(res,403,'WORKSPACE_MISMATCH','Token cannot access requested workspace.');return;}
 const scenarioId=String(req.headers['x-conformance-scenario-id']??'');const pack=String(req.headers['x-conformance-pack']??'');const scenario=scenarios.get(`${pack}:${scenarioId}`);if(!scenario||scenario.operationId!==matched.operation.operationId){problem(res,400,'CONFORMANCE_SCENARIO_INVALID','Scenario does not match operation.');return;}
 const body=await readBody(req);const requestRef=matched.operation.requestBody?.content?.['application/json']?.schema;
 const idempotency=matched.operation['x-idempotency-policy'];const key=String(req.headers['idempotency-key']??'');if(idempotency==='REQUIRED'&&!key){problem(res,400,'IDEMPOTENCY_KEY_REQUIRED','Idempotency-Key is required.');return;}
 const concurrency=matched.operation['x-concurrency-policy'];const ifMatch=String(req.headers['if-match']??'');if(concurrency==='IF_MATCH_REQUIRED'&&!ifMatch){problem(res,428,'PRECONDITION_REQUIRED','If-Match is required.');return;}
 const phase=String(req.headers['x-conformance-phase']??'normal');const fingerprint=crypto.createHash('sha256').update(JSON.stringify([matched.operation.operationId,body])).digest('hex');const scope=`${token||'anonymous'}\0${workspace||'identity-global'}\0${key}`;
 if(key&&state.idempotency.has(scope)){const prior=state.idempotency.get(scope);if(prior.fingerprint!==fingerprint){problem(res,409,'IDEMPOTENCY_KEY_REUSED','Same key was used with a different payload.');return;}const replay=structuredClone(prior.body);if(replay&&typeof replay==='object'&&'outcome'in replay)replay.outcome='REPLAYED';json(res,prior.status,replay);return;}
 if(requestRef&&body!==undefined){const issues=validateSchema(spec,requestRef,body);if(issues.length&&!scenario.forbiddenFields){problem(res,400,'CONTRACT_VIOLATION',issues.join('; '));return;}}
 const status=phase==='warmup'?firstSuccessStatus(matched.operation):scenarioStatus(scenario,matched.operation);
 if(status>=400){problem(res,status,scenario.expectedCode??scenario.expectedProblemCode??scenario.errorCode??codeForStatus(status),`Reference scenario ${scenario.id}.`);return;}
 const responseSchema=responseSchemaFor(matched.operation,status);let response=sampleFromSchema(spec,responseSchema,matched.operation.operationId);
 response=decorateResponse(response,matched.operation.operationId,scenario,matched.params(url.pathname));
 const issues=validateSchema(spec,responseSchema,response);if(issues.length)throw new Error(`${matched.operation.operationId} response sample invalid: ${issues.join('; ')}`);
 if(key)state.idempotency.set(scope,{fingerprint,status,body:structuredClone(response)});
 json(res,status,response);
}

function routeSpecificity(route){return route.split('/').filter(Boolean).reduce((score,segment)=>score+(segment.startsWith('{')?0:10),0);}
function operationRequiresAuthentication(operation){const security=operation.security??spec.security??[];return Array.isArray(security)&&security.length>0;}
function decorateResponse(value,operationId,scenario,params){
 if(value&&typeof value==='object'){
  if('commandId'in value)value.commandId=`command-${scenario.id}`;
  if('correlationId'in value)value.correlationId=`correlation-${scenario.id}`;
  if('aggregateId'in value)value.aggregateId=Object.values(params)[0]??`aggregate-${scenario.id}`;
  if('version'in value)value.version=2;
  if('resourceVersion'in value)value.resourceVersion=2;
  if('occurredAt'in value)value.occurredAt='2026-07-25T00:00:00.000Z';
  if('outcome'in value)value.outcome=scenario.expectedOutcome??'COMMITTED';
  if(scenario.expectedState)setFirstProperty(value,'state',scenario.expectedState);
  if(scenario.expectedResult){value.result??={};mergeSubset(value.result,scenario.expectedResult);}
 }
 if(operationId==='retryRefundIntent'&&value?.result?.providerAttempt){value.result.providerAttempt.id='attempt-retry';value.result.providerAttempt.retryOfAttemptId='attempt-failed';value.result.providerAttempt.sequenceNumber=2;}
 if(operationId==='requestRefundCancellation'&&value?.result){setFirstProperty(value.result,'state','CANCELLATION_REQUESTED');if(value.result.refundIntent)setFirstProperty(value.result.refundIntent,'state','PROCESSING');}
 if(operationId==='listRefundProviderAttempts'&&Array.isArray(value)&&value[0]){value[0].id='attempt-failed';value[0].state='FAILED';value[0].sequenceNumber=1;}
 if(operationId==='convertAcceptedQuoteToOrderDraft'&&value?.result)value.result.commercialSnapshotFingerprint='sha256:reference-commercial-snapshot';
 if(['signIn','verifyMfa','refreshSession'].includes(operationId)&&value?.session){value.accessToken=`reference-access-${scenario.id}-0123456789abcdef`;value.accessTokenExpiresAt='2026-07-25T01:00:00.000Z';decorateAuthSession(value.session,scenario);}
 if(operationId==='getCurrentSession'&&value)decorateAuthSession(value,scenario);
 if(operationId==='signIn'&&scenario.expectedStatus===202&&value){value.outcome='MFA_REQUIRED';value.challengeId=`challenge-${scenario.id}`;value.challengeExpiresAt='2026-07-25T00:10:00.000Z';}
 if(operationId==='signOut'&&value){value.sessionId='session-reference';value.revokedAt='2026-07-25T00:00:00.000Z';}
 return value;
}

function decorateAuthSession(session,scenario){if(!session||typeof session!=='object')return;session.sessionId=`session-${scenario.id}`;session.status='ACTIVE';session.issuedAt='2026-07-25T00:00:00.000Z';session.lastSeenAt='2026-07-25T00:00:00.000Z';session.idleExpiresAt='2026-07-25T00:30:00.000Z';session.absoluteExpiresAt='2026-07-26T00:00:00.000Z';session.refreshCounter=1;session.assuranceLevel='AAL1';session.principal??={};session.principal.accountId='account-reference';session.principal.memberId='member-reference';session.principal.email='reference@unicore.example';session.principal.displayName='Reference User';session.device??={};session.device.deviceId='device-reference';session.device.label='Reference Browser';session.device.lastSeenAt='2026-07-25T00:00:00.000Z';}
function compile(route,method,operation){const names=[];const source='^'+route.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\\\{([^}]+)\\\}/g,(_,n)=>{names.push(n);return '([^/]+)';})+'$';const regex=new RegExp(source,'u');return {route,method,operation,regex,params(pathname){const m=regex.exec(pathname);return Object.fromEntries(names.map((n,i)=>[n,decodeURIComponent(m?.[i+1]??'')]))}};}
function loadScenarios(){const result=new Map();const base=path.join(repositoryRoot,'tests/fixtures/backend-contract');for(const dir of fs.readdirSync(base)){const file=path.join(base,dir,'provider-scenarios.json');if(!fs.existsSync(file))continue;const pack=JSON.parse(fs.readFileSync(file,'utf8'));for(const scenario of pack.scenarios)result.set(`${dir}:${scenario.id}`,scenario);}return result;}
function firstSuccessStatus(op){return Number(Object.keys(op.responses).find(c=>/^2\d\d$/u.test(c))??200);}
function scenarioStatus(s,op){if(s.expectedStatus)return s.expectedStatus;if(s.expectedCode||s.expectedProblemCode||s.errorCode)return statusForCode(s.expectedCode??s.expectedProblemCode??s.errorCode);return firstSuccessStatus(op);}
function responseSchemaFor(op,status){const response=op.responses[String(status)]??op.responses.default;if(!response)throw new Error(`${op.operationId}: response ${status} absent from OpenAPI`);return response.content?.['application/json']?.schema??response.content?.['application/problem+json']?.schema;}
const statusByCode={AUTHENTICATION_REQUIRED:401,INVALID_CREDENTIALS:401,ACCOUNT_SUSPENDED:403,EMAIL_NOT_VERIFIED:403,MFA_INVALID:422,MFA_EXPIRED:409,MFA_LOCKED:409,SESSION_EXPIRED:401,SESSION_REVOKED:401,TOKEN_INVALID:422,TOKEN_EXPIRED:409,INVITATION_INVALID:422,ACCOUNT_ALREADY_EXISTS:409,PASSWORD_POLICY_VIOLATION:422,RATE_LIMITED:429,WORKSPACE_MISMATCH:403,VERSION_CONFLICT:412,RESOURCE_VERSION_CONFLICT:412,IDEMPOTENCY_KEY_REUSED:409,VALIDATION_FAILED:422,CONTRACT_VIOLATION:400,QUOTE_ORDER_ALREADY_CONVERTED:409,QUOTE_ORDER_CONVERSION_BLOCKED:422,CREDIT_APPROVAL_BINDING_MISMATCH:409,CREDIT_APPROVAL_ALREADY_CONSUMED:409,ORDER_DRAFT_SOURCE_QUOTE_NOT_ALLOWED:422,ORDER_DRAFT_PRICING_INVALID:422,DUPLICATE_BUSINESS_KEY:409,SUPPORT_CASE_INVALID_TRANSITION:409,TASK_INVALID_TRANSITION:409,TASK_OUTCOME_REQUIRED:422,TASK_CANCELLATION_REASON_REQUIRED:422,LEAD_INVALID_TRANSITION:409,LEAD_PROGRESSIVE_PROFILE_INCOMPLETE:422,LEAD_DISQUALIFICATION_EVIDENCE_REQUIRED:422,LEAD_REOPEN_NOT_ALLOWED:409,ORDER_CANCELLATION_BLOCKED:409,CREDIT_APPROVAL_REQUIRED:409,RETURN_CREDIT_EXCEEDS_ISSUED_INVOICE_VALUE:422,RETURN_REFUND_EXCEEDS_EFFECTIVE_PAYMENT_ALLOCATIONS:422,RETURN_CUSTOMER_CREDIT_POLICY_REQUIRED:409,RETURN_STATE_CONFLICT:409,RETURN_INELIGIBLE_OVERRIDE_REQUIRED:422,RETURN_QUANTITY_EXCEEDS_REMAINING:422,RETURN_DELIVERY_EVIDENCE_REQUIRED:409,RETURN_RESOLUTION_EVIDENCE_REQUIRED:409,RETURN_SAGA_MANUAL_REVIEW_REQUIRED:409,SHIPPING_BOOKING_STATE_CONFLICT:409,SHIPPING_PROVIDER_UNAVAILABLE:503,SHIPPING_PROVIDER_REJECTED:422,SHIPPING_PROVIDER_TIMEOUT:503,SHIPPING_PROVIDER_RATE_LIMITED:429,SHIPPING_PROVIDER_AUTHENTICATION_FAILED:503,SHIPPING_PROVIDER_RESPONSE_INVALID:503,REFUND_CANCELLATION_PENDING:409,REFUND_CANCELLATION_NOT_SUPPORTED:422,REFUND_RETRY_NOT_ALLOWED:409};
function statusForCode(code){return statusByCode[code]??409;}function codeForStatus(status){return status===403?'WORKSPACE_MISMATCH':status===412?'VERSION_CONFLICT':status===422?'VALIDATION_FAILED':status===400?'CONTRACT_VIOLATION':'LIFECYCLE_CONFLICT';}
async function readBody(req){const chunks=[];for await(const c of req)chunks.push(c);if(!chunks.length)return undefined;return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
function problem(res,status,code,detail){json(res,status,{type:`https://errors.unicore.example/${code}`,title:code,status,code,detail,correlationId:`reference-${crypto.randomUUID()}`,retryable:false});}
function json(res,status,body){res.statusCode=status;res.setHeader('content-type',status>=400?'application/problem+json':'application/json');res.end(JSON.stringify(body));}
