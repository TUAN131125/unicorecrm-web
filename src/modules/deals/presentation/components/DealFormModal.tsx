import React from "react";
import { AlertCircle, ChevronDown, ChevronUp, Plus, Trash2, Zap } from "lucide-react";
import { Button, Checkbox, Input, Modal, Select, Textarea } from "@/shared/components/ui";
import { FieldHelp } from "@/guidance/presentation/FieldHelp";
import { useI18n } from "@/i18n";
import {
  getProductCatalogSnapshot,
  ProductPickerModal,
  type SelectedPickerItem,
} from "@/modules/products";
import { createDurableId } from "@/shared/ids";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import type {
  DealForecastCategory,
  DealLineItem,
  OpportunityStageConfig,
} from "../../domain/model/deal.types";

export type DealFormMode = "create" | "edit";
export type DealPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type DealOpportunityType = "new_sale" | "upsell" | "cross_sell" | "renewal" | "consulting";

export interface DealOwnerOption {
  memberId: string;
  displayName: string;
}

export interface DealFormDraft {
  name: string;
  customerName: string;
  amount: number;
  ownerId: string;
  expectedCloseDate: string;
  stage: string;
  probability: number;
  forecastCategory: DealForecastCategory;
  source: string;
  pipeline: string;
  currency: string;
  priority: DealPriority;
  opportunityType: DealOpportunityType;
  demandSummary: string;
  painPoints: string;
  expectedBudget: number;
  nextActionSummary: string;
  nextActionAt: string;
  createFollowUpTask: boolean;
  notes: string;
  lineItems: SelectedPickerItem[];
}

export interface DealFormModalProps {
  isOpen: boolean;
  onClose(): void;
  mode: DealFormMode;
  initialValues?: Partial<DealFormDraft>;
  owners: DealOwnerOption[];
  stages: OpportunityStageConfig[];
  canAssign?: boolean;
  customerNameLocked?: boolean;
  productsEnabled?: boolean;
  onSubmit(draft: DealFormDraft): void;
  submitting?: boolean;
  error?: string;
}

