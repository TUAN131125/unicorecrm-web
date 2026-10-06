import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "http://localhost", pretendToBeVisual: true });
const { window } = dom;
const browserErrors: unknown[] = [];
window.addEventListener("error", event => browserErrors.push(event.error));
Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", { value() {}, configurable: true });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "SVGElement", "Element", "Node", "Event", "CustomEvent", "EventTarget", "MutationObserver"] as const) {
  Object.defineProperty(globalThis, key, { value: key === "window" ? window : window[key], configurable: true });
}
Object.defineProperties(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: { value: true, configurable: true },
  getComputedStyle: { value: window.getComputedStyle.bind(window), configurable: true },
  requestAnimationFrame: { value: window.requestAnimationFrame.bind(window), configurable: true },
  cancelAnimationFrame: { value: window.cancelAnimationFrame.bind(window), configurable: true },
  ResizeObserver: { value: class { observe() {} unobserve() {} disconnect() {} }, configurable: true },
});
Object.defineProperty(window, "matchMedia", { value: () => ({ matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) });
const { signIn } = await import("@/platform/identity-auth");
assert.equal(signIn({ email: "admin@unicorecrm.local", password: "admin123" }).ok, true);
const { initializeApplicationComposition } = await import("@/app/composition");
await initializeApplicationComposition({ mode: "demo" });
const workspace = await import("@/platform/workspace-context");
const { loadAccessGovernance } = await import("@/platform/access-control");
await loadAccessGovernance(workspace.getWorkspaceContextSnapshot().workspaceId);
const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");
const { Routes, Route } = await import("react-router-dom");
const { I18nProvider } = await import("@/i18n");
const { PlatformStateProvider } = await import("@/app/providers");
const { GuidanceProvider } = await import("@/guidance/presentation/GuidanceProvider");



const { ProductFormModal } = await import('@/modules/products/presentation/components/ProductFormModal');
const { DealFormModal } = await import('@/modules/deals/presentation/components/DealFormModal');
const { getDirtyUnsavedWork, discardDirtyUnsavedWork, saveDirtyUnsavedWork } = await import('@/platform/unsaved-work');
const { ApplicationError } = await import('@/shared/domain');
const { MemoryRouter } = await import('react-router-dom');
type Product = import('@/modules/products/domain/model/product.types').Product;
type Deal = import('@/modules/deals/domain/model/deal.types').Deal;
type Draft = import('@/modules/deals/presentation/components/DealFormModal').DealFormDraft;
const A: Product = { id:'product-A', sku:'A', name:'A product', type:'service', status:'active', category:'', unit:'Tháng', listPrice:100, currency:'VND', taxRate:0, taxMode:'none', billingCycle:'one_time', isSubscription:false, isRenewable:false, tags:[], createdAt:'2026-07-01', updatedAt:'2026-07-01', resourceVersion:3 };
const B: Product = {...A,id:'product-B',sku:'B',name:'B product',resourceVersion:9};
const dealA: Deal = { id:'deal-A',name:'A opportunity',stage:'DISCOVERY',amount:100,currency:'VND',ownerId:'u1',buyerRef:{type:'CONTACT',id:'contact-A'},expectedCloseDate:'2026-08-01',interestedProducts:[],opportunityScore:10,createdAt:'2026-07-01',updatedAt:'2026-07-01',lineItems:[],activities:[],resourceVersion:4 };
const dealB: Deal = {...dealA,id:'deal-B',name:'B opportunity',resourceVersion:8};
let sourceKey:string|undefined; let dealMode:'create'|'edit'='edit';
let productBoundary=false;
let product=A; let deal=dealA; let kind:'product'|'deal'='product'; let open=true; let fail=false; let hold=false; let release:(()=>void)|undefined;
const productCalls: Array<{ data:Partial<Product>; opening:Product|null }> = [];
const dealCalls: Array<{ draft:Draft; opening:Deal|null;sourceKey?:string }> = [];
async function respond() { if(hold) await new Promise<void>(resolve=>{release=resolve;}); if(fail) throw new ApplicationError({code:'FIELDS',message:'private diagnostics',category:'VALIDATION',fieldErrors:{name:['Correct name']}}); return true; }
function Probe() { return kind==='product' ? React.createElement(ProductFormModal,{id:'proof-product',isOpen:open,product,existingProducts:[A,B],onClose:()=>{open=false;renderNow();},onSubmit:async(data,opening,intentId)=>{productCalls.push({data,opening});if(productBoundary){const {saveProductCommand}=await import('@/modules/products/public/catalog');await saveProductCommand(data,{idempotencyKey:intentId});return true;}return respond();}}) : React.createElement(DealFormModal,{isOpen:open,mode:dealMode,sourceKey,target:dealMode==='edit'?deal:null,initialValues:{name:deal.name,customerName:sourceKey==='source-B'?'Customer B':'Customer A',ownerId:'u1',demandSummary:'Customer need'},owners:[{memberId:'u1',displayName:'Admin'}],stages:[{id:'stage-discovery',color:'purple',createdAt:'2026-07-01',updatedAt:'2026-07-01',code:'DISCOVERY',labelVi:'Khám phá',labelEn:'Discovery',category:'open',order:1,isActive:true,probabilityDefault:10}],productsEnabled:false,onClose:()=>{open=false;renderNow();},onSubmit:async(draft,opening,_intentId,openingSourceKey)=>{dealCalls.push({draft,opening,sourceKey:openingSourceKey});return respond();}}); }
const element=document.getElementById('root');assert.ok(element);const root=createRoot(element);
function renderNow() { root.render(React.createElement(MemoryRouter,null,React.createElement(I18nProvider,null,React.createElement(PlatformStateProvider,null,React.createElement(GuidanceProvider,null,React.createElement(Probe)))))); }
const settle=async()=>act(async()=>{await new Promise(resolve=>setTimeout(resolve,70));});
async function render(){await act(async()=>renderNow());await settle();}
async function change(id:string,value:string){const input=document.getElementById(id);assert.ok(input instanceof window.HTMLInputElement,id);await act(async()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value')?.set?.call(input,value);input.dispatchEvent(new window.Event('input',{bubbles:true}));});await settle();}
async function click(text:string){const button=[...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.trim()===text);assert.ok(button,text);await act(async()=>button.click());await settle();}
function entry(){const entries=getDirtyUnsavedWork();assert.equal(entries.length,1);const e=entries[0];assert.ok(e);return e;}
async function productSubmit(){const button=document.getElementById('btn-save-form');assert.ok(button instanceof window.HTMLButtonElement);await act(async()=>{button.click();button.click();});await settle();}
async function dealSubmit(){const form=document.getElementById('deal-edit-form');assert.ok(form);await act(async()=>{form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));});await settle();}
try{
 await render();assert.equal(getDirtyUnsavedWork().length,0);
 await change('form-name','Changed A');entry();await change('form-name','A product');assert.equal(getDirtyUnsavedWork().length,0);
 await change('form-name','Changed A');product={...A,name:'A refreshed',resourceVersion:7};await render();assert.equal(document.querySelector<HTMLInputElement>('#form-name')?.value,'Changed A');
 product=B;await render();assert.equal(document.querySelector('[data-product-target-id]')?.getAttribute('data-product-target-id'),A.id);
 await click('Hủy');await click('Tiếp tục chỉnh sửa');assert.equal(document.querySelector<HTMLInputElement>('#form-name')?.value,'Changed A');
 hold=true;fail=true;await productSubmit();assert.equal(productCalls.length,1);assert.equal(productCalls[0]?.opening?.id,A.id);assert.equal(productCalls[0]?.opening?.resourceVersion,3);assert.equal(discardDirtyUnsavedWork(),false);
 assert.ok(release);await act(async()=>release?.());await settle();hold=false;assert.equal(document.activeElement?.id,'form-name');assert.ok(document.body.textContent?.includes('Correct name'));entry();
 const staleProduct=entry();await act(async()=>{assert.equal(discardDirtyUnsavedWork(),true);});await settle();open=true;await render();assert.equal(document.querySelector<HTMLInputElement>('#form-name')?.value,'B product');assert.equal(await staleProduct.save(),false);assert.equal(productCalls.length,1);
 fail=false;await change('form-name','Changed B');await act(async()=>{assert.equal(await saveDirtyUnsavedWork(),true);});await settle();assert.equal(productCalls.length,2);assert.equal(productCalls[1]?.opening?.id,B.id);assert.equal(open,false);
 kind='deal';open=true;await render();assert.equal(getDirtyUnsavedWork().length,0);await change('deal-edit-name','Changed A');entry();await change('deal-edit-name','A opportunity');assert.equal(getDirtyUnsavedWork().length,0);
 await change('deal-edit-name','Changed A');deal={...dealA,name:'A refresh',resourceVersion:10};await render();deal=dealB;await render();assert.equal(document.querySelector('[data-deal-target-id]')?.getAttribute('data-deal-target-id'),dealA.id);
 hold=true;fail=true;await dealSubmit();assert.equal(dealCalls.length,1);assert.equal(dealCalls[0]?.opening?.id,dealA.id);assert.equal(dealCalls[0]?.opening?.resourceVersion,4);assert.equal(discardDirtyUnsavedWork(),false);
 assert.ok(release);await act(async()=>release?.());await settle();hold=false;assert.equal(document.activeElement?.id,'deal-edit-name');assert.ok(document.body.textContent?.includes('Correct name'));entry();
 const staleDeal=entry();await act(async()=>{assert.equal(discardDirtyUnsavedWork(),true);});await settle();open=true;await render();assert.equal(document.querySelector<HTMLInputElement>('#deal-edit-name')?.value,'B opportunity');assert.equal(await staleDeal.save(),false);assert.equal(dealCalls.length,1);
 await change('deal-edit-name','');await dealSubmit();assert.equal(dealCalls.length,1);assert.equal(document.activeElement?.id,'deal-edit-name');
 await change('deal-edit-name','Changed B');fail=false;await act(async()=>{assert.equal(await saveDirtyUnsavedWork(),true);});await settle();assert.equal(dealCalls[1]?.opening?.id,dealB.id);assert.equal(open,false);

 // Forced external close/reopen during a pending A submit cannot close B on late completion.
 kind='product';product=A;open=true;await render();await change('form-name','Late A');hold=true;fail=false;await productSubmit();
 open=false;await render();product=B;open=true;await render();assert.ok(release);await act(async()=>release?.());await settle();hold=false;
 assert.equal(open,true);assert.equal(document.querySelector<HTMLInputElement>('#form-name')?.value,'B product');assert.equal(getDirtyUnsavedWork().length,0);
 open=false;await render();

 // Contextual create source: reference refresh preserves; only clean source changes reinitialize.
 kind='deal';dealMode='create';sourceKey='source-A';deal=dealA;open=true;await render();
 await change('deal-create-name','Source A draft');sourceKey='source-B';await render();
 assert.equal(document.querySelector('[data-deal-source-key]')?.getAttribute('data-deal-source-key'),'source-A');
 assert.equal(document.querySelector<HTMLInputElement>('#deal-create-customerName')?.value,'Customer A');
 await act(async()=>{assert.equal(discardDirtyUnsavedWork(),true);});await settle();open=true;await render();
 assert.equal(document.querySelector<HTMLInputElement>('#deal-create-customerName')?.value,'Customer B');
 assert.equal(getDirtyUnsavedWork().length,0);open=false;await render();dealMode='edit';sourceKey=undefined;
 // Real application port: the Product version is resolved for bound A, never the screen B.
 const productServices = await import('@/modules/products/application/composition/productApplicationServices');
 const productPublic = await import('@/modules/products/public/catalog');
 const originalProductServices = productServices.getProductApplicationServices();
 const productPortCalls: Array<{id:string;version:number;amount:string;key:string}> = [];
 productPublic.replaceProductCatalog([{...A,resourceVersion:7}, B]);
 productServices.configureProductApplication({...originalProductServices,api:{...originalProductServices.api,commands:{...originalProductServices.api.commands,
   replace: async(id,input,options)=>{productPortCalls.push({id,version:options.expectedVersion,amount:input.unitPrice.amount,key:options.idempotencyKey});return originalProductServices.api.commands.replace(id,input,options);},
 }}});
 kind='product';product=A;open=true;await render();await change('form-list-price','250');
 const callbackProduct=productCalls.length;
 // Replace the form callback with its actual public boundary via a separate mode flag.
 productBoundary=true;product=B;await render();await productSubmit();productBoundary=false;
 assert.equal(productCalls.length,callbackProduct+1);assert.equal(productPortCalls.length,1);assert.equal(productPortCalls[0]?.id,A.id);assert.equal(productPortCalls[0]?.version,7);assert.equal(productPortCalls[0]?.amount,'250');assert.ok(productPortCalls[0]?.key.startsWith('product-form'));
 productServices.configureProductApplication(originalProductServices);

 // Real Deal detail controller + LOST form + public command interception.
 const dealServices=await import('@/modules/deals/application/composition/dealApplicationServices');
 const dealPublic=await import('@/modules/deals/public/deals');
 const {useDealDetailController}=await import('@/modules/deals/presentation/hooks/useDealDetailController');
 const {DealDetailDialogs}=await import('@/modules/deals/presentation/views/DealDetailDialogs');
 const {createMemoryRouter,RouterProvider}=await import('react-router-dom');
 const originalDealServices=dealServices.getDealApplicationServices();
 dealPublic.replaceDeals([dealA,dealB]);
 const lostCalls:Array<{id:string;version:number;reason:string}> = [];
 let releaseLost:(()=>void)|undefined;let failLost=true;
 dealServices.configureDealApplication({...originalDealServices,api:{...originalDealServices.api,commands:{...originalDealServices.api.commands,
   markDealLost:async(id,input,options)=>{lostCalls.push({id,version:options.expectedVersion,reason:input.reason});await new Promise<void>(resolve=>{releaseLost=resolve;});if(failLost)throw new ApplicationError({code:'CONFLICT',category:'CONFLICT',message:'private conflict'});return originalDealServices.api.commands.markDealLost(id,input,options);},
 }}});
 const detailState: {current:ReturnType<typeof useDealDetailController>} = {current:null};
 function DetailProbe(){detailState.current=useDealDetailController({customers:[],setCustomers:()=>{},contacts:[]});return detailState.current?React.createElement(DealDetailDialogs,{controller:detailState.current,productCatalog:[]}):null;}
 const detailRouter=createMemoryRouter([{path:'/deals/:dealId',element:React.createElement(I18nProvider,null,React.createElement(PlatformStateProvider,null,React.createElement(GuidanceProvider,null,React.createElement(DetailProbe))))}],{initialEntries:['/deals/deal-A']});
 const detailElement=document.createElement('div');document.body.append(detailElement);const detailRoot=createRoot(detailElement);
 await act(async()=>detailRoot.render(React.createElement(RouterProvider,{router:detailRouter})));await settle();assert.ok(detailState.current);
 await act(async()=>detailState.current?.setIsLostModalOpen(true));await settle();await act(async()=>{detailState.current?.setLostReason('NO_BUDGET');detailState.current?.setLostNotes('A draft');});await settle();entry();
 await act(async()=>{void detailRouter.navigate('/deals/deal-B');});await settle();assert.equal(detailState.current?.deal.id,dealA.id);assert.equal(detailState.current?.lostNotes,'A draft');
 await act(async()=>dealPublic.replaceDeals([{...dealA,resourceVersion:12},dealB]));await settle();assert.equal(detailState.current?.lostNotes,'A draft');
 let pendingLost:Promise<boolean>|undefined;await act(async()=>{pendingLost=detailState.current?.handleConfirmLost();void detailState.current?.handleConfirmLost();});await settle();assert.equal(lostCalls.length,1);assert.deepEqual(lostCalls[0],{id:dealA.id,version:12,reason:'NO_BUDGET'});assert.equal(discardDirtyUnsavedWork(),false);
 assert.ok(releaseLost);await act(async()=>releaseLost?.());await pendingLost;await settle();assert.equal(detailState.current?.deal.id,dealA.id);assert.equal(detailState.current?.lostNotes,'A draft');assert.ok(detailState.current?.lostError);entry();
 await act(async()=>{assert.equal(discardDirtyUnsavedWork(),true);});await settle();await act(async()=>detailState.current?.setIsLostModalOpen(true));await settle();assert.equal(detailState.current?.deal.id,dealB.id);assert.equal(detailState.current?.lostReason,'');assert.equal(detailState.current?.lostNotes,'');assert.equal(getDirtyUnsavedWork().length,0);
 await act(async()=>detailRoot.unmount());detailRouter.dispose();dealServices.configureDealApplication(originalDealServices);


 // Product CSV import uses the actual list-controller registry and demo application projection.
 const {useProductListController}=await import('@/modules/products/presentation/hooks/useProductListController');
 const importState:{current:ReturnType<typeof useProductListController>|null}={current:null};
 function ImportProbe(){importState.current=useProductListController({});return null;}
 const importElement=document.createElement('div');document.body.append(importElement);const importRoot=createRoot(importElement);
 await act(async()=>importRoot.render(React.createElement(I18nProvider,null,React.createElement(PlatformStateProvider,null,React.createElement(ImportProbe)))));await settle();assert.ok(importState.current);
 await act(async()=>{importState.current?.setIsImportModalOpen(true);importState.current?.setPastedCsvData('not CSV');});await settle();const staleImport=entry();
 await act(async()=>{assert.equal(await saveDirtyUnsavedWork(),false);});await settle();assert.equal(importState.current?.pastedCsvData,'not CSV');entry();
 await act(async()=>{assert.equal(discardDirtyUnsavedWork(),true);});await settle();assert.equal(importState.current?.pastedCsvData,'');
 await act(async()=>{importState.current?.setIsImportModalOpen(true);importState.current?.setPastedCsvData('sku,name,type,listPrice\nPROOF-CSV,Imported product,service,200');});await settle();assert.equal(await staleImport.save(),false);entry();
 await act(async()=>{assert.equal(await saveDirtyUnsavedWork(),true);});await settle();assert.equal(importState.current?.isImportModalOpen,false);assert.ok(productPublic.getProductCatalogSnapshot().some(p=>p.sku==='PROOF-CSV'));
 await act(async()=>importRoot.unmount());


 // Actual workspace runtime: clean forms close, dirty forms retain opening scope and refuse Save.
 const originalWorkspace=workspace.getWorkspaceContextSnapshot();
 const alternateWorkspace=workspace.listWorkspaceMemberships().find(w=>w.status==='active'&&w.workspaceKey!==originalWorkspace.workspaceKey);assert.ok(alternateWorkspace);
 kind='product';product=A;open=true;await render();assert.equal(getDirtyUnsavedWork().length,0);
 await act(async()=>{await workspace.switchWorkspaceContext(alternateWorkspace.workspaceKey);});await settle();assert.equal(open,false);
 await act(async()=>{await workspace.switchWorkspaceContext(originalWorkspace.workspaceKey);});await settle();
 open=true;await render();await change('form-name','Workspace A draft');const productCount=productCalls.length;
 await act(async()=>{await workspace.switchWorkspaceContext(alternateWorkspace.workspaceKey);});await settle();assert.equal(open,true);assert.equal(await entry().save(),false);await productSubmit();assert.equal(productCalls.length,productCount);assert.equal(document.querySelector<HTMLInputElement>('#form-name')?.value,'Workspace A draft');
 await act(async()=>{assert.equal(discardDirtyUnsavedWork(),true);await workspace.switchWorkspaceContext(originalWorkspace.workspaceKey);});await settle();
 kind='deal';deal=dealA;open=true;await render();assert.equal(getDirtyUnsavedWork().length,0);
 await act(async()=>{await workspace.switchWorkspaceContext(alternateWorkspace.workspaceKey);});await settle();assert.equal(open,false);
 await act(async()=>{await workspace.switchWorkspaceContext(originalWorkspace.workspaceKey);});await settle();open=true;await render();await change('deal-edit-name','Workspace A deal');const dealCount=dealCalls.length;
 await act(async()=>{await workspace.switchWorkspaceContext(alternateWorkspace.workspaceKey);});await settle();assert.equal(open,true);assert.equal(await entry().save(),false);await dealSubmit();assert.equal(dealCalls.length,dealCount);
 await act(async()=>{assert.equal(discardDirtyUnsavedWork(),true);await workspace.switchWorkspaceContext(originalWorkspace.workspaceKey);});await settle();

 assert.deepEqual(browserErrors,[]);
 console.log('B2 Deal/Product real form PASS: snapshot A/version, refresh, dirty/revert, target switch, keep/discard, global registration, pending veto, duplicate block, server field/focus, retry and truthful programmatic save.');
}finally{await act(async()=>root.unmount());window.close();}
