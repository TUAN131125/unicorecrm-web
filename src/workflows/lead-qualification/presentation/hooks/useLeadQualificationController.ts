import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTargetBoundWorkflow } from "@/shared/presentation/useTargetBoundWorkflow";
import { useNavigate, useParams } from "react-router-dom";
import { toWorkspacePath } from "@/platform/navigation";


import { readContactById, type Contact } from "@/modules/contacts";
import { disqualifyLeadViaApi, getLeadSnapshot, LeadWorkState, subscribeToLeads, type Lead } from "@/modules/leads";
import { getOrganizationAccountsSnapshot, subscribeToOrganizationAccounts, type OrganizationAccount } from "@/modules/organizations";
import { getDealSelectionAuthority, useDealSelectionAuthority } from "@/modules/deals";
import { useOpportunityEstimate } from "./useOpportunityEstimate";
import { resolveProductSelectionIds } from "@/modules/products";
import { getWorkspaceMemberOptions } from "@/platform/member-directory";
import { canRetainOpportunityIntent, createLeadOpportunityIntent, type LeadOpportunityIntent } from "../model/leadOpportunityIntent";
import { presentOpportunityFieldErrors } from "../model/leadOpportunityFieldErrors";
import { getLeadDetailResource, useLeadAuthoritativeResource } from "@/modules/leads";
import { ApplicationError } from "@/shared/domain";
import { getDirtyUnsavedWork, getUnsavedWorkVersion, subscribeUnsavedWork } from "@/platform/unsaved-work";
import { useWorkspaceConfigSnapshot, useWorkspaceRuntimeSettings } from "@/platform/workspace-config";
import { useI18n } from "@/i18n";
import { formatApplicationError } from "@/shared/operations";
import { normalizeApplicationError } from "@/shared/domain";
import { executeLeadNurtureCommand, executeLeadOpportunityCommand } from "../../public/leadQualification";
import type { LeadQualificationResult, LeadRelationshipInput } from "../../domain/leadQualification.types";

import { LeadQualificationValidationError, validateRelationshipInput, type LeadQualificationFieldErrors } from "../../domain/leadQualification.rules";
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
  "deal.needSummary": "deal.needSummary",
  "deal.ownerId": "deal.ownerId",
  "deal.expectedCloseDate": "deal.expectedCloseDate",
  "deal.estimatedValue.amount": "deal.estimatedValue",
  amount: "deal.estimatedValue",
  "amount.amount": "deal.estimatedValue",
  "amount.currency": "deal.currency",
  "deal.estimatedValue": "deal.estimatedValue",
  "deal.estimatedValue.currency": "deal.currency",
  "deal.interestedProductIds": "deal.interestedProducts",
  interestedProductIds: "deal.interestedProducts",
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
    const key = Object.hasOwn(BACKEND_FIELD_KEYS, field) ? BACKEND_FIELD_KEYS[field] : /^deal\.interestedProductIds\[\d+\]$/.test(field) ? "deal.interestedProducts" : undefined;
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
  "deal.ownerId": "qualification-owner",
  "deal.name": "qualification-deal-name",
  "deal.needSummary": "qualification-need-summary",
  "deal.expectedCloseDate": "qualification-close-date",
  "deal.followUpTaskTitle": "qualification-follow-up-task-title",
  "deal.followUpTaskDueAt": "qualification-follow-up-task-due",
  "deal.estimatedValue": "qualification-estimated-value",
  "deal.currency": "qualification-currency",
  "deal.interestedProducts": "qualification-products",
  "disqualified.reason": "qualification-disqualified-reason",
  "disqualified.evidence": "qualification-disqualified-evidence",
  "nurture.revisitAt": "qualification-revisit-date",
  "nurture.reason": "qualification-nurture-reason",
};


