import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Eye, Plus, Save, Trash2 } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, Card, Input, Modal, PageHeader } from "@/shared/components/ui";
import { ModulePageShell } from "@/components/crm/ModulePageShell";
import { useI18n } from "@/i18n";
import { usePlatformState } from "@/platform/application-state";
import { toWorkspacePath } from "@/platform/navigation";
import { getOrderListSnapshot, getOrderSnapshot } from "@/modules/orders";
import { getContactSnapshot } from "@/modules/contacts";
import { resolveCustomerRelationshipContextSnapshot } from "@/modules/customers";
import { getOrganizationAccountSnapshot } from "@/modules/organizations";
import { relationshipRefKey } from "@/platform/identity";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import { useSubscribableSnapshot } from "@/platform/react";
import { createDurableId } from "@/shared/ids";
import { addMoney, formatMoneyDto, money, multiplyMoney, percentageOfMoney, subtractMoney, sumMoney, type MoneyDto } from "@/shared/money";
import { MutationConflictDialog, useMutationTask } from "@/shared/operations";
import {
  createInvoiceDraftCanonical,
  getInvoiceSellerInformation,
  getInvoiceableOrderLinesSnapshot,
  saveInvoiceDraftCanonical,
  subscribeToInvoiceConfiguration,
  type InvoiceDraftLineInput,
  type InvoiceLine,
  type LegalPartySnapshot,
} from "../../public/api";
import { useInvoiceWorkspaceQuery } from "../hooks/useInvoiceVerticalSlice";

interface EditableLine {
  id: string;
  sourceOrderLineId?: string;
  orderLineId?: string;
  productId?: string;
  skuSnapshot?: string;
  description: string;
  unitOfMeasure: string;
  sourceOrderQuantity: string;
  alreadyInvoicedQuantity: string;
  invoiceableQuantity: string;
  quantity: string;
  unitPrice: string;
  discountRate: string;
  taxRate: string;
  notes: string;
}

function buyerLegalSnapshot(order: ReturnType<typeof getOrderSnapshot>): LegalPartySnapshot | undefined {
  if (!order) return undefined;
  if (order.buyerRef.type === "ORGANIZATION_ACCOUNT") {
    const organization = getOrganizationAccountSnapshot(order.buyerRef.id);
    if (organization) return {
      displayName: organization.displayName,
      legalName: organization.legalName,
      taxId: organization.taxCode,
      email: organization.email,
      phone: organization.phone,
      addressLines: organization.address ? [organization.address] : [],
    };
  }
  const contact = getContactSnapshot(order.buyerRef.id);
  if (contact) return {
    displayName: contact.fullName || contact.name,
    legalName: contact.fullName || contact.name,
    email: contact.workEmail || contact.email || contact.personalEmail,
    phone: contact.mobilePhone || contact.phone || contact.workPhone,
    addressLines: contact.address ? [contact.address] : [],
  };
  return {
    displayName: order.customerName || order.contactName || order.recipientName || order.buyerRef.id,
    legalName: order.customerName || order.contactName || order.recipientName || order.buyerRef.id,
    email: order.recipientEmail,
    phone: order.recipientPhone,
    addressLines: order.shippingAddress ? [[order.shippingAddress.line1, order.shippingAddress.line2, order.shippingAddress.ward, order.shippingAddress.district, order.shippingAddress.city, order.shippingAddress.country].filter(Boolean).join(", ")] : [],
  };
}

function asEditable(line: InvoiceLine): EditableLine {
  return {
    id: line.id,
    sourceOrderLineId: line.sourceOrderLineId ?? line.orderLineId,
    orderLineId: line.orderLineId ?? line.sourceOrderLineId,
    productId: line.productId,
    skuSnapshot: line.skuSnapshot,
    description: line.description,
    unitOfMeasure: line.unitOfMeasure ?? "item",
    sourceOrderQuantity: line.sourceOrderQuantity ?? line.quantity,
    alreadyInvoicedQuantity: line.alreadyInvoicedQuantity ?? "0",
    invoiceableQuantity: line.invoiceableQuantity ?? line.quantity,
    quantity: line.quantity,
    unitPrice: line.unitPrice.amount,
    discountRate: line.discountRate ?? "0",
    taxRate: line.taxRate ?? "0",
    notes: line.notes ?? "",
  };
}

function dateAfterDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + Math.max(0, days));
  return date.toISOString().slice(0, 10);
}

