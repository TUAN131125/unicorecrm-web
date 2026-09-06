import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Ban, HeartHandshake, ShoppingCart, TrendingUp } from "lucide-react";
import { Button, Checkbox, Input, Textarea } from "@/shared/components/ui";
import { getContactsSnapshot, subscribeToContacts, type Contact } from "@/modules/contacts";
import { disqualifyLeadViaApi, getLeadSnapshot, LeadWorkState, subscribeToLeads, type Lead } from "@/modules/leads";
import { getOrganizationAccountsSnapshot, subscribeToOrganizationAccounts, type OrganizationAccount } from "@/modules/organizations";
import {
  getProductCatalogSnapshot,
  ProductPickerModal,
  subscribeToProductCatalog,
  type Product,
  type SelectedPickerItem,
} from "@/modules/products";
import { useWorkspaceConfigSnapshot, useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import { useI18n } from "@/i18n";
import { formatApplicationError } from "@/shared/operations";
import { normalizeApplicationError } from "@/shared/domain";
import { executeLeadNurtureCommand, executeLeadOpportunityCommand } from "../../public/leadQualification";
import type { LeadQualificationResult, LeadRelationshipInput } from "../../domain/leadQualification.types";
import { RelationshipResolutionFields } from "../components/RelationshipResolutionFields";
import { LeadQualificationValidationError, type LeadQualificationFieldErrors } from "../../domain/leadQualification.rules";
import {
  isLeadDirectSaleQualificationUnavailable,
  isLeadOrganizationQualificationUnavailable,
} from "../../application/leadQualificationAvailability";

function createRelationshipInput(lead: Lead, organizationAvailable: boolean): LeadRelationshipInput {
  return {
    kind: organizationAvailable && lead.companyName?.trim() ? "ORGANIZATION_ACCOUNT" : "CONTACT",
    mode: "NEW",
    contact: { name: lead.name, email: lead.email, phone: lead.phone, title: lead.title },
    organization: { displayName: lead.companyName || "", phone: lead.companyPhone, address: lead.address, industry: lead.industry },
  };
}

const BACKEND_FIELD_KEYS: Record<string, keyof LeadQualificationFieldErrors> = {
  "relationship.selectedId": "relationship.selectedId",
  "relationship.contact.displayName": "relationship.contact.name",
  "relationship.contact.email": "relationship.contact.email",
  "relationship.contact.phone": "relationship.contact.phone",
  "deal.name": "deal.name",
  "deal.ownerId": "deal.ownerId",
  "deal.expectedCloseDate": "deal.expectedCloseDate",
  "deal.estimatedValue.amount": "deal.estimatedValue",
  "deal.interestedProductIds": "deal.interestedProducts",
  "deal.followUpTask.title": "deal.followUpTaskTitle",
  "deal.followUpTask.dueAt": "deal.followUpTaskDueAt",
  revisitAt: "nurture.revisitAt",
  reason: "nurture.reason",
};

function mapBackendFieldErrors(fieldErrors: Record<string, string[]> | undefined): LeadQualificationFieldErrors {
  const mapped: LeadQualificationFieldErrors = {};
  for (const [field, messages] of Object.entries(fieldErrors ?? {})) {
    const message = messages[0];
    if (!message) continue;
    if (field === "deal") {
      mapped["deal.needSummary"] = message;
      mapped["deal.interestedProducts"] = message;
      continue;
    }
    const key = BACKEND_FIELD_KEYS[field];
    if (key) mapped[key] = message;
  }
  return mapped;
}

function leadInterestedProductIds(lead: Lead): string[] {
  return (lead.interestedProducts ?? []).map((item) => typeof item === "string" ? item : item.productId).filter(Boolean);
}

const FIELD_IDS: Partial<Record<keyof LeadQualificationFieldErrors, string>> = {
  "relationship.selectedId": "qualification-relationship-selected",
  "relationship.contact.name": "qualification-contact-name",
  "relationship.contact.email": "qualification-contact-email",
  "relationship.contact.phone": "qualification-contact-phone",
  "relationship.organization.displayName": "qualification-organization-name",
  "deal.name": "qualification-deal-name",
  "deal.needSummary": "qualification-need-summary",
  "deal.expectedCloseDate": "qualification-close-date",
  "deal.followUpTaskTitle": "qualification-follow-up-task-title",
  "deal.followUpTaskDueAt": "qualification-follow-up-task-due",
  "deal.estimatedValue": "qualification-estimated-value",
  "deal.interestedProducts": "qualification-products",
  "disqualified.reason": "qualification-disqualified-reason",
  "disqualified.evidence": "qualification-disqualified-evidence",
  "nurture.revisitAt": "qualification-revisit-date",
  "nurture.reason": "qualification-nurture-reason",
};


function localizeQualificationErrors(errors: LeadQualificationFieldErrors, vi: boolean): LeadQualificationFieldErrors {
  if (!vi) return errors;
  const messages: Partial<Record<keyof LeadQualificationFieldErrors, string>> = {
    outcome: "Kết quả này hiện không khả dụng.",
    "relationship.selectedId": "Chọn một liên hệ hoặc tổ chức đã có.",
    "relationship.contact.name": "Nhập tên người liên hệ.",
    "relationship.contact.email": "Email người liên hệ không hợp lệ.",
    "relationship.contact.phone": "Số điện thoại người liên hệ không hợp lệ.",
    "relationship.organization.displayName": "Nhập tên tổ chức.",
    "relationship.organization.email": "Email tổ chức không hợp lệ.",
    "relationship.organization.phone": "Số điện thoại tổ chức không hợp lệ.",
    "deal.name": "Nhập tên cơ hội.",
    "deal.needSummary": "Mô tả nhu cầu hoặc chọn ít nhất một sản phẩm / dịch vụ.",
    "deal.ownerId": "Cơ hội cần có người phụ trách.",
    "deal.expectedCloseDate": "Ngày dự kiến chốt không hợp lệ.",
    "deal.estimatedValue": "Giá trị ước tính phải là số không âm.",
    "deal.interestedProducts": "Mô tả nhu cầu hoặc chọn ít nhất một sản phẩm / dịch vụ.",
    "deal.followUpTaskTitle": "Nhập tên công việc.",
    "deal.followUpTaskDueAt": "Chọn hạn công việc hợp lệ.",
    "disqualified.reason": "Nhập lý do không phù hợp.",
    "disqualified.evidence": "Nhập bằng chứng hoặc ghi chú xác minh.",
    "nurture.revisitAt": "Chọn ngày quay lại.",
    "nurture.reason": "Nhập lý do chăm sóc thêm.",
  };
  return Object.fromEntries(
    Object.entries(errors).map(([key, value]) => [key, messages[key as keyof LeadQualificationFieldErrors] || value]),
  ) as LeadQualificationFieldErrors;
}

function focusFirstInvalidField(errors: LeadQualificationFieldErrors) {
  const order: Array<keyof LeadQualificationFieldErrors> = [
    "disqualified.reason",
    "disqualified.evidence",
    "relationship.selectedId",
    "relationship.organization.displayName",
    "relationship.contact.name",
    "relationship.contact.email",
    "relationship.contact.phone",
    "nurture.revisitAt",
    "nurture.reason",
    "deal.name",
    "deal.needSummary",
    "deal.interestedProducts",
    "deal.expectedCloseDate",
    "deal.estimatedValue",
    "deal.followUpTaskTitle",
    "deal.followUpTaskDueAt",
  ];
  window.requestAnimationFrame(() => {
    const key = order.find((candidate) => Boolean(errors[candidate]));
    const id = key ? FIELD_IDS[key] : undefined;
    const element = id ? document.getElementById(id) : null;
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    element?.focus({ preventScroll: true });
  });
}

export const LeadQualificationPage: React.FC = () => {
  const { leadId } = useParams();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const vi = locale === "vi";
  const crmConfig = useWorkspaceConfigSnapshot();
  const operationalConfiguration = useWorkspaceOperationalConfiguration();
  const organizationAvailable = !isLeadOrganizationQualificationUnavailable();
  const directSaleAvailable = !isLeadDirectSaleQualificationUnavailable();
  const [lead, setLead] = useState<Lead | undefined>(() => leadId ? getLeadSnapshot(leadId) : undefined);
  const [contacts, setContacts] = useState<Contact[]>(() => getContactsSnapshot());
  const [organizations, setOrganizations] = useState<OrganizationAccount[]>(() => getOrganizationAccountsSnapshot());
  const [products, setProducts] = useState<Product[]>(() => getProductCatalogSnapshot());
  const [selectedOutcome, setSelectedOutcome] = useState<"DISQUALIFIED" | "NURTURE" | "OPPORTUNITY" | null>(null);
  const [relationship, setRelationship] = useState<LeadRelationshipInput | null>(() => lead ? createRelationshipInput(lead, organizationAvailable) : null);
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [revisitAt, setRevisitAt] = useState("");
  const [dealName, setDealName] = useState("");
  const [needSummary, setNeedSummary] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [createFollowUpTask, setCreateFollowUpTask] = useState(false);
  const [followUpTaskTitle, setFollowUpTaskTitle] = useState("");
  const [followUpTaskDueAt, setFollowUpTaskDueAt] = useState("");
  const [interestedProductIds, setInterestedProductIds] = useState<string[]>(() => lead ? leadInterestedProductIds(lead) : []);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<LeadQualificationFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [completion, setCompletion] = useState<{
    result: LeadQualificationResult;
    outcome?: "COMMITTED" | "REPLAYED" | "DEMO_COMMITTED";
  } | null>(null);

  useEffect(() => subscribeToLeads(() => setLead(leadId ? getLeadSnapshot(leadId) : undefined)), [leadId]);
  useEffect(() => subscribeToContacts(setContacts), []);
  useEffect(() => subscribeToOrganizationAccounts(setOrganizations), []);
  useEffect(() => subscribeToProductCatalog(setProducts), []);
  useEffect(() => {
    if (!lead) return;
    setRelationship((current) => current ?? createRelationshipInput(lead, organizationAvailable));
    setDealName((current) => current || `${vi ? "Cơ hội" : "Opportunity"} - ${lead.companyName || lead.name}`);
    setNeedSummary((current) => current || lead.painPoint || lead.qualificationNotes || "");
    setEstimatedValue((current) => current || (lead.expectedValue === undefined ? "" : String(lead.expectedValue)));
    setInterestedProductIds((current) => current.length > 0 ? current : leadInterestedProductIds(lead));
  }, [lead, organizationAvailable, vi]);

  const dealEnabled = crmConfig.modules.deals && crmConfig.workflow.dealUsageMode !== "DISABLED";
  const eligible = lead?.leadWorkState === LeadWorkState.VERIFYING;
  const outcomeCards = useMemo(() => [
    { key: "DISQUALIFIED" as const, title: vi ? "Không phù hợp" : "Disqualify", desc: vi ? "Đóng tiềm năng với lý do và bằng chứng." : "Close the lead with a reason and evidence.", icon: <Ban size={18} /> },
    { key: "NURTURE" as const, title: vi ? "Chăm sóc thêm" : "Nurture", desc: vi ? "Tạo lịch quay lại khi khách hàng chưa sẵn sàng." : "Schedule a follow-up when the buyer is not ready.", icon: <HeartHandshake size={18} /> },
    { key: "OPPORTUNITY" as const, title: vi ? "Tạo cơ hội" : "Create opportunity", desc: vi ? "Tạo cơ hội khi đã ghi nhận nhu cầu hoặc sản phẩm quan tâm. Công việc theo dõi là tùy chọn." : "Create an opportunity when either the customer need or interested products are known. A follow-up task is optional.", icon: <TrendingUp size={18} /> },
  ], [vi]);

  const selectedProductItems: SelectedPickerItem[] = interestedProductIds
    .map((productId) => products.find((product) => product.id === productId))
    .filter((product): product is Product => Boolean(product))
    .map((product) => ({ product, quantity: 1 }));

  if (!lead) return <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">{vi ? "Không tìm thấy tiềm năng." : "Lead not found."}</div>;

  const clearFieldError = (key: keyof LeadQualificationFieldErrors) => {
    if (!fieldErrors[key]) return;
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const run = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setOperationError(null);
    setFieldErrors({});

    const localErrors: LeadQualificationFieldErrors = {};
    if (selectedOutcome === "DISQUALIFIED") {
      if (!reason.trim()) localErrors["disqualified.reason"] = vi ? "Nhập lý do không phù hợp." : "Enter the disqualification reason.";
      if (!evidence.trim()) localErrors["disqualified.evidence"] = vi ? "Nhập bằng chứng hoặc ghi chú xác minh." : "Enter evidence or verification notes.";
    }
    if (selectedOutcome === "NURTURE") {
      if (!revisitAt) localErrors["nurture.revisitAt"] = vi ? "Chọn ngày quay lại." : "Choose a revisit date.";
      if (!reason.trim()) localErrors["nurture.reason"] = vi ? "Nhập lý do chăm sóc thêm." : "Enter the nurture reason.";
    }
    if (selectedOutcome === "OPPORTUNITY") {
      if (!dealName.trim()) localErrors["deal.name"] = vi ? "Nhập tên cơ hội." : "Enter the opportunity name.";
      if (!needSummary.trim() && interestedProductIds.length === 0) {
        const message = vi ? "Mô tả nhu cầu hoặc chọn ít nhất một sản phẩm / dịch vụ." : "Describe the need or select at least one product or service.";
        localErrors["deal.needSummary"] = message;
        localErrors["deal.interestedProducts"] = message;
      }
      if (expectedCloseDate && Number.isNaN(new Date(expectedCloseDate).getTime())) localErrors["deal.expectedCloseDate"] = vi ? "Ngày dự kiến chốt không hợp lệ." : "Expected close date is invalid.";
      const numericEstimatedValue = estimatedValue === "" ? undefined : Number(estimatedValue);
      if (numericEstimatedValue !== undefined && (!Number.isFinite(numericEstimatedValue) || numericEstimatedValue < 0)) localErrors["deal.estimatedValue"] = vi ? "Giá trị ước tính phải là số không âm." : "Estimated value must be non-negative.";
      if (createFollowUpTask) {
        if (!followUpTaskTitle.trim()) localErrors["deal.followUpTaskTitle"] = vi ? "Nhập tên công việc." : "Enter the task title.";
        if (!followUpTaskDueAt || Number.isNaN(new Date(followUpTaskDueAt).getTime())) localErrors["deal.followUpTaskDueAt"] = vi ? "Chọn hạn công việc hợp lệ." : "Choose a valid task due date.";
      }
    }
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      focusFirstInvalidField(localErrors);
      return;
    }

    setSubmitting(true);
    try {
      if (!eligible) { setOperationError(vi ? "Tiềm năng phải ở bước Đang xác minh." : "Lead must be in Verifying."); return; }
      if (selectedOutcome === "DISQUALIFIED") {
        await disqualifyLeadViaApi(lead.id, { reason, evidence });
        navigate(`/leads/${lead.id}`);
      } else if (selectedOutcome === "NURTURE") {
        if (!relationship) { setOperationError(vi ? "Thiếu thông tin quan hệ khách hàng." : "Relationship input is missing."); return; }
        const outcome = await executeLeadNurtureCommand({ leadId: lead.id, relationship, revisitAt, reason, note: evidence, ownerId: lead.ownerId });
        setCompletion({ result: outcome.data, ...(outcome.outcome === undefined ? {} : { outcome: outcome.outcome }) });
        setSelectedOutcome(null);
      } else if (selectedOutcome === "OPPORTUNITY") {
        if (!relationship) { setOperationError(vi ? "Thiếu thông tin quan hệ khách hàng." : "Relationship input is missing."); return; }
        const outcome = await executeLeadOpportunityCommand({
          leadId: lead.id,
          relationship,
          dealsEnabled: dealEnabled,
          currency: operationalConfiguration.localeRegion.currencies.baseCurrency,
          deal: {
            name: dealName,
            needSummary,
            ownerId: lead.ownerId,
            expectedCloseDate,
            estimatedValue: estimatedValue === "" ? undefined : Number(estimatedValue),
            interestedProductIds,
            followUpTask: createFollowUpTask ? {
              title: followUpTaskTitle,
              dueAt: followUpTaskDueAt,
              description: needSummary || undefined,
            } : undefined,
          },
        });
        setCompletion({ result: outcome.data, ...(outcome.outcome === undefined ? {} : { outcome: outcome.outcome }) });
        setSelectedOutcome(null);
      } else {
        setOperationError(vi ? "Chọn một kết quả xử lý." : "Choose a qualification outcome.");
        return;
      }
    } catch (caught) {
      if (caught instanceof LeadQualificationValidationError) {
        const localizedErrors = localizeQualificationErrors(caught.fieldErrors, vi);
        setFieldErrors(localizedErrors);
        focusFirstInvalidField(localizedErrors);
      } else {
        const normalized = normalizeApplicationError(caught);
        const backendErrors = mapBackendFieldErrors(normalized.fieldErrors);
        if (Object.keys(backendErrors).length > 0) {
          const localizedErrors = localizeQualificationErrors(backendErrors, vi);
          setFieldErrors(localizedErrors);
          focusFirstInvalidField(localizedErrors);
        }
        // MA-08: an authoritative refusal carries an internal diagnostic (workflow ids,
        // command classifications). The central formatter owns what a user may see.
        setOperationError(formatApplicationError(caught, { locale }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-2 text-xs">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{vi ? "Chốt kết quả tiềm năng" : "Resolve lead qualification"}</h1>
          <p className="mt-1 text-slate-500">{lead.name} · {lead.companyName || (vi ? "Cá nhân" : "Individual")}</p>
        </div>
        <Button variant="secondary" size="sm" icon={<ArrowLeft size={13} />} onClick={() => navigate(`/leads/${lead.id}`)}>{vi ? "Quay lại" : "Back"}</Button>
      </div>

      {!eligible && <p className="text-sm text-slate-600">{vi ? "Tiềm năng phải ở bước Đang xác minh trước khi chốt kết quả." : "The lead must be in Verifying before an outcome can be committed."}</p>}

      {completion && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">
          <p className="font-semibold">
            {completion.outcome === "REPLAYED"
              ? (vi ? "Qualification đã hoàn tất trước đó; kết quả authoritative đã được tải lại." : "Qualification was already completed; the authoritative result has been reloaded.")
              : (vi ? "Qualification đã được backend hoàn tất và Lead đã được tải lại." : "The backend completed qualification and the Lead has been refreshed.")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => navigate(`/leads/${completion.result.leadId}`)}>{vi ? "Mở Lead" : "Open Lead"}</Button>
            {completion.result.contactId && <Button type="button" variant="secondary" size="sm" onClick={() => navigate(`/contacts/${completion.result.contactId}`)}>{vi ? "Mở Contact" : "Open Contact"}</Button>}
            {completion.result.taskId && <Button type="button" variant="secondary" size="sm" onClick={() => navigate(`/tasks/${completion.result.taskId}`)}>{vi ? "Mở công việc" : "Open Task"}</Button>}
            {completion.result.dealId && <Button type="button" variant="secondary" size="sm" onClick={() => navigate(`/deals/${completion.result.dealId}`)}>{vi ? "Mở cơ hội" : "Open Deal"}</Button>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {outcomeCards.map((card) => {
          const unavailable = card.key === "OPPORTUNITY" && !dealEnabled;
          return (
            <button
              key={card.key}
              type="button"
              disabled={unavailable}
              onClick={() => { setSelectedOutcome(card.key); setFieldErrors({}); setOperationError(null); }}
              className={`rounded-xl border p-4 text-left transition ${selectedOutcome === card.key ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-200"} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60`}
            >
              <span className="text-indigo-600">{card.icon}</span>
              <div className="mt-3 font-semibold text-slate-900">{card.title}</div>
              <div className="mt-1 text-[11px] leading-relaxed text-slate-500">{card.desc}</div>
              {unavailable && <div className="mt-2 text-[10px] text-slate-500">{vi ? "Phân hệ Cơ hội đang tắt." : "Opportunity module is disabled."}</div>}
            </button>
          );
        })}
        <button type="button" disabled={!directSaleAvailable} onClick={() => navigate(`/leads/${lead.id}/sell-now`)} className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60">
          <ShoppingCart size={18} className="text-emerald-600" />
          <div className="mt-3 font-semibold text-slate-900">{vi ? "Bán ngay" : "Sell now"}</div>
          <div className="mt-1 text-[11px] leading-relaxed text-slate-500">{vi ? "Tạo báo giá hoặc đơn hàng mà không tạo cơ hội ngầm." : "Create a quote or order without a hidden opportunity."}</div>
          {!directSaleAvailable && <div className="mt-2 text-[10px] text-slate-500">{vi ? "Direct Sale chưa khả dụng trong chế độ kết nối." : "Direct Sale is unavailable in connected mode."}</div>}
        </button>
      </div>

      {selectedOutcome && (
        <form onSubmit={run} className="crm-form-surface space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" noValidate>
          {selectedOutcome === "DISQUALIFIED" && (
            <div className="grid grid-cols-1 gap-4">
              <Input id="qualification-disqualified-reason" label={vi ? "Lý do không phù hợp" : "Disqualification reason"} value={reason} onChange={(event) => { setReason(event.target.value); clearFieldError("disqualified.reason"); }} error={fieldErrors["disqualified.reason"]} required />
              <Textarea id="qualification-disqualified-evidence" label={vi ? "Bằng chứng / ghi chú xác minh" : "Evidence / verification notes"} value={evidence} onChange={(event) => { setEvidence(event.target.value); clearFieldError("disqualified.evidence"); }} error={fieldErrors["disqualified.evidence"]} required />
            </div>
          )}

          {(selectedOutcome === "NURTURE" || selectedOutcome === "OPPORTUNITY") && relationship && (
            <RelationshipResolutionFields
              value={relationship}
              onChange={(next) => {
                setRelationship(next);
                setFieldErrors((current) => ({
                  ...current,
                  "relationship.selectedId": undefined,
                  "relationship.contact.name": undefined,
                  "relationship.contact.email": undefined,
                  "relationship.contact.phone": undefined,
                  "relationship.organization.displayName": undefined,
                  "relationship.organization.email": undefined,
                  "relationship.organization.phone": undefined,
                }));
              }}
              contacts={contacts}
              organizations={organizations}
              locale={locale}
              errors={fieldErrors}
              organizationAvailable={organizationAvailable}
            />
          )}

          {selectedOutcome === "NURTURE" && (
            <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 md:grid-cols-2">
              <Input id="qualification-revisit-date" label={vi ? "Ngày quay lại" : "Revisit date"} type="date" value={revisitAt} onChange={(event) => { setRevisitAt(event.target.value); clearFieldError("nurture.revisitAt"); }} error={fieldErrors["nurture.revisitAt"]} required />
              <Input id="qualification-nurture-reason" label={vi ? "Lý do chăm sóc thêm" : "Nurture reason"} value={reason} onChange={(event) => { setReason(event.target.value); clearFieldError("nurture.reason"); }} error={fieldErrors["nurture.reason"]} required />
              <Textarea className="md:col-span-2" label={vi ? "Ghi chú" : "Notes"} value={evidence} onChange={(event) => setEvidence(event.target.value)} />
            </div>
          )}

          {selectedOutcome === "OPPORTUNITY" && (
            <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 md:grid-cols-2">
              <Input id="qualification-deal-name" label={vi ? "Tên cơ hội" : "Opportunity name"} value={dealName} onChange={(event) => { setDealName(event.target.value); clearFieldError("deal.name"); }} error={fieldErrors["deal.name"]} required />
              <Input id="qualification-estimated-value" label={vi ? "Giá trị ước tính" : "Estimated value"} type="number" min="0" value={estimatedValue} onChange={(event) => { setEstimatedValue(event.target.value); clearFieldError("deal.estimatedValue"); }} error={fieldErrors["deal.estimatedValue"]} />
              <div className="md:col-span-2">
                <Textarea
                  id="qualification-need-summary"
                  label={vi ? "Nhu cầu / vấn đề cần giải quyết" : "Need / problem to solve"}
                  value={needSummary}
                  onChange={(event) => {
                    setNeedSummary(event.target.value);
                    clearFieldError("deal.needSummary");
                    clearFieldError("deal.interestedProducts");
                  }}
                  error={fieldErrors["deal.needSummary"]}
                />
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  {vi ? "Nhập nhu cầu nếu chưa chọn sản phẩm. Cần ít nhất một trong hai thông tin." : "Describe the need when no product is selected. At least one of these two inputs is required."}
                </p>
              </div>
              <Input id="qualification-close-date" label={vi ? "Ngày dự kiến chốt" : "Target close date"} type="date" value={expectedCloseDate} onChange={(event) => { setExpectedCloseDate(event.target.value); clearFieldError("deal.expectedCloseDate"); }} error={fieldErrors["deal.expectedCloseDate"]} />

              <div id="qualification-products" tabIndex={-1} aria-invalid={Boolean(fieldErrors["deal.interestedProducts"])} className="space-y-3 rounded-xl border border-slate-200 p-4 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 md:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{vi ? "Sản phẩm / dịch vụ quan tâm" : "Interested products / services"}</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500">{vi ? "Có thể để trống khi đã mô tả rõ nhu cầu cần giải quyết." : "This can be empty when the customer need is described clearly."}</p>
                  </div>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setProductPickerOpen(true)}>{vi ? "Chọn sản phẩm" : "Select products"}</Button>
                </div>
                {selectedProductItems.length === 0 ? (
                  <p className="text-xs text-slate-500">{vi ? "Chưa chọn sản phẩm." : "No products selected."}</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {selectedProductItems.map(({ product }) => (
                      <div key={product.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="break-words text-xs font-medium text-slate-900">{product.name}</p>
                          <p className="mt-0.5 break-all text-[10px] text-slate-500">{product.sku}</p>
                        </div>
                        <button type="button" onClick={() => {
                          setInterestedProductIds((current) => current.filter((id) => id !== product.id));
                          clearFieldError("deal.interestedProducts");
                          clearFieldError("deal.needSummary");
                        }} className="text-[11px] text-slate-500 underline underline-offset-2 hover:text-slate-900">{vi ? "Bỏ" : "Remove"}</button>
                      </div>
                    ))}
                  </div>
                )}
                {fieldErrors["deal.interestedProducts"] && <p className="text-[11px] text-rose-600">{vi ? "Hãy mô tả nhu cầu hoặc chọn ít nhất một sản phẩm / dịch vụ." : fieldErrors["deal.interestedProducts"]}</p>}
              </div>

              <div className="space-y-3 rounded-xl border border-slate-200 p-4 md:col-span-2">
                <Checkbox
                  id="qualification-create-follow-up-task"
                  label={vi ? "Tạo công việc theo dõi sau khi tạo cơ hội" : "Create a follow-up task after creating the opportunity"}
                  checked={createFollowUpTask}
                  onChange={(event) => {
                    setCreateFollowUpTask(event.target.checked);
                    if (!event.target.checked) {
                      clearFieldError("deal.followUpTaskTitle");
                      clearFieldError("deal.followUpTaskDueAt");
                    }
                  }}
                />
                {createFollowUpTask && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Input id="qualification-follow-up-task-title" label={vi ? "Tên công việc" : "Task title"} value={followUpTaskTitle} onChange={(event) => { setFollowUpTaskTitle(event.target.value); clearFieldError("deal.followUpTaskTitle"); }} error={fieldErrors["deal.followUpTaskTitle"]} required />
                    <Input id="qualification-follow-up-task-due" label={vi ? "Hạn công việc" : "Task due date"} type="datetime-local" value={followUpTaskDueAt} onChange={(event) => { setFollowUpTaskDueAt(event.target.value); clearFieldError("deal.followUpTaskDueAt"); }} error={fieldErrors["deal.followUpTaskDueAt"]} required />
                  </div>
                )}
              </div>
            </div>
          )}

          {operationError && <p role="alert" className="text-sm text-rose-700">{operationError}</p>}
          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={submitting} disabled={!eligible || (selectedOutcome === "OPPORTUNITY" && !dealEnabled)}>{vi ? "Xác nhận kết quả" : "Commit outcome"}</Button>
          </div>
        </form>
      )}

      <ProductPickerModal
        id="qualification-product-picker"
        isOpen={productPickerOpen}
        onClose={() => setProductPickerOpen(false)}
        products={products}
        context="lead_interest"
        initialSelected={selectedProductItems}
        onApply={(items) => {
          setInterestedProductIds(items.map((item) => item.product.id));
          clearFieldError("deal.interestedProducts");
          clearFieldError("deal.needSummary");
        }}
      />
    </div>
  );
};
