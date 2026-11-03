import { verifyDealProductSelection } from "../hooks/useDealProductSelection";
import { useDealFormController } from "../hooks/useDealFormController";
import { DealBuyerPicker } from "./DealBuyerPicker";
import { DealInterestedProductsPicker } from "./DealInterestedProductsPicker";
import { getDealSelectionAuthority, useDealSelectionAuthority } from "../hooks/useDealSelectionQueries";
import { useDealStages } from "../hooks/useDealStages";
import { createDraft } from "./dealFormModel";
import type { DealFormMode, DealPriority, DealOpportunityType, DealOwnerOption, DealFormDraft } from "./dealFormModel";
export { mapSelectedPickerItemsToDealLineItems } from "./dealFormModel";
export type { DealFormMode, DealPriority, DealOpportunityType, DealOwnerOption, DealFormDraft } from "./dealFormModel";
import React from "react";
import { createDurableId } from "@/shared/ids";
import { ChevronDown, ChevronUp, Zap } from "lucide-react";
import { Button, Checkbox, Input, Modal, Select, Textarea, ConfirmDialog } from "@/shared/components/ui";
import { FieldHelp } from "@/guidance/presentation/FieldHelp";
import { useI18n } from "@/i18n";

import { useWorkspaceCurrencyChoices, useWorkspaceRuntimeSettings } from "@/platform/workspace-config";
import type {
  DealForecastCategory,
  OpportunityStageConfig,
} from "../../domain/model/deal.types";

