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
const { loadAccessGovernance, EffectiveRecordAccessBoundary } = await import("@/platform/access-control");
await loadAccessGovernance(workspace.getWorkspaceContextSnapshot().workspaceId);
const React = await import("react");
const { act } = React;
const { createRoot } = await import("react-dom/client");

const { I18nProvider } = await import("@/i18n");
const { PlatformStateProvider } = await import("@/app/providers");
const { GuidanceProvider } = await import("@/guidance/presentation/GuidanceProvider");




const { ProductPickerModal } = await import('@/modules/products/presentation/components/ProductPickerModal');
const { toInitialQuoteProductSelection } = await import('@/modules/quotes/presentation/components/QuoteBuilderProductPicker');
const { MemoryRouter } = await import('react-router-dom');
type Product = import('@/modules/products/domain/model/product.types').Product;
const A: Product = {id:'a',sku:'A',name:'Same name',type:'service',status:'active',category:'',unit:'Lần',listPrice:100,currency:'VND',taxRate:0,taxMode:'none',billingCycle:'one_time',isSubscription:false,isRenewable:false,tags:[],createdAt:'2026-11-01',updatedAt:'2026-11-01',resourceVersion:1,unitPrice:{amount:'100',currency:'VND'}};
const B: Product={...A,id:'b',sku:'B',currency:'USD'};
const archived: Product={...A,id:'archived',status:'archived'};
const initialLine={id:'line',productId:'missing',productNameSnapshot:'Same name',unitPriceSnapshot:80,quantity:2,discountPercent:5};
assert.equal(toInitialQuoteProductSelection([A],[initialLine]).length,0,'Names cannot bind a historical Product');
assert.equal(toInitialQuoteProductSelection([A],[{...initialLine,productId:'a'}])[0]?.quantity,2);
let mode:'interest'|'commercial'='interest';let open=true;let products=[A,B,archived];const applied:unknown[]=[];
const root=createRoot(document.getElementById('root')!);
async function render(){await act(async()=>root.render(React.createElement(MemoryRouter,null,React.createElement(I18nProvider,null,React.createElement(PlatformStateProvider,null,React.createElement(GuidanceProvider,null,React.createElement(ProductPickerModal,{id:'test-picker',isOpen:open,onClose:()=>{open=false;},onApply:items=>applied.push(items),products,mode,currency:'VND',catalogPriceOnly:true})))))));}
async function click(text:string){const b=[...document.querySelectorAll<HTMLButtonElement>('button')].find(x=>x.textContent?.trim()===text);assert.ok(b,text);await act(async()=>b.click());}
try {
await render();let row=document.getElementById('picker-product-b') as HTMLButtonElement;assert.equal(row.disabled,false,'Interest may reference products without converting currency');
await act(async()=>row.click());products=[...products,{...A,id:'next'}];await render();assert.equal(document.getElementById('picker-product-b')?.getAttribute('aria-pressed'),'true','Catalog page updates preserve selection');
assert.equal((document.getElementById('picker-product-archived') as HTMLButtonElement).disabled,true);
await click('Hủy');await render();assert.equal(applied.length,0,'Cancel does not publish selection');open=true;mode='commercial';await render();assert.equal((document.getElementById('picker-product-b') as HTMLButtonElement).disabled,true,'Commercial currency mismatch blocked');
assert.equal(document.getElementById('picker-product-a')?.getAttribute('aria-pressed'),'false','Reopen discards canceled draft');await act(async()=>(document.getElementById('picker-product-a') as HTMLButtonElement).click());await click('Áp dụng (1)');assert.equal(applied.length,1);
assert.deepEqual(browserErrors,[]);console.log('PASS ProductPicker interest/commercial, currency, archive, Cancel/Apply, page preservation and historical ID-only binding');
} finally {await act(async()=>root.unmount());window.close();}