function lineAmounts(line: EditableLine, currency: string): { subtotal: MoneyDto; discount: MoneyDto; tax: MoneyDto; total: MoneyDto } {
  const subtotal = multiplyMoney(money(line.unitPrice || "0", currency), line.quantity || "0");
  const discount = percentageOfMoney(subtotal, line.discountRate || "0");
  const taxable = subtractMoney(subtotal, discount);
  const tax = percentageOfMoney(taxable, line.taxRate || "0");
  return { subtotal, discount, tax, total: addMoney(taxable, tax) };
}

export const InvoiceFormPage: React.FC = () => {
  const { invoiceId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const { activeWorkspace } = usePlatformState();
  const configuration = useWorkspaceOperationalConfiguration();
  const invoiceSettings = useSubscribableSnapshot(getInvoiceSellerInformation, subscribeToInvoiceConfiguration);
  const invoiceAddress = configuration.addresses.find((address) => address.id === invoiceSettings.invoiceAddressId);
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const path = (value: string) => toWorkspacePath(activeWorkspace.workspaceKey, "crm", value);
  const invoiceQuery = useInvoiceWorkspaceQuery();
  const existing = invoiceId ? invoiceQuery.data?.invoices.find((invoice) => invoice.id === invoiceId) : undefined;
  const hydratedInvoiceRef = useRef<string | null>(null);
  const hydratedSourceOrderRef = useRef<string | null>(null);
  const contextSelectionRef = useRef<string | null>(null);
  const customerIdParam = searchParams.get("customerId") ?? "";
  const contactIdParam = searchParams.get("contactId") ?? "";
  const organizationIdParam = searchParams.get("organizationId") ?? "";
  const allEligibleOrders = useMemo(() => getOrderListSnapshot().filter((order) => ["CONFIRMED", "COMPLETED"].includes(order.state)), []);
  const eligibleOrders = useMemo(() => {
    if (!customerIdParam && !contactIdParam && !organizationIdParam) return allEligibleOrders;
    const relationshipKeys = new Set<string>();
    const customerContext = customerIdParam ? resolveCustomerRelationshipContextSnapshot(customerIdParam) : undefined;
    if (customerContext) relationshipKeys.add(customerContext.relationshipKey);
    const contact = contactIdParam ? getContactSnapshot(contactIdParam) : undefined;
    if (contact) {
      relationshipKeys.add(relationshipRefKey({ type: "CONTACT", id: contact.id }));
      if (contact.organizationAccountId) relationshipKeys.add(relationshipRefKey({ type: "ORGANIZATION_ACCOUNT", id: contact.organizationAccountId }));
    }
    if (organizationIdParam) relationshipKeys.add(relationshipRefKey({ type: "ORGANIZATION_ACCOUNT", id: organizationIdParam }));
    return allEligibleOrders.filter((order) =>
      (customerIdParam && order.customerId === customerIdParam)
      || (contactIdParam && order.contactId === contactIdParam)
      || relationshipKeys.has(relationshipRefKey(order.buyerRef)),
    );
  }, [allEligibleOrders, contactIdParam, customerIdParam, organizationIdParam]);
  const [sourceOrderId, setSourceOrderId] = useState(searchParams.get("orderId") ?? "");
  const sourceOrder = getOrderSnapshot(sourceOrderId);
  const sourceBuyer = useMemo(() => buyerLegalSnapshot(sourceOrder), [sourceOrder]);
  const currency = existing?.currency ?? sourceOrder?.currency ?? invoiceSettings.defaultCurrency ?? configuration.localeRegion.currencies.baseCurrency;
  const [seller, setSeller] = useState<LegalPartySnapshot>(() => ({
    displayName: invoiceSettings.sellerName || configuration.businessInformation.displayName,
    legalName: invoiceSettings.sellerName || configuration.businessInformation.legalName,
    taxId: invoiceSettings.taxId || configuration.businessInformation.taxId,
    email: invoiceSettings.email || configuration.businessInformation.billingEmail,
    phone: invoiceSettings.phone || configuration.businessInformation.phone,
    addressLines: invoiceAddress?.addressLine1 ? [invoiceAddress.addressLine1, invoiceAddress.addressLine2].filter(Boolean) : [],
  }));
  const [buyer, setBuyer] = useState<LegalPartySnapshot>(() => sourceBuyer ?? { displayName: "", addressLines: [] });
  const [dueDate, setDueDate] = useState(dateAfterDays(invoiceSettings.defaultDueDays));
  const [paymentTerms, setPaymentTerms] = useState(`NET ${invoiceSettings.defaultDueDays}`);
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const mutation = useMutationTask<{ id: string }>({
    reloadLatest: async () => {
      hydratedInvoiceRef.current = null;
      await invoiceQuery.refresh();
    },
  });

  useEffect(() => {
    if (invoiceId || existing || searchParams.get("orderId")) return;
    const contextKey = `${customerIdParam}|${contactIdParam}|${organizationIdParam}`;
    if (!contextKey.replaceAll("|", "") || contextSelectionRef.current === contextKey) return;
    contextSelectionRef.current = contextKey;
    if (eligibleOrders.length === 1) setSourceOrderId(eligibleOrders[0].id);
  }, [contactIdParam, customerIdParam, eligibleOrders, existing, invoiceId, organizationIdParam, searchParams]);

  useEffect(() => {
    if (!existing || hydratedInvoiceRef.current === existing.id) return;
    hydratedInvoiceRef.current = existing.id;
    setSourceOrderId(existing.sourceLinks.orderId ?? "");
    setSeller(existing.sellerSnapshot);
    setBuyer(existing.buyerSnapshot);
    setDueDate(existing.dueDate ?? dateAfterDays(invoiceSettings.defaultDueDays));
    setPaymentTerms(existing.paymentTerms ?? `NET ${invoiceSettings.defaultDueDays}`);
    setLines(existing.lines.map(asEditable));
  }, [existing, invoiceSettings.defaultDueDays]);

  useEffect(() => {
    if (invoiceId || existing || !sourceOrder || hydratedSourceOrderRef.current === sourceOrder.id) return;
    hydratedSourceOrderRef.current = sourceOrder.id;
    const nextBuyer = buyerLegalSnapshot(sourceOrder);
    if (nextBuyer) setBuyer(nextBuyer);
    const invoiceable = getInvoiceableOrderLinesSnapshot(sourceOrder.id);
    setLines(invoiceable.filter((line) => Number(line.invoiceableQuantity) > 0).map((line) => ({
      id: createDurableId("invoice_line"),
      sourceOrderLineId: line.orderLineId,
      orderLineId: line.orderLineId,
      productId: line.productId,
      skuSnapshot: line.skuSnapshot,
      description: line.description,
      unitOfMeasure: "item",
      sourceOrderQuantity: line.orderedQuantity,
      alreadyInvoicedQuantity: line.alreadyInvoicedQuantity,
      invoiceableQuantity: line.invoiceableQuantity,
      quantity: line.invoiceableQuantity,
      unitPrice: line.unitPrice,
      discountRate: line.discountRate,
      taxRate: line.taxRate,
      notes: "",
    })));
  }, [existing, invoiceId, sourceOrder]);

  const computed = useMemo(() => {
    const values = lines.map((line) => lineAmounts(line, currency));
    const subtotal = sumMoney(values.map((item) => item.subtotal), currency);
    const discountTotal = sumMoney(values.map((item) => item.discount), currency);
    const taxTotal = sumMoney(values.map((item) => item.tax), currency);
    const grandTotal = sumMoney(values.map((item) => item.total), currency);
    return { values, totals: { subtotal, discountTotal, taxTotal, roundingAdjustment: money("0", currency), grandTotal } };
  }, [currency, lines]);

  const blockers = useMemo(() => {
    const values: string[] = [];
    if (!sourceOrder && !existing) values.push(text("Phải chọn Order nguồn.", "A source Order is required."));
    if (!seller.legalName?.trim() || !seller.taxId?.trim() || !seller.addressLines.some((item) => item.trim())) values.push(text("Thiếu tên pháp lý, mã số thuế hoặc địa chỉ bên bán.", "Seller legal name, tax code, or legal address is missing."));
    if (!buyer.legalName?.trim() || !buyer.addressLines.some((item) => item.trim())) values.push(text("Thiếu tên pháp lý hoặc địa chỉ bên mua.", "Buyer legal name or legal address is missing."));
    if (!buyer.email?.trim()) values.push(text("Thiếu email nhận hóa đơn của bên mua.", "Buyer invoice email is missing."));
    if (!lines.length) values.push(text("Không còn dòng Order nào có thể xuất hóa đơn.", "No Order line remains invoiceable."));
    lines.forEach((line, index) => {
      const quantity = Number(line.quantity);
      if (!line.description.trim()) values.push(text(`Dòng ${index + 1} thiếu mô tả.`, `Line ${index + 1} is missing a description.`));
      if (!Number.isFinite(quantity) || quantity <= 0) values.push(text(`Dòng ${index + 1} có số lượng không hợp lệ.`, `Line ${index + 1} has an invalid quantity.`));
      if (quantity > Number(line.invoiceableQuantity)) values.push(text(`Dòng ${index + 1} vượt số lượng còn được xuất.`, `Line ${index + 1} exceeds its invoiceable quantity.`));
      if ([line.unitPrice, line.discountRate, line.taxRate].some((value) => Number(value) < 0)) values.push(text(`Dòng ${index + 1} có giá trị âm.`, `Line ${index + 1} contains a negative value.`));
    });
    return values;
  }, [buyer, existing, lines, seller, sourceOrder]);

  const updateLine = (id: string, patch: Partial<EditableLine>) => setLines((current) => current.map((line) => line.id === id ? { ...line, ...patch } : line));
  const removeLine = (id: string) => setLines((current) => current.filter((line) => line.id !== id));
  const addManualLine = () => setLines((current) => [...current, {
    id: createDurableId("invoice_line"), description: "", unitOfMeasure: "item", sourceOrderQuantity: "0", alreadyInvoicedQuantity: "0", invoiceableQuantity: "999999999", quantity: "1", unitPrice: "0", discountRate: "0", taxRate: "0", notes: "",
  }]);

  const buildLines = (): InvoiceDraftLineInput[] => {
    const authoritativeLineIds = new Set(existing?.lines.map((line) => line.id) ?? []);
    return lines.map((line) => ({
      ...(authoritativeLineIds.has(line.id) ? { lineId: line.id } : { clientLocalId: line.id }),
      sourceOrderLineId: line.sourceOrderLineId ?? line.orderLineId,
      productId: line.productId,
      skuSnapshot: line.skuSnapshot,
      description: line.description.trim(),
      unitOfMeasure: line.unitOfMeasure.trim() || undefined,
      quantity: line.quantity,
      unitPrice: money(line.unitPrice || "0", currency),
      discountRate: line.discountRate || "0",
      taxRate: line.taxRate || "0",
      notes: line.notes.trim() || undefined,
    }));
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitAttempted(true);
    if (blockers.length) {
      window.requestAnimationFrame(() => {
        const firstInvalid = document.querySelector<HTMLElement>('[data-invoice-invalid="true"]');
        firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });
        firstInvalid?.focus({ preventScroll: true });
      });
      return;
    }
    const saved = await mutation.run(async (signal) => {
      const resolvedLines = buildLines();
      if (existing) {
        return saveInvoiceDraftCanonical({
          invoiceId: existing.id,
          expectedVersion: existing.version,
          idempotencyKey: `invoice-draft-save:${existing.id}:${existing.version}`,
          sellerSnapshot: seller,
          buyerSnapshot: buyer,
          dueDate: dueDate || undefined,
          paymentTerms: paymentTerms.trim() || undefined,
          lines: resolvedLines,
        }, signal).then((outcome) => outcome.data);
      }
      if (!sourceOrder) throw new Error("INVOICE_SOURCE_ORDER_REQUIRED");
      const creationIntentId = createDurableId("invoice_creation_intent");
      return createInvoiceDraftCanonical({
        buyerRef: sourceOrder.buyerRef,
        sellerSnapshot: seller,
        buyerSnapshot: buyer,
        currency,
        dueDate: dueDate || undefined,
        paymentTerms: paymentTerms.trim() || undefined,
        lines: resolvedLines,
        sourceLinks: { orderId: sourceOrder.id, paymentScheduleLineIds: sourceOrder.paymentAgreementSnapshot?.lines.map((line) => line.id) },
        creationIntentId,
        idempotencyKey: creationIntentId,
      }, signal).then((outcome) => outcome.data);
    });
    if (saved) navigate(path(`invoices/${saved.id}`));
  };


  if (invoiceId && invoiceQuery.loading && !invoiceQuery.data) {
    return <ModulePageShell><Card className="p-8 text-center text-sm text-slate-600"><p>{text("Đang tải hóa đơn authoritative...", "Loading the authoritative invoice...")}</p><Button className="mt-4" variant="secondary" onClick={invoiceQuery.cancel}>{text("Hủy tải", "Cancel loading")}</Button></Card></ModulePageShell>;
  }

  if (invoiceId && invoiceQuery.state === "ERROR" && !invoiceQuery.data) {
    return <ModulePageShell><Card className="p-8 text-center text-sm text-rose-700"><p>{text("Không thể tải hóa đơn.", "The invoice could not be loaded.")}</p><Button className="mt-4" variant="secondary" onClick={() => void invoiceQuery.refresh()}>{text("Thử lại", "Retry")}</Button></Card></ModulePageShell>;
  }

  if (invoiceId && invoiceQuery.data && !existing) {
    return <ModulePageShell><Card className="p-8 text-center text-sm text-slate-600">{text("Không tìm thấy hóa đơn.", "Invoice not found.")}</Card></ModulePageShell>;
  }

  if (existing && !["DRAFT", "ISSUE_FAILED"].includes(existing.lifecycleState)) return <ModulePageShell><Card><p className="text-sm text-slate-700">{text("Hóa đơn đã phát hành không thể sửa nội dung thương mại.", "Issued invoices cannot have their commercial content edited.")}</p></Card></ModulePageShell>;

  return <ModulePageShell className="crm-form-page">
    <PageHeader
      title={existing ? text("Hiệu chỉnh hóa đơn nháp", "Edit draft invoice") : text("Tạo hóa đơn nháp", "Create draft invoice")}
      actions={<Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={() => navigate(path("invoices"))}>{text("Hủy", "Cancel")}</Button>}
    />
    <form onSubmit={onSubmit} className="crm-form-surface space-y-5">
      {mutation.snapshot.failure && !mutation.conflicted && <Card className="border border-rose-200 bg-rose-50"><p role="alert" className="text-sm font-semibold text-slate-800">{mutation.snapshot.failure.message}</p></Card>}
      <Card className="space-y-5">
        {!existing && <label className="block space-y-2 text-sm font-semibold text-slate-700"><span>{text("Đơn hàng nguồn", "Source order")}</span><select id="invoice-source-order" required value={sourceOrderId} onChange={(event) => { hydratedSourceOrderRef.current = null; setSourceOrderId(event.target.value); }} aria-invalid={submitAttempted && !sourceOrder} data-invoice-invalid={submitAttempted && !sourceOrder ? "true" : undefined} className={`h-11 w-full rounded-xl border bg-white px-4 font-normal outline-none focus:ring-2 focus:ring-violet-100 ${submitAttempted && !sourceOrder ? "border-rose-500" : "border-slate-300"}`}><option value="">{text("Chọn đơn hàng đã xác nhận", "Select a confirmed order")}</option>{eligibleOrders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} · {order.customerName || order.contactName || order.buyerRef.id}</option>)}</select>{submitAttempted && !sourceOrder && <span className="block text-xs font-medium text-rose-600">{text("Chọn đơn hàng nguồn.", "Select a source order.")}</span>}</label>}
        {sourceOrder && <p className="text-sm text-slate-600">{text("Đơn hàng nguồn", "Source order")}: <strong className="font-semibold text-slate-900">{sourceOrder.orderNumber}</strong>. {text("Số lượng có thể xuất được tính từ các hóa đơn còn hiệu lực.", "Invoiceable quantity is calculated from active invoices.")}</p>}
        {!existing && (customerIdParam || contactIdParam || organizationIdParam) && eligibleOrders.length !== 1 && <p className="text-sm text-slate-600">{eligibleOrders.length === 0 ? text("Không có đơn hàng đã xác nhận phù hợp. Hãy tạo hoặc xác nhận đơn hàng trước khi lập hóa đơn.", "No confirmed order matches this context. Create or confirm an order before invoicing.") : text(`Có ${eligibleOrders.length} đơn hàng phù hợp. Hãy chọn đơn hàng cần xuất hóa đơn.`, `${eligibleOrders.length} eligible orders match this context. Select the order to invoice.`)}</p>}
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <LegalPartyCard idPrefix="invoice-seller" title={text("Thông tin pháp lý bên bán", "Seller legal information")} value={seller} onChange={setSeller} text={text} attempted={submitAttempted} requireTaxCode />
        <LegalPartyCard idPrefix="invoice-buyer" title={text("Thông tin pháp lý bên mua", "Buyer legal information")} value={buyer} onChange={setBuyer} text={text} attempted={submitAttempted} requireEmail />
      </div>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-slate-900">{text("Dòng hóa đơn", "Invoice lines")}</h2><p className="mt-1 text-xs text-slate-500">{text("Có thể xuất một phần từng dòng; hệ thống chặn over-invoicing ngay trên form.", "Each line can be partially invoiced; over-invoicing is blocked in the form.")}</p></div><Button type="button" variant="secondary" icon={<Plus size={15} />} onClick={addManualLine}>{text("Thêm dòng", "Add line")}</Button></div>
        <div id="invoice-lines" tabIndex={-1} data-invoice-invalid={submitAttempted && !lines.length ? "true" : undefined} className="overflow-x-auto outline-none">{submitAttempted && !lines.length && <p className="mb-3 text-xs font-medium text-rose-600">{text("Thêm ít nhất một dòng hóa đơn.", "Add at least one invoice line.")}</p>}<table className="min-w-[1380px] w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-3">{text("Hàng hóa / dịch vụ", "Goods / service")}</th><th className="px-3 py-3">{text("ĐVT", "UOM")}</th><th className="px-3 py-3 text-right">{text("Order", "Ordered")}</th><th className="px-3 py-3 text-right">{text("Đã xuất", "Invoiced")}</th><th className="px-3 py-3 text-right">{text("Còn lại", "Available")}</th><th className="px-3 py-3 text-right">{text("Đang xuất", "Quantity")}</th><th className="px-3 py-3 text-right">{text("Đơn giá", "Unit price")}</th><th className="px-3 py-3 text-right">{text("CK %", "Disc. %")}</th><th className="px-3 py-3 text-right">{text("Thuế %", "Tax %")}</th><th className="px-3 py-3 text-right">{text("Thành tiền", "Total")}</th><th className="px-3 py-3" /></tr></thead><tbody className="divide-y divide-slate-100">{lines.map((line, index) => { const invalidDescription = submitAttempted && !line.description.trim(); const invalidQuantity = submitAttempted && (!Number.isFinite(Number(line.quantity)) || Number(line.quantity) <= 0 || Number(line.quantity) > Number(line.invoiceableQuantity)); return <tr key={line.id}><td className="px-3 py-3"><input id={`invoice-line-description-${index}`} value={line.description} onChange={(event) => updateLine(line.id, { description: event.target.value })} aria-invalid={invalidDescription} data-invoice-invalid={invalidDescription ? "true" : undefined} className={`h-10 min-w-60 w-full rounded-lg border px-3 ${invalidDescription ? "border-rose-500" : "border-slate-300"}`} />{invalidDescription && <span className="mt-1 block text-[10px] text-rose-600">{text("Nhập mô tả dòng.", "Enter a line description.")}</span>}<input value={line.notes} onChange={(event) => updateLine(line.id, { notes: event.target.value })} placeholder={text("Ghi chú dòng", "Line note")} className="mt-2 h-9 min-w-60 w-full rounded-lg border border-slate-200 px-3 text-[11px]" /></td><td className="px-3 py-3"><input value={line.unitOfMeasure} onChange={(event) => updateLine(line.id, { unitOfMeasure: event.target.value })} className="h-10 w-20 rounded-lg border border-slate-300 px-2" /></td><td className="px-3 py-3 text-right font-semibold">{line.sourceOrderQuantity}</td><td className="px-3 py-3 text-right font-semibold text-slate-500">{line.alreadyInvoicedQuantity}</td><td className="px-3 py-3 text-right font-bold text-violet-700">{line.invoiceableQuantity}</td><td className="px-3 py-3"><input id={`invoice-line-quantity-${index}`} type="number" min="0" step="any" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: event.target.value })} aria-invalid={invalidQuantity} data-invoice-invalid={invalidQuantity ? "true" : undefined} className={`h-10 w-24 rounded-lg border px-2 text-right ${invalidQuantity ? "border-rose-500" : "border-slate-300"}`} aria-label={`${text("Số lượng dòng", "Line quantity")} ${index + 1}`} /></td><td className="px-3 py-3"><input type="number" min="0" step="any" value={line.unitPrice} onChange={(event) => updateLine(line.id, { unitPrice: event.target.value })} className="h-10 w-32 rounded-lg border border-slate-300 px-2 text-right" /></td><td className="px-3 py-3"><input type="number" min="0" max="100" step="any" value={line.discountRate} onChange={(event) => updateLine(line.id, { discountRate: event.target.value })} className="h-10 w-20 rounded-lg border border-slate-300 px-2 text-right" /></td><td className="px-3 py-3"><input type="number" min="0" max="100" step="any" value={line.taxRate} onChange={(event) => updateLine(line.id, { taxRate: event.target.value })} className="h-10 w-20 rounded-lg border border-slate-300 px-2 text-right" /></td><td className="px-3 py-3 text-right font-bold whitespace-nowrap">{formatMoneyDto(computed.values[index]?.total ?? money("0", currency), locale === "vi" ? "vi-VN" : "en-US")}</td><td className="px-3 py-3"><button type="button" onClick={() => removeLine(line.id)} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50" aria-label={text("Xóa dòng", "Remove line")}><Trash2 size={16} /></button></td></tr>; })}</tbody></table></div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="grid gap-4 sm:grid-cols-3"><Input type="date" label={text("Ngày đến hạn", "Due date")} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /><label className="space-y-2 text-sm font-semibold text-slate-700"><span>{text("Điều khoản thanh toán", "Payment terms")}</span><input value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} className="h-11 w-full rounded-xl border border-slate-300 px-4 font-normal" /></label><label className="space-y-2 text-sm font-semibold text-slate-700"><span>{text("Tiền tệ", "Currency")}</span><input readOnly value={currency} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 font-normal" /></label></Card>
        <Card className="space-y-3 text-sm"><Total label={text("Tạm tính", "Subtotal")} value={computed.totals.subtotal} locale={locale} /><Total label={text("Chiết khấu", "Discount")} value={computed.totals.discountTotal} locale={locale} /><Total label={text("Thuế", "Tax")} value={computed.totals.taxTotal} locale={locale} /><div className="border-t border-slate-200 pt-3"><Total label={text("Tổng thanh toán", "Grand total")} value={computed.totals.grandTotal} locale={locale} strong /></div></Card>
      </div>

      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4"><Button type="button" variant="secondary" icon={<Eye size={16} />} onClick={() => setPreviewOpen(true)} disabled={!lines.length}>{text("Xem trước", "Preview")}</Button><Button type="submit" actionIntent="save" icon={<Save size={16} />} disabled={mutation.busy}>{mutation.busy ? text("Đang lưu…", "Saving…") : text("Lưu hóa đơn nháp", "Save draft invoice")}</Button></div>
    </form>

    <MutationConflictDialog
      isOpen={mutation.conflicted}
      failure={mutation.snapshot.failure}
      recovering={mutation.recovering}
      onReloadLatest={mutation.reloadLatest}
      onClose={mutation.dismissFailure}
    />

    <Modal isOpen={previewOpen} onClose={() => setPreviewOpen(false)} title={text("Xem trước hóa đơn", "Invoice preview")} size="lg" variant="form" footer={<Button type="button" onClick={() => setPreviewOpen(false)}>{text("Đóng xem trước", "Close preview")}</Button>}>
      <div className="space-y-5 p-1"><div className="grid gap-4 sm:grid-cols-2"><PartyPreview title={text("Bên bán", "Seller")} party={seller} /><PartyPreview title={text("Bên mua", "Buyer")} party={buyer} /></div><div className="overflow-x-auto"><table className="min-w-[760px] w-full text-xs"><thead className="bg-slate-50 text-left"><tr><th className="px-3 py-3">#</th><th className="px-3 py-3">{text("Mô tả", "Description")}</th><th className="px-3 py-3 text-right">{text("SL", "Qty")}</th><th className="px-3 py-3 text-right">{text("Đơn giá", "Unit price")}</th><th className="px-3 py-3 text-right">{text("Thành tiền", "Total")}</th></tr></thead><tbody className="divide-y divide-slate-100">{lines.map((line, index) => <tr key={line.id}><td className="px-3 py-3">{index + 1}</td><td className="px-3 py-3 font-semibold">{line.description}</td><td className="px-3 py-3 text-right">{line.quantity}</td><td className="px-3 py-3 text-right">{formatMoneyDto(money(line.unitPrice || "0", currency), locale === "vi" ? "vi-VN" : "en-US")}</td><td className="px-3 py-3 text-right font-bold">{formatMoneyDto(computed.values[index]?.total ?? money("0", currency), locale === "vi" ? "vi-VN" : "en-US")}</td></tr>)}</tbody></table></div><div className="ml-auto max-w-sm"><Total label={text("Tổng thanh toán", "Grand total")} value={computed.totals.grandTotal} locale={locale} strong /></div></div>
    </Modal>
  </ModulePageShell>;
};

