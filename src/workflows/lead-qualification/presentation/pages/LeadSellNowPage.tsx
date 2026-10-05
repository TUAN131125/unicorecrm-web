import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTargetBoundWorkflow } from "@/shared/presentation/useTargetBoundWorkflow";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, PackageCheck, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Button, Input, Select } from "@/shared/components/ui";
import { getContactsSnapshot, subscribeToContacts, type Contact } from "@/modules/contacts";
import { getLeadSnapshot, LeadWorkState, subscribeToLeads, type Lead } from "@/modules/leads";
import { getOrganizationAccountsSnapshot, subscribeToOrganizationAccounts, type OrganizationAccount } from "@/modules/organizations";
import {
  getProductCatalogSnapshot,
  ProductPickerModal,
  subscribeToProductCatalog,
  type Product,
  type SelectedPickerItem,
} from "@/modules/products";
import { useEffectiveAccess } from "@/platform/access-control";
import { useWorkspaceConfigSnapshot, useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import { useI18n } from "@/i18n";
import { formatVnd } from "@/shared/lib/format/currency";
import { formatApplicationError } from "@/shared/operations";
import { executeLeadDirectSaleCommand } from "../../public/leadQualification";
import type { LeadRelationshipInput } from "../../domain/leadQualification.types";
import { RelationshipResolutionFields } from "../components/RelationshipResolutionFields";

function createRelationshipInput(lead: Lead): LeadRelationshipInput {
  return {
    kind: lead.companyName?.trim() ? "ORGANIZATION_ACCOUNT" : "CONTACT",
    mode: "NEW",
    contact: { name: lead.name, email: lead.email, phone: lead.phone, title: lead.title },
    organization: {
      displayName: lead.companyName || "",
      phone: lead.companyPhone,
      address: lead.address,
      industry: lead.industry,
    },
  };
}

function leadInterestToSelectedItems(lead: Lead, products: Product[]): SelectedPickerItem[] {
  return (lead.interestedProducts || []).flatMap((interest: any, index) => {
    const productId = typeof interest === "string" ? interest : interest?.productId || interest?.id;
    const product = products.find((item) => item.id === productId);
    if (!product) return [];
    return [{
      product,
      quantity: typeof interest === "object" ? interest?.estimatedQuantity || interest?.quantity || 1 : 1,
      discountPercent: 0,
      customPrice: typeof interest === "object" ? interest?.expectedBudget || product.listPrice : product.listPrice,
      billingCycle: product.billingCycle || "one_time",
      taxMode: product.taxMode || "none",
    } satisfies SelectedPickerItem];
  });
}

export const LeadSellNowPage: React.FC = () => {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const vi = locale === "vi";
  const crmConfig = useWorkspaceConfigSnapshot();
  const operationalConfiguration = useWorkspaceOperationalConfiguration();
  const access = useEffectiveAccess();
  const lifecycle = useTargetBoundWorkflow(leadId, "Lead direct sale");
  const [lead, setLead] = useState<Lead | undefined>(() => lifecycle.targetId ? getLeadSnapshot(lifecycle.targetId) : undefined);
  const [contacts, setContacts] = useState<Contact[]>(() => getContactsSnapshot());
  const [organizations, setOrganizations] = useState<OrganizationAccount[]>(() => getOrganizationAccountsSnapshot());
  const [products, setProducts] = useState<Product[]>(() => getProductCatalogSnapshot());
  const [relationship, setRelationship] = useState<LeadRelationshipInput | null>(() => lead ? createRelationshipInput(lead) : null);
  const [path, setPath] = useState<"QUOTE" | "ORDER">("QUOTE");
  const [title, setTitle] = useState("");
  const [selectedItems, setSelectedItems] = useState<SelectedPickerItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ quoteId?: string; orderId?: string } | null>(null);

  useEffect(() => { const refresh = () => setLead(current => current?.id === lifecycle.targetId ? current : lifecycle.targetId ? getLeadSnapshot(lifecycle.targetId) : undefined); refresh(); return subscribeToLeads(refresh); }, [lifecycle.targetId]);
  useEffect(() => subscribeToContacts(setContacts), []);
  useEffect(() => subscribeToOrganizationAccounts(setOrganizations), []);
  useEffect(() => subscribeToProductCatalog(setProducts), []);

  const quoteEnabled = crmConfig.modules.quotes && crmConfig.workflow.quoteUsageMode !== "DISABLED";
  const orderEnabled = crmConfig.modules.orders !== false;
  const eligible = lead?.leadWorkState === LeadWorkState.VERIFYING;
  const actorCanSellNow = access.canPerform("orders", "create");

  const initialized = useRef<string | undefined>(undefined);
  const canonical = useRef("");
  const fingerprint = JSON.stringify({ relationship, path, title, selectedItems });
  const reset = () => {
    if (!lead || lead.id !== lifecycle.targetId) return;
    const defaults = { relationship: createRelationshipInput(lead), path: quoteEnabled ? "QUOTE" as const : "ORDER" as const,
      title: `${vi ? "Bán trực tiếp" : "Direct Sale"} - ${lead.companyName || lead.name}`,
      selectedItems: leadInterestToSelectedItems(lead, products) };
    canonical.current = JSON.stringify(defaults);
    setRelationship(defaults.relationship); setPath(defaults.path); setTitle(defaults.title); setSelectedItems(defaults.selectedItems);
    setPickerOpen(false); setError(null); setResult(null);
  };
  useEffect(() => {
    const identity = `${lifecycle.targetId}:${lifecycle.cycle}`;
    if (lead && lead.id === lifecycle.targetId && initialized.current !== identity) { initialized.current = identity; reset(); }
    else if (lead && lead.id === lifecycle.targetId && fingerprint === canonical.current && selectedItems.length === 0 && leadInterestToSelectedItems(lead, products).length > 0) {
      // Late catalog availability may initialize untouched defaults, never a user-cleared draft.
      reset();
    }
  });
  const saveRef = useRef<() => Promise<boolean>>(async () => false);
  lifecycle.register(Boolean(canonical.current && fingerprint !== canonical.current && !result), reset, () => saveRef.current());

  const total = useMemo(() => selectedItems.reduce((sum, item) => {
    const unitPrice = item.customPrice ?? item.product.listPrice;
    return sum + unitPrice * item.quantity * (1 - (item.discountPercent || 0) / 100);
  }, 0), [selectedItems]);

  if (!lead) {
    return <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">{vi ? "Không tìm thấy Lead." : "Lead not found."}</div>;
  }

  const execute = async (): Promise<boolean> => {
    if (lead.id !== lifecycle.targetId || !lifecycle.begin()) return false;
    setError(null);
    try {
      if (!relationship) { setError(vi ? "Thiếu buyer relationship." : "Buyer relationship is missing."); return false; }
      const workflowOutcome = await executeLeadDirectSaleCommand({
        leadId: lead.id,
        relationship,
        path,
        quoteEnabled,
        orderEnabled,
        actorCanSellNow,
        currency: operationalConfiguration.localeRegion.currencies.baseCurrency,
        title,
        ownerId: lead.ownerId,
        lineItems: selectedItems.map((item) => ({
          productId: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
          productType: item.product.type,
          description: item.product.description,
          quantity: item.quantity,
          unitPrice: item.customPrice ?? item.product.listPrice,
          taxRate: item.product.taxRate,
          taxMode: item.taxMode || item.product.taxMode || "none",
          billingCycle: item.billingCycle || item.product.billingCycle,
        })),
      });
      if (!lifecycle.isCurrent()) return true;
      setResult({ quoteId: workflowOutcome.data.quoteId, orderId: workflowOutcome.data.orderId });
      return true;
    } catch (caught) {
      if (!lifecycle.isCurrent()) return false;
      // MA-08: the direct-sale workflow refusal is an internal diagnostic; the central
      // formatter decides what the user may see.
      setError(formatApplicationError(caught, { locale }));
      return false;
    } finally { lifecycle.finish(); }
  };

  saveRef.current = execute;

  if (result) {
    return (
      <div className="max-w-3xl mx-auto bg-white border border-emerald-200 rounded-2xl p-8 shadow-sm text-center space-y-5">
        <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center"><PackageCheck size={24} /></div>
        <div>
          <h1 className="text-xl font-black text-slate-900">{vi ? "Direct Sale đã được khởi tạo" : "Direct Sale started"}</h1>
          <p className="text-sm text-slate-500 mt-2">{result.quoteId ? `${vi ? "Đã tạo Quote" : "Quote created"}: ${result.quoteId}` : `${vi ? "Đã tạo Order" : "Order created"}: ${result.orderId}`}</p>
          <p className="text-xs text-slate-500 mt-1">{vi ? "Không có Deal ngầm được tạo." : "No hidden Deal was created."}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="secondary" onClick={() => navigate(`/leads/${lead.id}`)}>{vi ? "Về Lead" : "Back to Lead"}</Button>
          {result.quoteId && <Button variant="primary" onClick={() => navigate(`/quotes/${result.quoteId}`)}>{vi ? "Mở Quote" : "Open Quote"}</Button>}
          {result.orderId && <Button variant="primary" onClick={() => navigate(`/orders/${result.orderId}`)}>{vi ? "Mở Order" : "Open Order"}</Button>}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-xs p-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">{vi ? "Bán trực tiếp" : "Sell Now"}</h1>
          <p className="text-slate-500 mt-1">{lead.name} · {lead.companyName || (vi ? "Cá nhân" : "Individual")}</p>
        </div>
        <Button variant="secondary" size="sm" icon={<ArrowLeft size={13} />} onClick={() => navigate(`/leads/${lead.id}/qualify`)}>{vi ? "Quay lại" : "Back"}</Button>
      </div>

      {!eligible && <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 font-semibold">{vi ? "Lead phải ở bước Đang xác minh trước khi Bán trực tiếp." : "Lead must be in Verifying before Sell Now."}</div>}
      {!actorCanSellNow && <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 font-semibold">{vi ? "Vai trò hiện tại không có quyền tạo giao dịch Bán trực tiếp." : "The current role is not permitted to create a Sell Now transaction."}</div>}

      <fieldset disabled={lifecycle.pending} className="bg-white rounded-xl border border-slate-200 p-6 space-y-6 shadow-sm">
        {relationship && <RelationshipResolutionFields value={relationship} onChange={setRelationship} contacts={contacts} organizations={organizations} locale={locale} />}

        <div className="pt-5 border-t border-slate-100 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label={vi ? "Đường giao dịch" : "Transaction path"} value={path} onChange={(event) => setPath(event.target.value as "QUOTE" | "ORDER")}>
              {quoteEnabled && <option value="QUOTE">{vi ? "Tạo Quote" : "Create Quote"}</option>}
              {orderEnabled && <option value="ORDER">{vi ? "Tạo Order trực tiếp" : "Create Order directly"}</option>}
            </Select>
            <Input label={vi ? "Tiêu đề" : "Title"} value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold flex items-center gap-2">
            {path === "QUOTE" ? <FileText size={14} /> : <ShoppingCart size={14} />}
            {vi ? "Direct Sale không tạo Deal ngầm. Buyer được resolve trước transaction." : "Direct Sale creates no hidden Deal. Buyer is resolved before the transaction."}
          </div>
        </div>

        <div className="pt-5 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-extrabold text-slate-900">{vi ? "Sản phẩm / dịch vụ" : "Products / services"}</h2>
              <p className="text-[11px] text-slate-500 mt-1">{vi ? "Cần ít nhất một line item để đạt transaction readiness." : "At least one line item is required for transaction readiness."}</p>
            </div>
            <Button actionIntent="create" size="sm" icon={<Plus size={13} />} onClick={() => setPickerOpen(true)}>{vi ? "Chọn sản phẩm" : "Choose products"}</Button>
          </div>
          {selectedItems.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-slate-300 text-center text-slate-500">{vi ? "Chưa có line item." : "No line items yet."}</div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {selectedItems.map((item) => (
                <div key={item.product.id} className="p-4 flex items-center gap-3 bg-white">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 crm-text-wrap">{item.product.name}</div>
                    <div className="text-[11px] text-slate-500 mt-1">{item.product.sku} · {item.quantity} × {formatVnd(item.customPrice ?? item.product.listPrice, locale)}</div>
                  </div>
                  <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={() => setSelectedItems((current) => current.filter((entry) => entry.product.id !== item.product.id))}>{vi ? "Xóa" : "Remove"}</Button>
                </div>
              ))}
              <div className="p-4 flex justify-end bg-slate-50 font-extrabold text-slate-900">{vi ? "Tạm tính" : "Subtotal"}: {formatVnd(total, locale)}</div>
            </div>
          )}
        </div>

        {error && <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 font-semibold">{error}</div>}
        <div className="flex justify-end">
          <Button variant="primary" icon={<ShoppingCart size={14} />} onClick={execute} disabled={lifecycle.pending || !eligible || !actorCanSellNow || selectedItems.length === 0 || (path === "QUOTE" ? !quoteEnabled : !orderEnabled)}>{vi ? "Bắt đầu Direct Sale" : "Start Direct Sale"}</Button>
        </div>
      </fieldset>

      <ProductPickerModal
        id="lead-sell-now-product-picker"
        isOpen={pickerOpen && !lifecycle.pending}
        onClose={() => setPickerOpen(false)}
        onApply={(items) => { if (!lifecycle.isCurrent() || lifecycle.pending) return; setSelectedItems(items); setPickerOpen(false); }}
        products={products}
        initialSelected={selectedItems}
        context={path === "QUOTE" ? "quote" : "order"}
      />
    </div>
  );
};