function localizeQualificationErrors(errors: LeadQualificationFieldErrors, vi: boolean): LeadQualificationFieldErrors {
  if (!vi) {
    const messages: Partial<Record<keyof LeadQualificationFieldErrors, string>> = {
      "relationship.selectedId": "Select an eligible contact.", "relationship.contact.name": "Enter the contact name.",
      "relationship.contact.email": "Review the contact email; use an existing contact if it is already registered.",
      "relationship.contact.phone": "Enter a valid phone number.", "deal.ownerId": "Select an eligible owner.",
      "deal.name": "Enter the opportunity name.", "deal.currency": "Use a valid currency code.",
      "deal.estimatedValue": "Enter a valid non-negative estimated value.", "deal.expectedCloseDate": "Choose a valid target close date.",
      "deal.needSummary": "Needs cannot exceed 4000 characters.", "deal.interestedProducts": "Review the selected products.",
      "deal.followUpTaskTitle": "Enter the follow-up task title.", "deal.followUpTaskDueAt": "Choose a valid task due date.",
      "nurture.revisitAt": "Choose a revisit date.", "nurture.reason": "Enter the nurture reason.",
      "disqualified.reason": "Enter the disqualification reason.", "disqualified.evidence": "Enter verification notes.",
    };
    return Object.fromEntries(Object.keys(errors).map(key => [key, messages[key as keyof LeadQualificationFieldErrors] ?? "Review this value."]));
  }
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
    "deal.needSummary": "Nhu cầu không được vượt quá 4.000 ký tự.",
    "deal.ownerId": "Cơ hội cần có người phụ trách.",
    "deal.expectedCloseDate": "Ngày dự kiến chốt không hợp lệ.",
    "deal.estimatedValue": "Giá trị ước tính phải là số không âm.",
    "deal.currency": "Tiền tệ không hợp lệ.",
    "deal.interestedProducts": "Kiểm tra các sản phẩm đã chọn.",
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
    "deal.ownerId",
    "deal.name",
    "deal.needSummary",
    "deal.interestedProducts",
    "deal.expectedCloseDate",
    "deal.estimatedValue",
    "deal.currency",
    "deal.followUpTaskTitle",
    "deal.followUpTaskDueAt",
  ];
  window.requestAnimationFrame(() => {
    const key = order.find((candidate) => Boolean(errors[candidate]));
    const id = key ? FIELD_IDS[key] : undefined;
    const targets = new Set(Object.keys(errors).map(field => FIELD_IDS[field as keyof LeadQualificationFieldErrors]));
    const element = [...document.querySelectorAll<HTMLElement>("#lead-qualification-page [id]")].find(control => targets.has(control.id) && control.getClientRects().length > 0 && !control.hasAttribute("disabled")) ?? (id ? document.getElementById(id) : null);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    element?.focus({ preventScroll: true });
  });
}