function LegalPartyCard({
  idPrefix,
  title,
  value,
  onChange,
  text,
  attempted,
  requireTaxCode = false,
  requireEmail = false,
}: {
  idPrefix: string;
  title: string;
  value: LegalPartySnapshot;
  onChange: (next: LegalPartySnapshot) => void;
  text: (vi: string, en: string) => string;
  attempted: boolean;
  requireTaxCode?: boolean;
  requireEmail?: boolean;
}) {
  const field = (patch: Partial<LegalPartySnapshot>) => onChange({ ...value, ...patch });
  const legalNameMissing = attempted && !value.legalName?.trim();
  const taxCodeMissing = attempted && requireTaxCode && !value.taxId?.trim();
  const emailMissing = attempted && requireEmail && !value.email?.trim();
  const addressMissing = attempted && !value.addressLines.some((item) => item.trim());
  const inputClass = (invalid: boolean) => `h-11 w-full rounded-xl border px-4 font-normal outline-none focus:ring-2 focus:ring-violet-100 ${invalid ? "border-rose-500" : "border-slate-300"}`;
  return <Card className="space-y-4"><h2 className="font-semibold text-slate-900 [overflow-wrap:anywhere]">{title}</h2><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm font-semibold text-slate-700"><span>{text("Tên hiển thị", "Display name")}</span><input id={`${idPrefix}-display-name`} value={value.displayName} onChange={(event) => field({ displayName: event.target.value })} className={inputClass(false)} /></label><label className="space-y-2 text-sm font-semibold text-slate-700"><span>{text("Tên pháp lý", "Legal name")} *</span><input id={`${idPrefix}-legal-name`} required value={value.legalName ?? ""} onChange={(event) => field({ legalName: event.target.value })} aria-invalid={legalNameMissing} data-invoice-invalid={legalNameMissing ? "true" : undefined} className={inputClass(legalNameMissing)} />{legalNameMissing && <span className="block text-xs font-medium text-rose-600">{text("Nhập tên pháp lý.", "Enter the legal name.")}</span>}</label><label className="space-y-2 text-sm font-semibold text-slate-700"><span>{text("Mã số thuế", "Tax code")}{requireTaxCode ? " *" : ""}</span><input id={`${idPrefix}-tax-code`} value={value.taxId ?? ""} onChange={(event) => field({ taxId: event.target.value })} aria-invalid={taxCodeMissing} data-invoice-invalid={taxCodeMissing ? "true" : undefined} className={inputClass(taxCodeMissing)} />{taxCodeMissing && <span className="block text-xs font-medium text-rose-600">{text("Nhập mã số thuế bên bán.", "Enter the seller tax code.")}</span>}</label><label className="space-y-2 text-sm font-semibold text-slate-700"><span>Email{requireEmail ? " *" : ""}</span><input id={`${idPrefix}-email`} type="email" value={value.email ?? ""} onChange={(event) => field({ email: event.target.value })} aria-invalid={emailMissing} data-invoice-invalid={emailMissing ? "true" : undefined} className={inputClass(emailMissing)} />{emailMissing && <span className="block text-xs font-medium text-rose-600">{text("Nhập email nhận hóa đơn.", "Enter the invoice recipient email.")}</span>}</label><label className="space-y-2 text-sm font-semibold text-slate-700"><span>{text("Liên hệ", "Contact")}</span><input value={value.phone ?? ""} onChange={(event) => field({ phone: event.target.value })} className={inputClass(false)} /></label><label className="space-y-2 text-sm font-semibold text-slate-700 sm:col-span-2"><span>{text("Địa chỉ pháp lý", "Legal address")} *</span><textarea id={`${idPrefix}-address`} required rows={3} value={value.addressLines.join("\n")} onChange={(event) => field({ addressLines: event.target.value.split("\n") })} aria-invalid={addressMissing} data-invoice-invalid={addressMissing ? "true" : undefined} className={`w-full rounded-xl border px-4 py-3 font-normal outline-none focus:ring-2 focus:ring-violet-100 ${addressMissing ? "border-rose-500" : "border-slate-300"}`} />{addressMissing && <span className="block text-xs font-medium text-rose-600">{text("Nhập địa chỉ pháp lý.", "Enter the legal address.")}</span>}</label></div></Card>;
}

function Total({ label, value, locale, strong = false }: { label: string; value: MoneyDto; locale: string; strong?: boolean }) {
  return <div className={`flex items-center justify-between gap-4 ${strong ? "text-base font-bold text-slate-950" : "text-slate-600"}`}><span>{label}</span><span className="font-bold">{formatMoneyDto(value, locale === "vi" ? "vi-VN" : "en-US")}</span></div>;
}

function PartyPreview({ title, party }: { title: string; party: LegalPartySnapshot }) {
  return <div className="rounded-xl border border-slate-200 p-4 text-sm"><h3 className="font-bold text-slate-900 [overflow-wrap:anywhere]">{title}</h3><p className="mt-2 font-semibold">{party.legalName || party.displayName}</p><p className="text-slate-500">{party.taxId || "—"}</p><p className="text-slate-500">{party.addressLines.join(", ") || "—"}</p><p className="text-slate-500">{party.email || "—"}</p></div>;
}
