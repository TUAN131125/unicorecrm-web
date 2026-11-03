import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import type { AuthoritativePage } from "../../src/shared/application";
import type { ServerPagedCollectionState } from "../../src/shared/operations/useServerPagedCollection";

const dom=new JSDOM('<div id="root"></div>',{url:"http://localhost",pretendToBeVisual:true});
for(const key of ["window","document","navigator","HTMLElement","Node","Event"] as const)
  Object.defineProperty(globalThis,key,{value:key==="window"?dom.window:dom.window[key],configurable:true});
Object.defineProperty(globalThis,"IS_REACT_ACT_ENVIRONMENT",{value:true,configurable:true});
const React=await import("react"),{act}=React;
const {createRoot}=await import("react-dom/client");
const {useServerPagedCollection}=await import("../../src/shared/operations/useServerPagedCollection");
const {useListSearchInput}=await import("../../src/components/crm/useListSearchInput");
const {ApplicationError}=await import("../../src/shared/domain");
type Row={id:string};
const requests:{signal:AbortSignal;resolve:(p:AuthoritativePage<Row>)=>void;reject:(e:unknown)=>void}[]=[];
const loadPage=(_query:unknown,signal:AbortSignal)=>new Promise<AuthoritativePage<Row>>((resolve,reject)=>requests.push({signal,resolve,reject}));
const project=()=>{};
let scope="ws-a:permission-1",search="",enabled=true;
let state:ServerPagedCollectionState<Row>|undefined;
function Harness(){state=useServerPagedCollection({connected:true,scopeKey:scope,query:{search},enabled,loadPage,project,errorCodePrefix:"TEST"});return null;}
const current=()=>{assert.ok(state);return state;};
const request=(i:number)=>{const r=requests[i];assert.ok(r);return r;};
const page=(id:string):AuthoritativePage<Row>=>({items:[{id}],pageInfo:{hasNextPage:false,totalCount:1},authority:"backend",loadedAt:new Date().toISOString()});
const node=document.getElementById("root");assert.ok(node);let root=createRoot(node);
const render=()=>act(async()=>{root.render(React.createElement(Harness));});
try{
 await render();await act(async()=>request(0).resolve(page("old")));
 search="new";await render();assert.equal(current().items[0]?.id,"old");assert.equal(current().refreshing,true);
 search="newer";await render();assert.equal(request(1).signal.aborted,true);
 await act(async()=>{request(2).resolve(page("newest"));request(1).resolve(page("late-old-response"));});
 assert.equal(current().items[0]?.id,"newest","late old response cannot overwrite new data");
 scope="ws-b:permission-2";await render();assert.equal(current().items.length,0,"evict synchronously on authority change");
 await act(async()=>request(3).resolve(page("b")));
 search="fail";await render();await act(async()=>request(4).reject(new ApplicationError({code:"NETWORK_REQUEST_FAILED",category:"NETWORK",message:"offline"})));
 assert.equal(current().items[0]?.id,"b","same-scope transient error keeps safe rows");
 search="denied";await render();await act(async()=>request(5).reject(new ApplicationError({code:"ACCESS_DENIED",category:"AUTHORIZATION",message:"denied"})));
 assert.equal(current().items.length,0,"authorization denial evicts previous rows");
 search="unmount";await render();enabled=false;await render();assert.equal(request(6).signal.aborted,true);assert.equal(current().items.length,0);
 await act(async()=>root.unmount());root=createRoot(node);
 const emitted:string[]=[];let input:ReturnType<typeof useListSearchInput>|undefined;
 function Search(){input=useListSearchInput("",v=>emitted.push(v),false);return null;}
 const active=()=>{assert.ok(input);return input;};
 await act(async()=>root.render(React.createElement(Search)));
 await act(async()=>{active().change("a");active().change("abcd");});assert.deepEqual(emitted,[]);
 await act(async()=>new Promise(r=>setTimeout(r,350)));assert.deepEqual(emitted,["abcd"]);
 await act(async()=>{active().compositionStart();active().change("Nguy");});
 await act(async()=>new Promise(r=>setTimeout(r,350)));assert.equal(emitted.length,1);
 await act(async()=>active().compositionEnd("Nguyễn"));await act(async()=>new Promise(r=>setTimeout(r,350)));assert.equal(emitted.at(-1),"Nguyễn");
 await act(async()=>active().change(""));assert.equal(emitted.at(-1),"");
 await act(async()=>{active().change("enter");active().submit("enter",false);});assert.equal(emitted.at(-1),"enter");
 await act(async()=>active().change("never after unmount"));const count=emitted.length;
 await act(async()=>root.unmount());await new Promise(r=>setTimeout(r,350));assert.equal(emitted.length,count);
 console.log("PASS query scope eviction, same-scope retention, cancellation, stale-response defense, denied eviction, debounce, IME, Enter, clear and timer cleanup");
}finally{dom.window.close();}