function localDateTime(value: Date): string {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function normalizeDateTime(value?: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : localDateTime(parsed);
}

function createDraft(
  initialValues: Partial<DealFormDraft> | undefined,
  owners: DealOwnerOption[],
  stages: OpportunityStageConfig[],
  defaultCurrency: string,
): DealFormDraft {
  const openStages = stages.filter((stage) => stage.isActive && stage.category === "open").sort((left, right) => left.order - right.order);
  const stage = initialValues?.stage || openStages[0]?.code || "DISCOVERY";
  const stageConfig = stages.find((candidate) => candidate.code === stage);
  const lineItems = initialValues?.lineItems || [];
  const lineItemTotal = calculateLineItemTotal(lineItems);
  const amount = lineItems.length > 0 ? lineItemTotal : (initialValues?.amount ?? 0);

  return {
    name: initialValues?.name ?? "",
    customerName: initialValues?.customerName ?? "",
    amount,
    ownerId: initialValues?.ownerId || owners[0]?.memberId || "",
    expectedCloseDate: initialValues?.expectedCloseDate || "",
    stage,
    probability: initialValues?.probability ?? stageConfig?.probabilityDefault ?? 10,
    forecastCategory: initialValues?.forecastCategory ?? "PIPELINE",
    source: initialValues?.source ?? "Direct",
    pipeline: initialValues?.pipeline ?? "standard",
    currency: initialValues?.currency ?? defaultCurrency,
    priority: initialValues?.priority ?? "MEDIUM",
    opportunityType: initialValues?.opportunityType ?? "new_sale",
    demandSummary: initialValues?.demandSummary ?? "",
    painPoints: initialValues?.painPoints ?? "",
    expectedBudget: initialValues?.expectedBudget ?? amount,
    nextActionSummary: initialValues?.nextActionSummary ?? "",
    nextActionAt: normalizeDateTime(initialValues?.nextActionAt),
    createFollowUpTask: initialValues?.createFollowUpTask ?? Boolean(initialValues?.nextActionSummary || initialValues?.nextActionAt),
    notes: initialValues?.notes ?? "",
    lineItems,
  };
}

export function mapSelectedPickerItemsToDealLineItems(items: readonly SelectedPickerItem[]): DealLineItem[] {
  return items.map((item, index) => {
    const unitPrice = item.customPrice ?? item.product.listPrice ?? 0;
    const discountPercent = item.discountPercent ?? 0;
    const subtotal = unitPrice * item.quantity;
    const discountAmount = subtotal * discountPercent / 100;
    const lineTotal = subtotal - discountAmount;
    return {
      id: createDurableId(`deal_line_${index + 1}`),
      productId: item.product.id,
      skuSnapshot: item.product.sku,
      productNameSnapshot: item.product.name,
      productTypeSnapshot: item.product.type,
      descriptionSnapshot: item.product.description,
      quantity: item.quantity,
      unitPriceSnapshot: unitPrice,
      discountPercent,
      taxRateSnapshot: item.product.taxRate,
      taxModeSnapshot: item.taxMode || item.product.taxMode || "none",
      billingCycleSnapshot: item.billingCycle || item.product.billingCycle,
      lineSubtotal: subtotal,
      lineDiscountAmount: discountAmount,
      lineTaxAmount: 0,
      lineTotal,
      productName: item.product.name,
      description: item.product.description,
      unitPrice,
      taxRate: item.product.taxRate,
      taxMode: item.taxMode || item.product.taxMode || "none",
      subtotal,
      totalAmount: lineTotal,
    };
  });
}

function calculateLineItemTotal(items: readonly SelectedPickerItem[]): number {
  return items.reduce((total, item) => {
    const price = item.customPrice ?? item.product.listPrice ?? 0;
    const discount = item.discountPercent ?? 0;
    return total + price * item.quantity * (1 - discount / 100);
  }, 0);
}

export function DealFormModal({
  isOpen,
  onClose,
  mode,
  initialValues,
  owners,
  stages,
  canAssign = true,
  customerNameLocked = false,
  productsEnabled = true,
  onSubmit,
  submitting = false,
  error,
}: DealFormModalProps) {
  const { t, locale } = useI18n();
  const workspaceConfiguration = useWorkspaceOperationalConfiguration();
  const vi = locale === "vi";
  const draftFactory = React.useCallback(() => createDraft(initialValues, owners, stages, workspaceConfiguration.localeRegion.currencies.baseCurrency), [initialValues, owners, stages, workspaceConfiguration.localeRegion.currencies.baseCurrency]);
  const [draft, setDraft] = React.useState<DealFormDraft>(draftFactory);
  const [showAdvanced, setShowAdvanced] = React.useState(mode === "edit");
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);
  const wasOpen = React.useRef(false);
  const productCatalog = React.useMemo(() => getProductCatalogSnapshot(), [isOpen]);

  React.useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setDraft(draftFactory());
      setShowAdvanced(mode === "edit");
      setValidationErrors({});
      setIsPickerOpen(false);
    }
    wasOpen.current = isOpen;
  }, [draftFactory, isOpen, mode]);

  const update = React.useCallback(<K extends keyof DealFormDraft>(field: K, value: DealFormDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setValidationErrors((current) => ({ ...current, [field]: "" }));
  }, []);

  const focusFirstInvalidField = React.useCallback((errors: Record<string, string>) => {
    const fieldOrder = ["name", "customerName", "ownerId", "demandSummary", "products", "amount", "stage", "probability", "expectedCloseDate", "nextActionSummary", "nextActionAt"];
    const firstField = fieldOrder.find((field) => Boolean(errors[field]));
    if (!firstField) return;
    requestAnimationFrame(() => {
      const control = document.getElementById(`deal-${mode}-${firstField}`);
      control?.scrollIntoView({ behavior: "smooth", block: "center" });
      control?.focus({ preventScroll: true });
    });
  }, [mode]);

  const applyLineItems = (items: SelectedPickerItem[]) => {
    const amount = calculateLineItemTotal(items);
    setDraft((current) => ({
      ...current,
      lineItems: items,
      amount: items.length > 0 ? amount : current.amount,
      expectedBudget: items.length > 0 ? amount : current.expectedBudget,
    }));
    setIsPickerOpen(false);
  };

  const updateLineItem = (productId: string, patch: Partial<Pick<SelectedPickerItem, "quantity" | "discountPercent">>) => {
    const items = draft.lineItems.map((item) => item.product.id === productId ? { ...item, ...patch } : item);
    const amount = calculateLineItemTotal(items);
    setDraft((current) => ({ ...current, lineItems: items, amount, expectedBudget: amount }));
  };

  const removeLineItem = (productId: string) => {
    const items = draft.lineItems.filter((item) => item.product.id !== productId);
    const amount = calculateLineItemTotal(items);
    setDraft((current) => ({ ...current, lineItems: items, amount, expectedBudget: items.length > 0 ? amount : current.expectedBudget }));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!draft.name.trim()) nextErrors.name = vi ? "Vui lòng nhập tên cơ hội." : "Enter the opportunity name.";
    if (!draft.customerName.trim()) nextErrors.customerName = vi ? "Vui lòng chọn hoặc nhập khách hàng liên quan." : "Select or enter the related customer.";
    if (!draft.ownerId) nextErrors.ownerId = vi ? "Vui lòng chọn người phụ trách." : "Select an owner.";
    if (!draft.demandSummary.trim() && draft.lineItems.length === 0) {
      const message = vi ? "Hãy mô tả nhu cầu hoặc chọn ít nhất một sản phẩm / dịch vụ." : "Describe the customer need or select at least one product or service.";
      nextErrors.demandSummary = message;
      nextErrors.products = message;
    }
    if (draft.expectedCloseDate && Number.isNaN(new Date(draft.expectedCloseDate).getTime())) {
      nextErrors.expectedCloseDate = vi ? "Ngày đóng dự kiến không hợp lệ." : "Expected close date is invalid.";
    }
    if (draft.createFollowUpTask) {
      if (!draft.nextActionSummary.trim()) nextErrors.nextActionSummary = vi ? "Nhập tên công việc." : "Enter the task title.";
      if (!draft.nextActionAt || Number.isNaN(new Date(draft.nextActionAt).getTime())) nextErrors.nextActionAt = vi ? "Chọn hạn công việc hợp lệ." : "Choose a valid task due date.";
    }
    if (draft.amount < 0) nextErrors.amount = vi ? "Giá trị cơ hội không được âm." : "Opportunity amount cannot be negative.";
    const selectedStage = stages.find((stage) => stage.code === draft.stage);
    if (["PROPOSAL", "NEGOTIATION"].includes(String(draft.stage).toUpperCase()) && draft.amount <= 0) {
      nextErrors.amount = vi ? "Giai đoạn đề xuất hoặc đàm phán cần có giá trị cơ hội lớn hơn 0." : "Proposal or negotiation requires a positive opportunity amount.";
    }
    if (draft.probability < 0 || draft.probability > 100) nextErrors.probability = vi ? "Xác suất phải từ 0 đến 100%." : "Probability must be between 0 and 100%.";
    if (mode === "create" && selectedStage && selectedStage.category !== "open") {
      nextErrors.stage = vi ? "Cơ hội mới phải bắt đầu ở giai đoạn đang mở." : "A new opportunity must start in an open stage.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      focusFirstInvalidField(nextErrors);
      return;
    }
    setValidationErrors({});
    onSubmit({
      ...draft,
      name: draft.name.trim(),
      customerName: draft.customerName.trim(),
      source: draft.source.trim(),
      pipeline: draft.pipeline.trim(),
      demandSummary: draft.demandSummary.trim(),
      painPoints: draft.painPoints.trim(),
      nextActionSummary: draft.nextActionSummary.trim(),
      notes: draft.notes.trim(),
    });
  };

  const activeStages = stages.filter((stage) => stage.isActive && (mode === "edit" || stage.category === "open")).sort((left, right) => left.order - right.order);
  return (
    <>
      <Modal
        variant="form"
        isOpen={isOpen}
        onClose={onClose}
        title={mode === "create" ? (vi ? "Tạo cơ hội" : "Create opportunity") : (vi ? "Chỉnh sửa cơ hội" : "Edit opportunity")}
        size="lg"
      >
        <form id={`deal-${mode}-form`} onSubmit={submit} className="crm-form-surface space-y-5 text-left" data-guidance-id="deals.form.canonical">
          {error ? <p className="text-xs text-slate-600" role="alert">{error}</p> : null}

          {mode === "create" ? (
            <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4" data-guidance-id="deals.form.progressive-profile">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3"><span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm"><Zap size={17} /></span><p className="text-sm font-semibold text-slate-900">{showAdvanced ? (vi ? "Hồ sơ cơ hội đầy đủ" : "Complete opportunity profile") : (vi ? "Tạo nhanh cơ hội" : "Quick opportunity creation")}</p></div>
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowAdvanced((current) => !current)} data-guidance-id="deals.form.advanced-toggle">{showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}{showAdvanced ? (vi ? "Thu gọn" : "Use quick form") : (vi ? "Thêm thông tin" : "Show advanced")}</Button>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-guidance-id="deals.form.quick-create">
            <Input id={`deal-${mode}-name`} label={vi ? "Tên cơ hội" : "Opportunity name"} value={draft.name} onChange={(event) => update("name", event.target.value)} required error={validationErrors.name} />
            <Input id={`deal-${mode}-customerName`} label={vi ? "Khách hàng liên quan" : "Related customer"} value={draft.customerName} onChange={(event) => update("customerName", event.target.value)} disabled={customerNameLocked} required error={validationErrors.customerName} />
            <Input id={`deal-${mode}-amount`} label={vi ? "Giá trị dự kiến" : "Expected amount"} type="number" min="0" value={String(draft.amount)} onChange={(event) => update("amount", Number(event.target.value) || 0)} disabled={draft.lineItems.length > 0} error={validationErrors.amount} />
            <Input id={`deal-${mode}-expectedCloseDate`} label={vi ? "Ngày đóng dự kiến" : "Expected close date"} type="date" value={draft.expectedCloseDate} onChange={(event) => update("expectedCloseDate", event.target.value)} error={validationErrors.expectedCloseDate} />
            <div className="md:col-span-2">
              <Textarea id={`deal-${mode}-demandSummary`} label={vi ? "Nhu cầu / vấn đề cần giải quyết" : "Need / problem to solve"} value={draft.demandSummary} onChange={(event) => { update("demandSummary", event.target.value); setValidationErrors((current) => ({ ...current, products: "" })); }} rows={3} error={validationErrors.demandSummary} />
              <p className="mt-1 text-[11px] leading-5 text-slate-500">{vi ? "Nhập nhu cầu nếu chưa chọn sản phẩm. Cần ít nhất một trong hai thông tin." : "Describe the need when no product is selected. At least one of these two inputs is required."}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Select id={`deal-${mode}-stage`} label={vi ? "Giai đoạn" : "Stage"} value={draft.stage} error={validationErrors.stage} onChange={(event) => {
              const stage = event.target.value;
              const stageConfig = stages.find((candidate) => candidate.code === stage);
              setDraft((current) => ({ ...current, stage, probability: stageConfig?.probabilityDefault ?? current.probability }));
            }}>{activeStages.map((stage) => <option key={stage.code} value={stage.code}>{vi ? stage.labelVi : stage.labelEn}</option>)}</Select>
            <Input id={`deal-${mode}-probability`} label={vi ? "Xác suất (%)" : "Probability (%)"} type="number" min="0" max="100" value={String(draft.probability)} onChange={(event) => update("probability", Number(event.target.value) || 0)} error={validationErrors.probability} />
            <div data-guidance-id="deals.form.forecast-category"><Select label={vi ? "Dự báo" : "Forecast category"} value={draft.forecastCategory} onChange={(event) => update("forecastCategory", event.target.value as DealForecastCategory)}><option value="PIPELINE">Pipeline</option><option value="BEST_CASE">Best case</option><option value="COMMIT">Commit</option></Select></div>
          </div>

          <div data-guidance-id="deals.form.owner"><div className="mb-1 flex justify-end"><FieldHelp helpKey="field.deals.owner" /></div><Select id={`deal-${mode}-ownerId`} label={vi ? "Người phụ trách" : "Owner"} value={draft.ownerId} onChange={(event) => update("ownerId", event.target.value)} disabled={!canAssign} required error={validationErrors.ownerId}>{owners.map((owner) => <option key={owner.memberId} value={owner.memberId}>{owner.displayName}</option>)}</Select></div>

          {productsEnabled ? (
            <section id={`deal-${mode}-products`} tabIndex={-1} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100">
              <div className="flex items-center justify-between gap-3"><h4 className="text-sm font-medium text-slate-800">{vi ? "Sản phẩm / dịch vụ quan tâm" : "Interested products / services"}</h4><Button type="button" actionIntent="create" variant="secondary" size="xs" icon={<Plus size={12} />} className="min-w-[132px]" onClick={() => setIsPickerOpen(true)}>{vi ? "Chọn sản phẩm" : "Select products"}</Button></div>
              {draft.lineItems.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500"><AlertCircle size={18} className="mx-auto mb-1 text-slate-400" />{vi ? "Chưa chọn sản phẩm. Có thể để trống khi đã mô tả rõ nhu cầu." : "No products selected. This is allowed when the customer need is described clearly."}</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="w-full min-w-[620px] text-left text-xs"><thead className="border-b bg-slate-100 text-[10px] uppercase text-slate-500"><tr><th className="p-2">{vi ? "Sản phẩm" : "Product"}</th><th className="p-2 text-right">{vi ? "Đơn giá" : "Price"}</th><th className="p-2 text-center">{vi ? "SL" : "Qty"}</th><th className="p-2 text-center">{vi ? "CK %" : "Disc %"}</th><th className="p-2 text-right">{vi ? "Tổng" : "Total"}</th><th className="w-10 p-2" /></tr></thead>
                    <tbody className="divide-y">{draft.lineItems.map((item) => {
                      const price = item.customPrice ?? item.product.listPrice ?? 0;
                      const discount = item.discountPercent ?? 0;
                      const total = price * item.quantity * (1 - discount / 100);
                      return (
                        <tr key={item.product.id}>
                          <td className="min-w-0 p-2">
                            <div className="max-w-[260px] break-words [overflow-wrap:anywhere] font-semibold text-slate-900" title={item.product.name}>{item.product.name}</div>
                            <div className="max-w-[260px] break-words [overflow-wrap:anywhere] font-mono text-[10px] text-slate-400" title={item.product.sku}>{item.product.sku}</div>
                          </td>
                          <td className="p-2 text-right font-mono">{price.toLocaleString()}</td>
                          <td className="p-2 text-center"><input className="w-16 rounded border p-1 text-center" type="number" min="1" value={item.quantity} onChange={(event) => updateLineItem(item.product.id, { quantity: Math.max(1, Number(event.target.value) || 1) })} /></td>
                          <td className="p-2 text-center"><input className="w-16 rounded border p-1 text-center" type="number" min="0" max="100" value={discount} onChange={(event) => updateLineItem(item.product.id, { discountPercent: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })} /></td>
                          <td className="p-2 text-right font-mono text-slate-800">{total.toLocaleString()}</td>
                          <td className="p-2"><button type="button" className="crm-overflow-safe rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => removeLineItem(item.product.id)} aria-label={vi ? `Xóa ${item.product.name}` : `Remove ${item.product.name}`}><Trash2 size={13} /></button></td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
              )}
              {validationErrors.products ? <p className="text-[11px] text-rose-600">{validationErrors.products}</p> : null}
            </section>
          ) : null}

          <section className="space-y-3 rounded-xl border border-slate-200 p-4" data-guidance-id="deals.form.next-step">
            <Checkbox id={`deal-${mode}-follow-up-task`} label={vi ? "Tạo công việc theo dõi sau khi lưu" : "Create a follow-up task after saving"} checked={draft.createFollowUpTask} onChange={(event) => {
              update("createFollowUpTask", event.target.checked);
              if (!event.target.checked) setValidationErrors((current) => ({ ...current, nextActionSummary: "", nextActionAt: "" }));
            }} />
            {draft.createFollowUpTask ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div><div className="mb-1 flex justify-end"><FieldHelp helpKey="field.deals.next-step" /></div><Input id={`deal-${mode}-nextActionSummary`} label={vi ? "Tên công việc" : "Task title"} value={draft.nextActionSummary} onChange={(event) => update("nextActionSummary", event.target.value)} required error={validationErrors.nextActionSummary} /></div>
                <Input id={`deal-${mode}-nextActionAt`} label={vi ? "Hạn công việc" : "Task due"} type="datetime-local" value={draft.nextActionAt} onChange={(event) => update("nextActionAt", event.target.value)} required error={validationErrors.nextActionAt} />
              </div>
            ) : null}
          </section>

          {(mode === "edit" || showAdvanced) ? (
            <div className="space-y-4 border-t border-slate-100 pt-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Input label={vi ? "Nguồn" : "Source"} value={draft.source} onChange={(event) => update("source", event.target.value)} />
                <Input label="Pipeline" value={draft.pipeline} onChange={(event) => update("pipeline", event.target.value)} />
                <Select label={vi ? "Tiền tệ" : "Currency"} value={draft.currency} onChange={(event) => update("currency", event.target.value)}>{workspaceConfiguration.localeRegion.currencies.enabledCurrencies.map((code) => <option key={code} value={code}>{code}</option>)}</Select>
                <Select label={vi ? "Mức ưu tiên" : "Priority"} value={draft.priority} onChange={(event) => update("priority", event.target.value as DealPriority)}><option value="LOW">{vi ? "Thấp" : "Low"}</option><option value="MEDIUM">{vi ? "Trung bình" : "Medium"}</option><option value="HIGH">{vi ? "Cao" : "High"}</option><option value="URGENT">{vi ? "Khẩn cấp" : "Urgent"}</option></Select>
                <Select label={vi ? "Loại cơ hội" : "Opportunity type"} value={draft.opportunityType} onChange={(event) => update("opportunityType", event.target.value as DealOpportunityType)}><option value="new_sale">{vi ? "Bán mới" : "New sale"}</option><option value="upsell">Upsell</option><option value="cross_sell">Cross-sell</option><option value="renewal">{vi ? "Gia hạn" : "Renewal"}</option><option value="consulting">{vi ? "Tư vấn" : "Consulting"}</option></Select>
                <Input label={vi ? "Ngân sách dự kiến" : "Expected budget"} type="number" min="0" value={String(draft.expectedBudget)} onChange={(event) => update("expectedBudget", Number(event.target.value) || 0)} />
              </div>
              <Input label={vi ? "Rào cản / pain points" : "Pain points"} value={draft.painPoints} onChange={(event) => update("painPoints", event.target.value)} />
              <Textarea label={vi ? "Ghi chú nội bộ" : "Internal notes"} value={draft.notes} onChange={(event) => update("notes", event.target.value)} rows={3} />
            </div>
          ) : null}

          <div className="crm-form-action-bar flex justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="secondary" onClick={onClose}>{vi ? "Hủy" : "Cancel"}</Button><Button type="submit" variant="primary" loading={submitting}>{mode === "create" ? (vi ? "Tạo cơ hội" : "Create opportunity") : (vi ? "Lưu thay đổi" : "Save changes")}</Button></div>
        </form>
      </Modal>
      <ProductPickerModal id={`deal-${mode}-product-picker`} isOpen={isPickerOpen} onClose={() => setIsPickerOpen(false)} onApply={(items) => { applyLineItems(items); setValidationErrors((current) => ({ ...current, demandSummary: "", products: "" })); }} products={productCatalog} initialSelected={draft.lineItems} context="deal" />
    </>
  );
}
