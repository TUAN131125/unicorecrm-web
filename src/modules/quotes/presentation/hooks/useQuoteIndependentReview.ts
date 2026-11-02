import { useEffect,useRef,useState } from "react";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { quoteReview,type ReviewView,type ReviewDecision,type ReviewInput } from "../../public/review";
export function useQuoteIndependentReview(q:string,c:string,w:string,sourceEpoch:string|undefined){
 const [view,setView]=useState<ReviewView|null>(null);const [history,setHistory]=useState<ReviewDecision[]>([]);const [cursor,setCursor]=useState<string>();const [current,setCurrent]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState<unknown>(null);
 const control=useRef<AbortController|null>(null);const mounted=useRef(true);const keys=useRef(new Map<string,string>());
 const active=(a:AbortController)=>mounted.current&&!a.signal.aborted&&w===getWorkspaceContextSnapshot().workspaceId;
 const begin=()=>{control.current?.abort();const a=new AbortController();control.current=a;setBusy(true);setError(null);return a;};
 const refresh=async()=>{setCurrent(false);const a=begin();try{const [v,h]=await Promise.all([quoteReview().read(q,c,a.signal),quoteReview().history(q,c,undefined,a.signal)]);if(active(a)){setView(v);setHistory(h.items);setCursor(h.nextCursor);setCurrent(true);}}catch(e){if(active(a))setError(e);}finally{if(active(a))setBusy(false);}};
 useEffect(()=>{mounted.current=true;setView(null);setHistory([]);setCurrent(false);keys.current.clear();if(sourceEpoch)void refresh();return()=>{mounted.current=false;control.current?.abort();};},[q,c,w,sourceEpoch]);
 const submit=async(input:ReviewInput)=>{if(busy||!view||!current)return false;setCurrent(false);const a=begin();const signature=JSON.stringify([input,view.resourceVersion]);let key=keys.current.get(signature);if(!key){key=crypto.randomUUID();keys.current.set(signature,key);}try{await quoteReview().submit(q,c,input,{expectedVersion:view.resourceVersion,idempotencyKey:key,signal:a.signal});if(active(a)){const [v,h]=await Promise.all([quoteReview().read(q,c,a.signal),quoteReview().history(q,c,undefined,a.signal)]);if(active(a)){setView(v);setHistory(h.items);setCursor(h.nextCursor);setCurrent(true);return true;}}return false;}catch(e){if(active(a))setError(e);return false;}finally{if(active(a))setBusy(false);}};
 const more=async()=>{if(!cursor||busy)return;const a=begin();try{const h=await quoteReview().history(q,c,cursor,a.signal);if(active(a)){setHistory(old=>[...old,...h.items]);setCursor(h.nextCursor);}}catch(e){if(active(a)){setCurrent(false);setError(e);}}finally{if(active(a))setBusy(false);}};
 return {view,history,cursor,current,busy,error,refresh,submit,more};
}