export function useLeadQualificationController() {
  const { leadId, workspaceKey } = useParams();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const vi = locale === "vi";
  const crmConfig = useWorkspaceConfigSnapshot();
  const operationalConfiguration = useWorkspaceRuntimeSettings();
  const organizationAvailable = !isLeadOrganizationQualificationUnavailable();
  const directSaleAvailable = !isLeadDirectSaleQualificationUnavailable();
  const lifecycle = useTargetBoundWorkflow(leadId, "Lead qualification");
  const unsavedVersion = useSyncExternalStore(subscribeUnsavedWork, getUnsavedWorkVersion, () => "");
  const authority = useDealSelectionAuthority();
  const epoch = useRef({ authority, generation: 0 });
  if (epoch.current.authority !== authority) epoch.current = { authority, generation: epoch.current.generation + 1 };
  const generation = epoch.current.generation;
  const readKey = JSON.stringify([authority, generation, lifecycle.targetId]);
  const resource = useMemo(() => getLeadDetailResource(lifecycle.targetId ?? ""), [lifecycle.targetId]);
  const leadQuery = useLeadAuthoritativeResource(resource, { enabled: false });
  const [loadedKey, setLoadedKey] = useState("");
  const [readError, setReadError] = useState("");
  const [readRetry, setReadRetry] = useState(0);
  const dataReady = loadedKey === readKey;
  const pendingRequest = useRef<AbortController | undefined>(undefined);
  const intentRef = useRef<LeadOpportunityIntent | undefined>(undefined);
  const [intent, setIntent] = useState<LeadOpportunityIntent>();
  const [conflict, setConflict] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [dealOwnerId, setDealOwnerId] = useState("");
  const [currency, setCurrency] = useState(operationalConfiguration.baseCurrency);
  const ownerOptions = getWorkspaceMemberOptions();
  const [lead, setLead] = useState<Lead | undefined>(() => lifecycle.targetId ? getLeadSnapshot(lifecycle.targetId) : undefined);
  const contacts: Contact[] = [];
  const [organizations, setOrganizations] = useState<OrganizationAccount[]>(() => getOrganizationAccountsSnapshot());

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
  const [estimateMode, setEstimateMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const priceEstimate = useOpportunityEstimate(interestedProductIds, currency, authority, selectedOutcome === "OPPORTUNITY");
  useEffect(() => {
    if (selectedOutcome === "OPPORTUNITY" && estimateMode === "AUTO" && !intent) setEstimatedValue(priceEstimate.amount ?? "");
  }, [selectedOutcome, estimateMode, intent, priceEstimate.amount]);
  const editEstimatedValue = (value: string) => { setEstimateMode("MANUAL"); setEstimatedValue(value); };


  const [operationError, setOperationError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<LeadQualificationFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [resolvedTarget, setResolvedTarget] = useState<string>();
  const [completion, setCompletion] = useState<{
    result: LeadQualificationResult;
    outcome?: "COMMITTED" | "REPLAYED" | "DEMO_COMMITTED";
  } | null>(null);

  useEffect(() => {
    let retired = false;
    const retainIntent = canRetainOpportunityIntent(intentRef.current, authority, generation, lifecycle.targetId);
    pendingRequest.current?.abort(); pendingRequest.current = undefined;
    if (!retainIntent) {
      intentRef.current = undefined; setIntent(undefined); setConflict(false); setRecoveryOpen(false);
      setSelectedOutcome(null); setCompletion(null); setResolvedTarget(undefined);
    }
    setReadError(""); setSubmitting(false); lifecycle.finish();
    if (!lifecycle.targetId) { setReadError(vi ? "Không tìm thấy Lead." : "Lead not found."); return; }
    if (!leadQuery.connected) { setLead(getLeadSnapshot(lifecycle.targetId)); setLoadedKey(readKey); }
    else {
      resource.reset();
      void resource.refresh().then(() => {
        if (retired || authority !== getDealSelectionAuthority() || generation !== epoch.current.generation) return;
        const snapshot = resource.getSnapshot();
        if (snapshot.error) { setReadError(formatApplicationError(snapshot.error, { locale })); return; }
        setLead(snapshot.data); setLoadedKey(readKey);
      }).catch(caught => { if (!retired) setReadError(formatApplicationError(caught, { locale })); });
    }
    const unsubscribe = subscribeToLeads(() => { if (!retired && authority === getDealSelectionAuthority() && generation === epoch.current.generation) setLead(getLeadSnapshot(lifecycle.targetId ?? "")); });
    return () => { retired = true; unsubscribe(); pendingRequest.current?.abort(); if (leadQuery.connected) resource.cancel(); };
  }, [authority, generation, lifecycle.targetId, readKey, resource, leadQuery.connected, readRetry]);
  useEffect(() => subscribeToOrganizationAccounts(setOrganizations), []);

  const initialized = useRef<string | undefined>(undefined);
  const canonical = useRef("");
  const fingerprint = JSON.stringify({ dealOwnerId, currency, selectedOutcome, relationship, reason, evidence, revisitAt, dealName, needSummary, estimatedValue, expectedCloseDate, createFollowUpTask, followUpTaskTitle, followUpTaskDueAt, interestedProductIds });
  const reset = () => {
    if (!lead || lead.id !== lifecycle.targetId) return;
    const defaults = {
      dealOwnerId: lead.ownerId ?? "", currency: lead.estimatedValue?.currency ?? operationalConfiguration.baseCurrency,
      selectedOutcome: null, relationship: createRelationshipInput(lead, organizationAvailable),
      reason: "", evidence: "", revisitAt: "",
      dealName: `${vi ? "Cơ hội" : "Opportunity"} - ${lead.companyName || lead.name}`,
      needSummary: lead.painPoint || lead.qualificationNotes || "",
      estimatedValue: "",
      expectedCloseDate: "", createFollowUpTask: false, followUpTaskTitle: "", followUpTaskDueAt: "",
      interestedProductIds: leadInterestedProductIds(lead),
    };
    canonical.current = JSON.stringify(defaults);
    setSelectedOutcome(null); setRelationship(defaults.relationship); setReason(""); setEvidence(""); setRevisitAt("");
    setEstimateMode("AUTO");
    setDealName(defaults.dealName); setNeedSummary(defaults.needSummary); setEstimatedValue(defaults.estimatedValue);
    setExpectedCloseDate(""); setCreateFollowUpTask(false); setFollowUpTaskTitle(""); setFollowUpTaskDueAt("");
    setDealOwnerId(lead.ownerId ?? ""); setCurrency(lead.estimatedValue?.currency ?? operationalConfiguration.baseCurrency);
    setInterestedProductIds(defaults.interestedProductIds); setOperationError(null); setFieldErrors({}); setCompletion(null); setResolvedTarget(undefined);
  };
  useEffect(() => {
    const identity = `${lifecycle.targetId}:${lifecycle.cycle}`;
    if (dataReady && lead && lead.id === lifecycle.targetId && initialized.current !== `${identity}:${readKey}`) { initialized.current = `${identity}:${readKey}`; reset(); }
  });
  const saveRef = useRef<() => Promise<boolean>>(async () => false);
  lifecycle.register(Boolean((intent || (dataReady && canonical.current && fingerprint !== canonical.current)) && !completion), reset, () => saveRef.current(), () => !intentRef.current);

  useEffect(() => {
    if (dataReady && authority === getDealSelectionAuthority() && resolvedTarget && !lifecycle.pending && leadId === resolvedTarget) navigate(`/leads/${resolvedTarget}`);
    if (!dataReady || !completion?.result.dealId || lifecycle.pending || leadId !== completion.result.leadId) return;
    const ownEntry = `Lead qualification:${lifecycle.targetId}:${lifecycle.cycle}`;
    if (getDirtyUnsavedWork().some(entry => entry.id === ownEntry)) return;
    // Let the shell commit this form's clean registry state before navigation reaches its blocker.
    // Other dirty forms keep their normal navigation protection.
    const frame = requestAnimationFrame(() => {
      if (lifecycle.isCurrent() && authority === getDealSelectionAuthority()) navigate(workspaceKey ? toWorkspacePath(workspaceKey, "crm", `deals/${completion.result.dealId}`) : `/deals/${completion.result.dealId}`);
    });
    return () => cancelAnimationFrame(frame);
  }, [resolvedTarget, completion, lifecycle.pending, lifecycle.targetId, lifecycle.cycle, unsavedVersion, leadId, workspaceKey, navigate, dataReady, authority]);

  const dealEnabled = crmConfig.modules.deals && crmConfig.workflow.dealUsageMode !== "DISABLED";
  const eligible = lead?.leadWorkState === LeadWorkState.VERIFYING;
  const outcomeCards = useMemo(() => [
    { key: "DISQUALIFIED" as const, title: vi ? "Không đủ điều kiện" : "Disqualify", desc: vi ? "Đóng tiềm năng với lý do và bằng chứng." : "Close the lead with a reason and evidence.", icon: "DISQUALIFIED" },
    { key: "NURTURE" as const, title: vi ? "Chăm sóc thêm" : "Nurture", desc: vi ? "Tạo lịch quay lại khi khách hàng chưa sẵn sàng." : "Schedule a follow-up when the buyer is not ready.", icon: "NURTURE" },
    { key: "OPPORTUNITY" as const, title: vi ? "Tạo cơ hội" : "Create opportunity", desc: vi ? "Tạo cơ hội để tiếp tục theo dõi bán hàng. Nhu cầu, giá trị và công việc theo dõi là tùy chọn." : "Create an opportunity to continue the sale. Needs, estimate and follow-up task are optional.", icon: "OPPORTUNITY" },
  ], [vi]);

  const clearFieldError = (key: keyof LeadQualificationFieldErrors) => {
    if (!fieldErrors[key]) return;
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submitQualification = async (navigateOnSuccess = false): Promise<boolean> => {
    if (!dataReady || !lead || lead.id !== lifecycle.targetId || !lifecycle.begin()) return false;
    if (!intentRef.current && selectedOutcome === "OPPORTUNITY" && estimateMode === "AUTO" && priceEstimate.status === "LOADING") {
      lifecycle.finish();
      setOperationError(vi ? "Đang tải giá sản phẩm. Vui lòng chờ." : "Product prices are loading. Please wait.");
      return false;
    }
    pendingRequest.current = new AbortController();
    const capturedGeneration = generation;
    const current = () => lifecycle.isCurrent() && authority === getDealSelectionAuthority() && capturedGeneration === epoch.current.generation && !pendingRequest.current?.signal.aborted;
    setOperationError(null);
    setFieldErrors({});

    const localErrors: LeadQualificationFieldErrors = relationship && selectedOutcome !== "DISQUALIFIED" ? localizeQualificationErrors(validateRelationshipInput(relationship), vi) : {};
    if (selectedOutcome === "DISQUALIFIED") {
      if (!reason.trim()) localErrors["disqualified.reason"] = vi ? "Nhập lý do không phù hợp." : "Enter the disqualification reason.";
      if (!evidence.trim()) localErrors["disqualified.evidence"] = vi ? "Nhập bằng chứng hoặc ghi chú xác minh." : "Enter evidence or verification notes.";
    }
    if (selectedOutcome === "NURTURE") {
      if (!revisitAt) localErrors["nurture.revisitAt"] = vi ? "Chọn ngày quay lại." : "Choose a revisit date.";
      if (!reason.trim()) localErrors["nurture.reason"] = vi ? "Nhập lý do chăm sóc thêm." : "Enter the nurture reason.";
    }
    if (selectedOutcome === "OPPORTUNITY") {
      if (needSummary.length > 4000) localErrors["deal.needSummary"] = vi ? "Nhu cầu không được vượt quá 4.000 ký tự." : "Needs cannot exceed 4000 characters.";
      if (!dealName.trim()) localErrors["deal.name"] = vi ? "Nhập tên cơ hội." : "Enter the opportunity name.";
      if (expectedCloseDate && Number.isNaN(new Date(expectedCloseDate).getTime())) localErrors["deal.expectedCloseDate"] = vi ? "Ngày dự kiến chốt không hợp lệ." : "Expected close date is invalid.";
      if (estimatedValue !== "" && !/^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/.test(estimatedValue)) localErrors["deal.estimatedValue"] = vi ? "Giá trị ước tính phải là số không âm." : "Estimated value must be non-negative.";
      if (!dealOwnerId.trim()) localErrors["deal.ownerId"] = vi ? "Chọn người phụ trách." : "Select an owner.";
      if (!/^[A-Z]{3}$/.test(currency)) localErrors["deal.currency"] = vi ? "Tiền tệ không hợp lệ." : "Currency is invalid.";
      if (createFollowUpTask) {
        if (!followUpTaskTitle.trim()) localErrors["deal.followUpTaskTitle"] = vi ? "Nhập tên công việc." : "Enter the task title.";
        if (!followUpTaskDueAt || Number.isNaN(new Date(followUpTaskDueAt).getTime())) localErrors["deal.followUpTaskDueAt"] = vi ? "Chọn hạn công việc hợp lệ." : "Choose a valid task due date.";
      }
    }
    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      focusFirstInvalidField(localErrors);
      lifecycle.finish();
      return false;
    }

    setRecoveryOpen(false);
    setSubmitting(true);
    try {
      if (!eligible && !intentRef.current) { setOperationError(vi ? "Tiềm năng phải ở bước Đang xác minh." : "Lead must be in Verifying."); return false; }
      if (selectedOutcome === "DISQUALIFIED") {
        await disqualifyLeadViaApi(lead.id, { reason, evidence });
        if (!current()) return true;
        canonical.current = fingerprint;
        if (navigateOnSuccess) setResolvedTarget(lead.id);
      } else if (selectedOutcome === "NURTURE") {
        if (!lead.ownerId) { setOperationError(vi ? "Lead chưa có người phụ trách." : "The Lead has no owner."); return false; }
        if (!relationship) { setOperationError(vi ? "Thiếu thông tin quan hệ khách hàng." : "Relationship input is missing."); return false; }
        const outcome = await executeLeadNurtureCommand({ leadId: lead.id, relationship, revisitAt, reason, note: evidence, ownerId: lead.ownerId });
        if (!current()) return true;
        setRecoveryOpen(false);
        setCompletion({ result: outcome.data, ...(outcome.outcome === undefined ? {} : { outcome: outcome.outcome }) });
        setSelectedOutcome(null);
      } else if (selectedOutcome === "OPPORTUNITY") {
        if (!lead.ownerId) { setOperationError(vi ? "Lead chưa có người phụ trách." : "The Lead has no owner."); return false; }
        if (!relationship) { setOperationError(vi ? "Thiếu thông tin quan hệ khách hàng." : "Relationship input is missing."); return false; }
        let captured = intentRef.current;
        if (!captured) {
          const version = lead.resourceVersion;
          if (version === undefined || !Number.isInteger(version) || version < 0) throw new ApplicationError({ code: "LEAD_QUALIFICATION_VERSION_REQUIRED", message: "Reload the record.", category: "CONFLICT", retryable: false });
          captured = createLeadOpportunityIntent({ leadId: lead.id, relationship, dealsEnabled: dealEnabled, currency,
            deal: { name: dealName, needSummary, ownerId: dealOwnerId, expectedCloseDate, estimatedValue: estimatedValue === "" ? undefined : estimatedValue, interestedProductIds,
              followUpTask: createFollowUpTask ? { title: followUpTaskTitle, dueAt: followUpTaskDueAt, description: needSummary || undefined } : undefined } }, version, authority, capturedGeneration);
        }
        if (captured.authority !== authority || captured.generation !== capturedGeneration) return false;
        const controller = new AbortController(); pendingRequest.current = controller;
        if (!intentRef.current) {
          if (captured.command.relationship.mode === "EXISTING") await readContactById(captured.command.relationship.selectedId ?? "", controller.signal);
          const selected = await resolveProductSelectionIds(captured.command.deal.interestedProductIds, controller.signal);
          if (captured.command.deal.interestedProductIds.some(id => !selected.some(product => product.id === id && product.status === "active"))) throw new ApplicationError({ code: "LEAD_OPPORTUNITY_INPUT_INVALID", message: "Selected product unavailable or inactive.", category: "VALIDATION", retryable: false, fieldErrors: { "deal.interestedProductIds": ["Review the selected products."] } });
        }
        if (!current()) return false;
        intentRef.current = captured; setIntent(captured);
        const outcome = await executeLeadOpportunityCommand(captured.command, { ...captured.metadata, signal: controller.signal });
        if (!current()) return true;
        intentRef.current = undefined; setIntent(undefined);
        setRecoveryOpen(false);
        setCompletion({ result: outcome.data, ...(outcome.outcome === undefined ? {} : { outcome: outcome.outcome }) });
        setSelectedOutcome(null);
      } else {
        setOperationError(vi ? "Chọn một kết quả xử lý." : "Choose a qualification outcome.");
        return false;
      }
      return true;
    } catch (caught) {
      if (!current()) return false;
      if (caught instanceof LeadQualificationValidationError) {
        const localizedErrors = localizeQualificationErrors(caught.fieldErrors, vi);
        setFieldErrors(localizedErrors);
        focusFirstInvalidField(localizedErrors);
      } else {
        const normalized = normalizeApplicationError(caught);
        if (intentRef.current && normalized.category !== "VALIDATION") setRecoveryOpen(true);
        setConflict(normalized.category === "CONFLICT");
        const backendErrors = normalized.category === "VALIDATION" ? mapBackendFieldErrors(normalized.fieldErrors) : {};
        if (Object.keys(backendErrors).length > 0) {
          const localizedErrors = {
            ...localizeQualificationErrors(backendErrors, vi),
            ...presentOpportunityFieldErrors(normalized.fieldErrors, intentRef.current?.command.deal, vi),
          };
          setFieldErrors(localizedErrors);
          focusFirstInvalidField(localizedErrors);
        }
        // MA-08: an authoritative refusal carries an internal diagnostic (workflow ids,
        // command classifications). The central formatter owns what a user may see.
        setOperationError(Object.keys(backendErrors).length === 0 ? formatApplicationError(caught, { locale }) : null);
      }
      return false;
    } finally {
      if (current()) { lifecycle.finish(); setSubmitting(false); }
    }
  };

  saveRef.current = submitQualification;
  const run = (event: React.FormEvent) => { event.preventDefault(); void submitQualification(true); };
  const resume = () => { void submitQualification(false); };
  const restartReview = () => {
    if (!intent || authority !== getDealSelectionAuthority()) return;
    const capturedGeneration = generation;
    void resource.refresh().then(() => {
      if (authority !== getDealSelectionAuthority() || capturedGeneration !== epoch.current.generation) return;
      const snapshot = resource.getSnapshot();
      if (snapshot.error) setOperationError(formatApplicationError(snapshot.error, { locale }));
      else { setLead(snapshot.data); setOperationError(vi ? "Đã tải Lead hiện tại để xem lại. Thao tác gốc vẫn được giữ; không tự ghi đè hoặc tạo thao tác mới khi recovery chưa rõ." : "The current Lead was loaded for review. The original intent remains preserved; unresolved recovery cannot silently overwrite or start a new intent."); }
    });
  };
  const refreshLead = () => setReadRetry(value => value + 1);

  return { lead, vi, locale, navigate, dataReady, readError, refreshLead, eligible, completion, outcomeCards, selectedOutcome, setSelectedOutcome, setFieldErrors, setOperationError, dealEnabled, lifecycle, directSaleAvailable, relationship, setRelationship, contacts, organizations, organizationAvailable, fieldErrors, reason, setReason, evidence, setEvidence, clearFieldError, revisitAt, setRevisitAt, dealName, setDealName, estimatedValue, setEstimatedValue: editEstimatedValue, estimateMode, setEstimateMode, priceEstimate, needSummary, setNeedSummary, expectedCloseDate, setExpectedCloseDate, interestedProductIds, setInterestedProductIds, createFollowUpTask, setCreateFollowUpTask, followUpTaskTitle, setFollowUpTaskTitle, followUpTaskDueAt, setFollowUpTaskDueAt, operationError, submitting, run, intent, resume, conflict, restartReview, recoveryOpen, setRecoveryOpen, dealOwnerId, setDealOwnerId, currency, setCurrency, ownerOptions };
}