import type { Deal } from "../../domain/model/deal.types";
import { getWorkspaceContextSnapshot, useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { registerUnsavedWork } from "@/platform/unsaved-work";
import { normalizeApplicationError } from "@/shared/domain";
import { formatApplicationError } from "@/shared/operations";

export interface DealFormModalProps {
  isOpen: boolean;
  onClose(): void;
  mode: DealFormMode;
  initialValues?: Partial<DealFormDraft>;
  owners: DealOwnerOption[];
  stages: OpportunityStageConfig[];
  canAssign?: boolean;
  customerNameLocked?: boolean;
  allowFollowUpTask?: boolean;
  productsEnabled?: boolean;
  target?: Deal | null;
  sourceKey?: string;
  onSubmit(draft: DealFormDraft, opening: Deal | null, intentId: string, openingSourceKey?: string): void | boolean | Promise<void | boolean>;
  submitting?: boolean;
  error?: string;
}

export function DealFormModal({
  isOpen,
  onClose,
  mode: requestedMode,
  initialValues,
  target,
  sourceKey,
  owners,
  stages: initialStages,
  canAssign = true,
  customerNameLocked = false,
  allowFollowUpTask = true,

  productsEnabled = true,
  onSubmit,
  submitting = false,
  error,
}: DealFormModalProps) {
  const { t, locale } = useI18n();
  const formController = useDealFormController();
  const currencyChoices = useWorkspaceCurrencyChoices();
  const runtimeSettings = useWorkspaceRuntimeSettings();
  const workspace = useWorkspaceContextSnapshot();
  const openingWorkspace = React.useRef(workspace.workspaceId);
  const vi = locale === "vi";
  const openingMode = React.useRef(requestedMode);
  const mode = openingMode.current;
  const openingSubmit = React.useRef(onSubmit);
  const authority = useDealSelectionAuthority();
  const openingAuthority = React.useRef(authority);
  const draftFactory = React.useCallback(() => createDraft({ ...initialValues, ...(target ? { buyerRef: target.buyerRef, expectedCloseDate: initialValues?.expectedCloseDate ?? target.expectedCloseDate, interestedProductIds: target.interestedProducts, amountDecimal: target.amountDecimal ?? (target.amount === null ? "" : String(target.amount)), currency: target.currency } : {}), lineItems: [] }, owners, initialStages, runtimeSettings.baseCurrency), [initialValues, target, owners, initialStages, runtimeSettings.baseCurrency]);
  const [draft, setDraft] = React.useState<DealFormDraft>(draftFactory);
  const registry = useDealStages(mode === "edit" ? (target?.pipelineId ?? draft.pipeline) || undefined : undefined);
  const stages = registry.pipeline?.stages ?? (registry.pipelineQuery.connected ? [] : initialStages);
  const [showAdvanced, setShowAdvanced] = React.useState(mode === "edit");
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});

  const wasOpen = React.useRef(false);


  const opening = React.useRef<Deal | null>(target ? structuredClone(target) : null);
  const openingSourceKey = React.useRef(sourceKey);
  const initial = React.useRef(draft);
  const defaultOpenStage = stages.filter(stage => stage.isActive && stage.category === "open").sort((a, b) => a.order - b.order)[0]?.code;
  React.useEffect(() => {
    if (!isOpen || mode !== "create" || !defaultOpenStage) return;
    setDraft(current => current.stage ? current : { ...current, stage: defaultOpenStage });
    if (!initial.current.stage) initial.current = { ...initial.current, stage: defaultOpenStage };
  }, [isOpen, mode, defaultOpenStage]);
  const pending = React.useRef(false);
  const mounted = React.useRef(true);
  const cycle = React.useRef(0);
  const intentId = React.useRef(createDurableId("deal-form"));
  const [localPending, setLocalPending] = React.useState(false);
  const [closeConfirm, setCloseConfirm] = React.useState(false);
  const [saveError, setSaveError] = React.useState("");
  const canonical = (value: DealFormDraft) => JSON.stringify({ ...value,
    name: value.name.trim(), customerName: value.customerName.trim(), source: value.source.trim(),
    pipeline: value.pipeline.trim(), demandSummary: value.demandSummary.trim(), painPoints: value.painPoints.trim(),
    nextActionSummary: value.nextActionSummary.trim(), notes: value.notes.trim() });
  const dirty = canonical(draft) !== canonical(initial.current);
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  React.useEffect(() => {
    if (!isOpen) {
      if (wasOpen.current) cycle.current += 1;
      wasOpen.current = false;
      return;
    }
    if (pending.current || (wasOpen.current && getWorkspaceContextSnapshot().workspaceId !== openingWorkspace.current)) return;
    if (isOpen && (!wasOpen.current || ((target?.id !== opening.current?.id || requestedMode !== openingMode.current || sourceKey !== openingSourceKey.current) && !dirty && !pending.current))) {
      openingAuthority.current = authority;
      opening.current = target ? structuredClone(target) : null;
      openingMode.current = requestedMode;
      openingSubmit.current = onSubmit;
      openingWorkspace.current = getWorkspaceContextSnapshot().workspaceId;
      openingSourceKey.current = sourceKey;
      cycle.current += 1;
      intentId.current = createDurableId("deal-form");
      const next = structuredClone(draftFactory());
      if (requestedMode === "create" && !next.stage && defaultOpenStage) next.stage = defaultOpenStage;
      initial.current = next;
      setDraft(next);
      setShowAdvanced(requestedMode === "edit");
      setValidationErrors({});
      setSaveError("");
      setCloseConfirm(false);

    }
    wasOpen.current = isOpen;
  }, [draftFactory, isOpen, requestedMode, target?.id, sourceKey, dirty, localPending]);
  React.useEffect(() => {
    if (isOpen && workspace.workspaceId !== openingWorkspace.current && !dirty && !pending.current) onClose();
  });
  const discard = () => {
    if (pending.current || submitting || !mounted.current) return;
    setDraft(initial.current);

    setCloseConfirm(false);
    onClose();
  };
  const requestClose = () => { if (!pending.current && !submitting) { if (dirty) setCloseConfirm(true); else discard(); } };
  React.useEffect(() => {
    if (!isOpen) return;
    const activeCycle = cycle.current;
    const unregister = registerUnsavedWork({
      id: `deal-form:${opening.current?.id ?? "new"}:${activeCycle}`,
      title: opening.current?.name ?? (vi ? "Tạo cơ hội" : "Create opportunity"),
      isDirty: dirty || localPending || submitting,
      save: () => !mounted.current || pending.current || submitting || cycle.current !== activeCycle || getWorkspaceContextSnapshot().workspaceId !== openingWorkspace.current ? Promise.resolve(false) : save(),
      canDiscard: () => !pending.current && !submitting && mounted.current && cycle.current === activeCycle,
      discard,
    });
    const warn = (event: BeforeUnloadEvent) => { if (dirty || pending.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => { unregister(); window.removeEventListener("beforeunload", warn); };
  });

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

  const save = async (): Promise<boolean> => {
    if (openingAuthority.current !== getDealSelectionAuthority() || pending.current || submitting || !mounted.current || !isOpen || getWorkspaceContextSnapshot().workspaceId !== openingWorkspace.current) return false;
    const nextErrors: Record<string, string> = {};
    if (!draft.name.trim()) nextErrors.name = vi ? "Vui lòng nhập tên cơ hội." : "Enter the opportunity name.";
    if (!draft.buyerRef?.id) nextErrors.customerName = vi ? "Vui lòng chọn hoặc nhập khách hàng liên quan." : "Select or enter the related customer.";
    if (!draft.ownerId) nextErrors.ownerId = vi ? "Vui lòng chọn người phụ trách." : "Select an owner.";
    if (!draft.demandSummary.trim() && !draft.notes.trim() && draft.interestedProductIds.length === 0) {
      const message = vi ? "Hãy mô tả nhu cầu hoặc chọn ít nhất một sản phẩm / dịch vụ." : "Describe the customer need or select at least one product or service.";
      nextErrors.demandSummary = message;
      nextErrors.products = message;
    }
    if (!draft.expectedCloseDate || Number.isNaN(new Date(draft.expectedCloseDate).getTime())) {
      nextErrors.expectedCloseDate = vi ? "Ngày đóng dự kiến không hợp lệ." : "Expected close date is invalid.";
    }
    if (draft.createFollowUpTask) {
      if (!draft.nextActionSummary.trim()) nextErrors.nextActionSummary = vi ? "Nhập tên công việc." : "Enter the task title.";
      if (!draft.nextActionAt || Number.isNaN(new Date(draft.nextActionAt).getTime())) nextErrors.nextActionAt = vi ? "Chọn hạn công việc hợp lệ." : "Choose a valid task due date.";
    }
    if (draft.amountDecimal !== "" && !/^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/.test(draft.amountDecimal)) nextErrors.amount = vi ? "Nhập số thập phân hợp lệ (tối đa 6 chữ số lẻ)." : "Enter a decimal with up to 6 fractional digits.";
    if (mode === "create" && draft.amount === null) nextErrors.amount = vi ? "Nhập giá trị dự kiến." : "Enter an expected amount.";
    if (draft.amount !== null && draft.amount < 0) nextErrors.amount = vi ? "Giá trị cơ hội không được âm." : "Opportunity amount cannot be negative.";
    const selectedStage = stages.find((stage) => stage.code === draft.stage);
    if (selectedStage?.requiresPositiveAmount && (draft.amount === null || draft.amount <= 0)) {
      nextErrors.amount = vi ? "Giai đoạn đề xuất hoặc đàm phán cần có giá trị cơ hội lớn hơn 0." : "Proposal or negotiation requires a positive opportunity amount.";
    }
    if (draft.probability < 0 || draft.probability > 100) nextErrors.probability = vi ? "Xác suất phải từ 0 đến 100%." : "Probability must be between 0 and 100%.";
    if (mode === "create" && (!selectedStage?.isActive || selectedStage.category !== "open" || !registry.pipeline?.active)) {
      nextErrors.stage = vi ? "Cơ hội mới phải bắt đầu ở giai đoạn đang mở." : "A new opportunity must start in an open stage.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      focusFirstInvalidField(nextErrors);
      return false;
    }
    setValidationErrors({});
    const activeCycle = cycle.current;
    pending.current = true;
    setLocalPending(true);
    setSaveError("");
    try {
      await verifyDealProductSelection(draft.interestedProductIds, openingAuthority.current);
      if (!mounted.current || cycle.current !== activeCycle || openingAuthority.current !== getDealSelectionAuthority()) return false;
      const saved = await openingSubmit.current(formController.prepare({
      ...draft,
      name: draft.name.trim(),
      customerName: draft.customerName.trim(),
      source: draft.source.trim(),
      pipeline: draft.pipeline.trim(),
      demandSummary: draft.demandSummary.trim(),
      painPoints: draft.painPoints.trim(),
      nextActionSummary: draft.nextActionSummary.trim(),
      notes: draft.notes.trim(),
      }, intentId.current), opening.current, formController.intentId(intentId.current), openingSourceKey.current);
      if (saved === false) { formController.complete(); return false; }
      if (!mounted.current || cycle.current !== activeCycle || getWorkspaceContextSnapshot().workspaceId !== openingWorkspace.current) return false;
      formController.complete();
      initial.current = draft;
      onClose();
      return true;
    } catch (error) {
      if (mounted.current && cycle.current === activeCycle) {
        formController.failed(error);
        const normalized = normalizeApplicationError(error);
        const aliases: Record<string, string> = { buyerRef: "customerName", stageCode: "stage", pipelineId: "pipeline", opportunityScore: "probability", lineItems: "products", interestedProductIds: "products" };
        const errors = Object.fromEntries(Object.entries(normalized.fieldErrors ?? {}).map(([field, messages]) => {
          const root = field.split(/[.[\/]/)[0] ?? field;
          return [aliases[root] ?? root, messages.join(" ")];
        }));
        setValidationErrors(errors);
        focusFirstInvalidField(errors);
        setSaveError(formatApplicationError(normalized, { locale }));
      }
      return false;
    } finally {
      if (mounted.current) { pending.current = false; setLocalPending(false); }
    }
  };
  const submit = (event: React.FormEvent) => { event.preventDefault(); void save(); };

  const activeStages = stages.filter((stage) => stage.isActive && stage.category === "open").sort((left, right) => left.order - right.order);
  React.useEffect(() => {
    if (authority !== openingAuthority.current) {
      const empty = createDraft(undefined, [], stages, runtimeSettings.baseCurrency);
      opening.current = null;
      initial.current = empty;
      setDraft(empty);
      openingAuthority.current = authority;
      onClose();
    }
  }, [authority, onClose, stages, runtimeSettings.baseCurrency]);
  if (isOpen && authority !== openingAuthority.current) return null;

  return (
    <>
      <Modal
        variant="form"
        isOpen={isOpen}
        onClose={requestClose}
        title={mode === "create" ? (vi ? "Tạo cơ hội" : "Create opportunity") : (vi ? "Chỉnh sửa cơ hội" : "Edit opportunity")}
        size="lg"
      >
        <form id={`deal-${mode}-form`} onSubmit={submit} className="crm-form-surface space-y-5 text-left" data-guidance-id="deals.form.canonical">
          {saveError ? <div role="alert" className="text-xs text-rose-600"><p>{saveError}</p><ul>{Object.entries(validationErrors).filter(([, message]) => message).map(([field, message]) => <li key={field}>{message}</li>)}</ul></div> : null}
          <fieldset disabled={submitting || localPending} className="contents" data-deal-target-id={opening.current?.id ?? "new"} data-deal-source-key={openingSourceKey.current}>
          {error ? <p className="text-xs text-slate-600" role="alert">{error}</p> : null}

          <section className="space-y-4" data-guidance-id="deals.form.quick-create">
            <h3 className="text-sm font-semibold text-slate-900">{vi ? "1. Thông tin cơ hội" : "1. Opportunity"}</h3>
            <Input id={`deal-${mode}-name`} label={vi ? "Tên cơ hội" : "Opportunity name"} value={draft.name} onChange={event => update("name", event.target.value)} required error={validationErrors.name}/>
            <DealBuyerPicker locked={customerNameLocked} value={draft.buyerRef} label={draft.customerName} error={validationErrors.customerName} onChange={(ref, label) => { setDraft(current => ({ ...current, buyerRef: ref, customerName: label })); setValidationErrors(current => ({ ...current, customerName: "" })); }}/>
            <div data-guidance-id="deals.form.owner"><Select id={`deal-${mode}-ownerId`} label={vi ? "Người phụ trách" : "Owner"} value={draft.ownerId} onChange={event => update("ownerId", event.target.value)} disabled={!canAssign} required error={validationErrors.ownerId}>{owners.map(owner => <option key={owner.memberId} value={owner.memberId}>{owner.displayName}</option>)}</Select></div>
          </section>
          <section className="space-y-4 border-t border-slate-100 pt-5">
            <h3 className="text-sm font-semibold text-slate-900">{vi ? "2. Nhu cầu" : "2. Customer need"}</h3>
            {productsEnabled && <DealInterestedProductsPicker ids={draft.interestedProductIds} onChange={ids => update("interestedProductIds", ids)}/>}
            {validationErrors.products && <p className="text-xs italic text-red-600">{validationErrors.products}</p>}
            <Textarea id={`deal-${mode}-demandSummary`} label={vi ? "Mô tả nhu cầu" : "Need description"} value={draft.demandSummary} onChange={event => { update("demandSummary", event.target.value); setValidationErrors(current => ({ ...current, products: "" })); }} rows={3} error={validationErrors.demandSummary}/>
            <Textarea label={vi ? "Ghi chú" : "Notes"} value={draft.notes} onChange={event => update("notes", event.target.value)} rows={2}/>
          </section>
          <section className="space-y-4 border-t border-slate-100 pt-5">
            <h3 className="text-sm font-semibold text-slate-900">{vi ? "3. Dự kiến bán hàng" : "3. Sales forecast"}</h3>
            <p className="text-xs text-slate-500">{registry.pipeline?.name[locale] || (vi ? "Đang xác minh pipeline mặc định…" : "Verifying the default pipeline…")}</p>
            {registry.pipelineQuery.error && <div role="alert" className="text-xs text-red-600"><p>{formatApplicationError(registry.pipelineQuery.error, { locale })}</p><Button type="button" variant="secondary" onClick={() => void registry.pipelineQuery.refresh()}>{vi ? "Thử lại pipeline" : "Retry pipeline"}</Button></div>}
            {validationErrors.pipeline && <p className="text-xs italic text-red-600">{validationErrors.pipeline}</p>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input id={`deal-${mode}-amount`} label={vi ? "Giá trị dự kiến" : "Expected amount"} inputMode="decimal" value={draft.amountDecimal} onChange={event => setDraft(current => ({ ...current, amountDecimal: event.target.value, amount: event.target.value === "" ? null : Number(event.target.value) }))} error={validationErrors.amount}/>
              <Select label={vi ? "Tiền tệ" : "Currency"} value={draft.currency} onChange={event => update("currency", event.target.value)}>{[...new Set([...currencyChoices, draft.currency])].map(code => <option key={code} value={code}>{code}</option>)}</Select>
              <Select id={`deal-${mode}-stage`} label={vi ? "Giai đoạn" : "Stage"} value={draft.stage} error={validationErrors.stage} onChange={event => update("stage", event.target.value)}>{activeStages.map(stage => <option key={stage.code} value={stage.code}>{vi ? stage.labelVi : stage.labelEn}</option>)}</Select>
              <Input id={`deal-${mode}-expectedCloseDate`} label={vi ? "Ngày đóng dự kiến" : "Expected close date"} type="date" value={draft.expectedCloseDate} onChange={event => update("expectedCloseDate", event.target.value)} error={validationErrors.expectedCloseDate}/>
              <Input id={`deal-${mode}-probability`} label={vi ? "Xác suất (%)" : "Probability (%)"} type="number" min="0" max="100" value={String(draft.probability)} onChange={event => update("probability", Number(event.target.value))} error={validationErrors.probability}/>
              <div data-guidance-id="deals.form.forecast-category"><Select label={vi ? "Dự báo" : "Forecast"} value={draft.forecastCategory} onChange={event => update("forecastCategory", event.target.value as DealForecastCategory)}><option value="PIPELINE">Pipeline</option><option value="BEST_CASE">Best case</option><option value="COMMIT">Commit</option></Select></div>
            </div>
          </section>
          {allowFollowUpTask && <section data-guidance-id="deals.form.next-step" className="space-y-3 border-t border-slate-100 pt-4">
            <Checkbox id={`deal-${mode}-follow-up-task`} label={vi ? "Tạo công việc theo dõi sau khi lưu" : "Create a follow-up task after saving"} checked={draft.createFollowUpTask} onChange={event => update("createFollowUpTask", event.target.checked)}/>
            {draft.createFollowUpTask && <div className="grid gap-3 sm:grid-cols-2"><Input id={`deal-${mode}-nextActionSummary`} label={vi ? "Tên công việc" : "Task title"} value={draft.nextActionSummary} onChange={event => update("nextActionSummary", event.target.value)} error={validationErrors.nextActionSummary}/><Input id={`deal-${mode}-nextActionAt`} label={vi ? "Hạn công việc" : "Task due"} type="datetime-local" value={draft.nextActionAt} onChange={event => update("nextActionAt", event.target.value)} error={validationErrors.nextActionAt}/></div>}
          </section>}
          </fieldset>
          <div className="crm-form-action-bar flex justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="secondary" onClick={requestClose}>{vi ? "Hủy" : "Cancel"}</Button><Button type="submit" variant="primary" loading={submitting || localPending}>{mode === "create" ? (vi ? "Tạo cơ hội" : "Create opportunity") : (vi ? "Lưu thay đổi" : "Save changes")}</Button></div>
        </form>
      </Modal>
      <ConfirmDialog isOpen={closeConfirm} onClose={() => setCloseConfirm(false)} onConfirm={discard}
        title={vi ? "Bỏ thay đổi chưa lưu?" : "Discard unsaved changes?"}
        message={vi ? "Các thay đổi chưa được lưu." : "Your changes have not been saved."}
        confirmText={vi ? "Bỏ thay đổi" : "Discard changes"}
        cancelText={vi ? "Tiếp tục chỉnh sửa" : "Keep editing"} type="warning" />

    </>
  );
}
