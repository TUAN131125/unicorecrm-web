import { formatApplicationError } from "@/shared/operations";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarClock, Link2, Save, UserRound } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toWorkspacePath } from "@/platform/navigation";
import { Button, Input, SearchableSelect, Select, Textarea } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { findCustomerByRelationshipRefSnapshot, resolveCustomerRelationshipContextSnapshot } from "@/modules/customers";
import { getContactSnapshot } from "@/modules/contacts";
import { getOrganizationAccountSnapshot } from "@/modules/organizations";
import { relationshipRefKey } from "@/platform/identity";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { listWorkspaceMemberDirectory } from "@/platform/member-directory";
import { registerUnsavedWork } from "@/platform/unsaved-work";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import {
  calculateCareCommitmentDueDates,
  calculateProactiveCareFollowUpAt,
  getCustomerCareCategoryLabel,
  getCustomerCarePolicy,
  getCustomerCareSourceLabel,
  useWorkspaceConfigSnapshot,
} from "@/platform/workspace-config";
import type { SupportCaseCategory, SupportCasePriority, SupportCaseSource } from "../../domain/model/supportCase.types";
import { SUPPORT_CASE_CATEGORY_CONFIG, SUPPORT_CASE_PRIORITY_CONFIG, SUPPORT_CASE_SOURCE_CONFIG } from "../../domain/rules/supportCase.config";
import { createSupportCaseCommand, replaceSupportCaseProfileCommand } from "../../public/cases";
import { useSupportCases } from "../hooks/useSupportCases";

interface SupportCaseFormPageProps {
  customers?: any[];
  contacts?: any[];
  products?: any[];
  orders?: any[];
}

export const SupportCaseFormPage: React.FC<SupportCaseFormPageProps> = ({ customers = [], contacts = [], products = [], orders = [] }) => {
  const { cases } = useSupportCases();
  const { caseId } = useParams();
  const navigate = useNavigate();
  const workspace = useWorkspaceContextSnapshot();
  const workspaceConfig = useWorkspaceConfigSnapshot();
  const carePolicy = useMemo(() => getCustomerCarePolicy(workspaceConfig), [workspaceConfig]);
  const careCategories = carePolicy.enabledCategories as SupportCaseCategory[];
  const careSources = carePolicy.enabledSources as SupportCaseSource[];
  const [searchParams] = useSearchParams();
  const organizationIdParam = searchParams.get("organizationId") ?? "";
  const sourceOrganization = organizationIdParam ? getOrganizationAccountSnapshot(organizationIdParam) : undefined;
  const sourceOrganizationCustomer = sourceOrganization
    ? findCustomerByRelationshipRefSnapshot({ type: "ORGANIZATION_ACCOUNT", id: sourceOrganization.id })
    : undefined;
  const sourceOrganizationContact = sourceOrganization?.primaryContactId
    ? getContactSnapshot(sourceOrganization.primaryContactId)
    : undefined;
  const { locale } = useI18n();
  const vi = locale === "vi";
  const session = getAuthSessionSnapshot();
  const members = listWorkspaceMemberDirectory();
  const existingCase = caseId ? cases.find((item) => item.id === caseId) : undefined;
  const isEditMode = Boolean(caseId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<SupportCasePriority>(carePolicy.defaultPriority);
  const [category, setCategory] = useState<SupportCaseCategory>(careCategories[0] ?? "request");
  const [source, setSource] = useState<SupportCaseSource>(careSources[0] ?? "manual");
  const [customerId, setCustomerId] = useState("");
  const [contactId, setContactId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [relatedOrderId, setRelatedOrderId] = useState("");
  const [relatedProductId, setRelatedProductId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [firstResponseDueAt, setFirstResponseDueAt] = useState("");
  const [resolutionDueAt, setResolutionDueAt] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; customerId?: string }>({});
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const saveHandlerRef = useRef<(navigateAfterSave?: boolean) => Promise<boolean>>(async () => false);
  const unregisterUnsavedWorkRef = useRef<() => void>(() => undefined);

  const formInitializationKey = `${caseId || "new"}|${searchParams.toString()}`;
  const initializedFormKeyRef = useRef<string | null>(null);
  const reporterAutofillCustomerRef = useRef<string | null>(null);
  const contactAutofillRef = useRef<string | null>(null);
  const ownerAutofillCustomerRef = useRef<string | null>(null);
  const commitmentAutofillPriorityRef = useRef<string | null>(null);
  const proactiveFollowUpAutofillRef = useRef<string | null>(null);
  const firstResponseManualRef = useRef(false);
  const resolutionManualRef = useRef(false);
  const nextFollowUpManualRef = useRef(false);

  useEffect(() => {
    if (initializedFormKeyRef.current === formInitializationKey) return;
    if (isEditMode && !existingCase) return;

    if (existingCase) {
      setTitle(existingCase.title ?? "");
      setDescription(existingCase.description ?? "");
      setPriority(existingCase.priority ?? "medium");
      setCategory(existingCase.category ?? "request");
      setSource(existingCase.source ?? "manual");
      setCustomerId(existingCase.customerId ?? "");
      setContactId(existingCase.contactId ?? "");
      setContactName(existingCase.contactName ?? "");
      setContactEmail(existingCase.contactEmail ?? "");
      setContactPhone(existingCase.contactPhone ?? "");
      setRelatedOrderId(existingCase.relatedOrderId ?? "");
      setRelatedProductId(existingCase.relatedProductId ?? "");
      setOwnerId(existingCase.ownerId ?? session?.principal.memberId ?? "");
      setNextFollowUpAt(existingCase.nextFollowUpAt?.slice(0, 16) ?? "");
      setFirstResponseDueAt(existingCase.firstResponseDueAt?.slice(0, 16) ?? "");
      setResolutionDueAt(existingCase.resolutionDueAt?.slice(0, 16) ?? "");
    } else {
      const paramPriority = searchParams.get("priority") as SupportCasePriority | null;
      const paramCategory = searchParams.get("category") as SupportCaseCategory | null;
      const paramSource = searchParams.get("source") as SupportCaseSource | null;

      setTitle(searchParams.get("title") ?? "");
      setDescription(searchParams.get("description") ?? "");
      const defaultPriority = carePolicy.defaultPriority as SupportCasePriority;
      const defaultCategory = careCategories[0] ?? "request";
      const defaultSource = careSources[0] ?? "manual";
      const resolvedPriority = paramPriority && SUPPORT_CASE_PRIORITY_CONFIG[paramPriority] ? paramPriority : defaultPriority;
      const resolvedCategory = paramCategory && careCategories.includes(paramCategory) ? paramCategory : defaultCategory;
      const resolvedSource = paramSource && careSources.includes(paramSource) ? paramSource : defaultSource;
      setPriority(resolvedPriority);
      setCategory(resolvedCategory);
      setSource(resolvedSource);
      const contextualCustomerId = searchParams.get("customerId") ?? sourceOrganizationCustomer?.id ?? "";
      const contextualContactId = searchParams.get("contactId") ?? sourceOrganizationContact?.id ?? "";
      const contextualContact = contextualContactId ? getContactSnapshot(contextualContactId) : undefined;
      setCustomerId(contextualCustomerId);
      setContactId(contextualContactId);
      setContactName(contextualContact?.fullName || contextualContact?.name || sourceOrganization?.displayName || "");
      setContactEmail(contextualContact?.workEmail || contextualContact?.email || contextualContact?.personalEmail || sourceOrganization?.email || "");
      setContactPhone(contextualContact?.mobilePhone || contextualContact?.phone || contextualContact?.workPhone || sourceOrganization?.phone || "");
      setRelatedOrderId(searchParams.get("orderId") ?? "");
      setRelatedProductId(searchParams.get("productId") ?? "");
      setOwnerId(carePolicy.ownershipStrategy === "CURRENT_USER"
        ? (session?.principal.memberId ?? "")
        : (sourceOrganization?.ownerId ?? ""));
      const commitmentDates = calculateCareCommitmentDueDates(carePolicy, resolvedPriority);
      const proactiveFollowUp = ["post_purchase", "follow_up"].includes(resolvedCategory) ? calculateProactiveCareFollowUpAt(carePolicy) : undefined;
      setNextFollowUpAt(searchParams.get("nextFollowUpAt")?.slice(0, 16) ?? (proactiveFollowUp?.slice(0, 16) ?? ""));
      setFirstResponseDueAt(commitmentDates.firstResponseDueAt?.slice(0, 16) ?? "");
      setResolutionDueAt(commitmentDates.resolutionDueAt?.slice(0, 16) ?? "");
    }

    setMessage(null);
    reporterAutofillCustomerRef.current = null;
    contactAutofillRef.current = null;
    ownerAutofillCustomerRef.current = null;
    commitmentAutofillPriorityRef.current = null;
    proactiveFollowUpAutofillRef.current = null;
    firstResponseManualRef.current = false;
    resolutionManualRef.current = false;
    nextFollowUpManualRef.current = false;
    initializedFormKeyRef.current = formInitializationKey;
  }, [careCategories, carePolicy, careSources, existingCase, formInitializationKey, isEditMode, searchParams, session?.principal.memberId, sourceOrganization, sourceOrganizationContact, sourceOrganizationCustomer?.id]);

  const customer = customers.find((item) => item.id === customerId);
  const customerRelationship = useMemo(
    () => customerId ? resolveCustomerRelationshipContextSnapshot(customerId) : undefined,
    [customerId],
  );
  const customerOrders = useMemo(() => orders.filter((item) => {
    if (!customerRelationship) return !customerId;
    return item.buyerRef && relationshipRefKey(item.buyerRef) === customerRelationship.relationshipKey;
  }), [customerId, customerRelationship, orders]);
  const customerContacts = useMemo(() => contacts.filter((item) => {
    if (!customerRelationship) return !customerId;
    return customerRelationship.relationshipRef.type === "CONTACT"
      ? item.id === customerRelationship.relationshipRef.id
      : item.organizationAccountId === customerRelationship.relationshipRef.id;
  }), [contacts, customerId, customerRelationship]);

  useEffect(() => {
    if (!customerId) {
      reporterAutofillCustomerRef.current = null;
      return;
    }
    if (isEditMode || contactId || reporterAutofillCustomerRef.current === customerId) return;
    const parentCustomer = customers.find((item) => item.id === customerId);
    if (!parentCustomer) return;

    setContactName(parentCustomer.contactName || parentCustomer.displayName || parentCustomer.name || "");
    setContactEmail(parentCustomer.contactEmail || parentCustomer.email || "");
    setContactPhone(parentCustomer.contactPhone || parentCustomer.phone || "");
    reporterAutofillCustomerRef.current = customerId;
  }, [contactId, customerId, customers, isEditMode]);

  useEffect(() => {
    if (!contactId) {
      contactAutofillRef.current = null;
      return;
    }
    if (contactAutofillRef.current === contactId) return;
    const contact = contacts.find((item) => item.id === contactId);
    if (!contact) return;

    setContactName(contact.fullName || contact.name || "");
    setContactEmail(contact.email || "");
    setContactPhone(contact.phone || contact.mobile || "");
    contactAutofillRef.current = contactId;
  }, [contactId, contacts]);

  useEffect(() => {
    if (isEditMode || carePolicy.ownershipStrategy !== "RELATIONSHIP_OWNER" || !customerId) return;
    if (ownerAutofillCustomerRef.current === customerId) return;
    const resolvedOwnerId = customers.find((item) => item.id === customerId)?.ownerId;
    if (resolvedOwnerId) setOwnerId(resolvedOwnerId);
    ownerAutofillCustomerRef.current = customerId;
  }, [carePolicy.ownershipStrategy, customerId, customers, isEditMode]);

  useEffect(() => {
    if (isEditMode || !carePolicy.commitments.enabled) return;
    if (commitmentAutofillPriorityRef.current === priority) return;
    const dates = calculateCareCommitmentDueDates(carePolicy, priority);
    if (!firstResponseManualRef.current) setFirstResponseDueAt(dates.firstResponseDueAt?.slice(0, 16) ?? "");
    if (!resolutionManualRef.current) setResolutionDueAt(dates.resolutionDueAt?.slice(0, 16) ?? "");
    commitmentAutofillPriorityRef.current = priority;
  }, [carePolicy, isEditMode, priority]);

  useEffect(() => {
    if (isEditMode || !carePolicy.proactiveFollowUp.enabled || !["post_purchase", "follow_up"].includes(category)) return;
    if (proactiveFollowUpAutofillRef.current === category) return;
    const next = calculateProactiveCareFollowUpAt(carePolicy);
    if (next && !nextFollowUpManualRef.current) setNextFollowUpAt(next.slice(0, 16));
    proactiveFollowUpAutofillRef.current = category;
  }, [carePolicy, category, isEditMode]);

  useEffect(() => {
    if (!careCategories.includes(category)) setCategory(careCategories[0] ?? "request");
    if (!careSources.includes(source)) setSource(careSources[0] ?? "manual");
  }, [careCategories, careSources, category, source]);

  const dirty = isEditMode
    ? Boolean(existingCase && [
        title !== (existingCase.title ?? ""),
        description !== (existingCase.description ?? ""),
        priority !== (existingCase.priority ?? "medium"),
        category !== (existingCase.category ?? "request"),
        source !== (existingCase.source ?? "manual"),
        customerId !== (existingCase.customerId ?? ""),
        contactId !== (existingCase.contactId ?? ""),
        contactName !== (existingCase.contactName ?? ""),
        contactEmail !== (existingCase.contactEmail ?? ""),
        contactPhone !== (existingCase.contactPhone ?? ""),
        relatedOrderId !== (existingCase.relatedOrderId ?? ""),
        relatedProductId !== (existingCase.relatedProductId ?? ""),
        ownerId !== (existingCase.ownerId ?? session?.principal.memberId ?? ""),
        nextFollowUpAt !== (existingCase.nextFollowUpAt?.slice(0, 16) ?? ""),
        firstResponseDueAt !== (existingCase.firstResponseDueAt?.slice(0, 16) ?? ""),
        resolutionDueAt !== (existingCase.resolutionDueAt?.slice(0, 16) ?? ""),
      ].some(Boolean))
    : Boolean(title || description || customerId || contactId || relatedOrderId || relatedProductId);

  useEffect(() => {
    if (!dirty || saving) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  const backToList = () => {
    navigate(toWorkspacePath(workspace.workspaceKey, "crm", "support/cases"));
  };

  const save = async (event?: React.SyntheticEvent, navigateAfterSave = true): Promise<boolean> => {
    event?.preventDefault();
    if (saving) return false;
    setMessage(null);
    const errors = {
      ...(!title.trim() ? { title: vi ? "Vui lòng nhập chủ đề." : "Subject is required." } : {}),
      ...(!customerId ? { customerId: vi ? "Vui lòng chọn khách hàng." : "Customer is required." } : {}),
    };
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      requestAnimationFrame(() => {
        const control = errors.title ? titleRef.current : document.getElementById("support-customer");
        control?.scrollIntoView({ behavior: "smooth", block: "center" });
        control?.focus({ preventScroll: true });
      });
      return false;
    }

    const customerName = customer?.displayName || customer?.companyName || customer?.name || existingCase?.customerName || "";
    const canonicalCustomer = resolveCustomerRelationshipContextSnapshot(customerId);
    if (!canonicalCustomer) {
      setMessage(vi ? "Hồ sơ khách hàng không còn liên kết với Contact hoặc Organization hợp lệ." : "The customer profile is no longer linked to a valid Contact or Organization.");
      return false;
    }
    const order = customerOrders.find((item) => item.id === relatedOrderId);
    const product = products.find((item) => item.id === relatedProductId);
    const owner = members.find((item) => item.memberId === ownerId);
    const dateOrUndefined = (value: string) => value ? new Date(value).toISOString() : undefined;

    setSaving(true);
    try {
      const input = {
        title: title.trim(),
        description: description.trim(),
        priority,
        category,
        source,
        relationshipRef: canonicalCustomer.relationshipRef,
        customerId,
        customerName,
        ...(contactId ? { contactId } : {}),
        ...(contactName.trim() ? { contactName: contactName.trim() } : {}),
        ...(contactEmail.trim() ? { contactEmail: contactEmail.trim() } : {}),
        ...(contactPhone.trim() ? { contactPhone: contactPhone.trim() } : {}),
        ...(relatedOrderId ? { relatedOrderId } : {}),
        ...(order?.orderNumber ? { relatedOrderNumber: order.orderNumber } : {}),
        ...(relatedProductId ? { relatedProductId } : {}),
        ...(product?.name ? { relatedProductName: product.name } : {}),
        ...(ownerId ? { ownerId } : {}),
        ...(owner?.displayName ? { ownerName: owner.displayName } : {}),
        ...(dateOrUndefined(nextFollowUpAt) ? { nextFollowUpAt: dateOrUndefined(nextFollowUpAt) } : {}),
        ...(dateOrUndefined(firstResponseDueAt) ? { firstResponseDueAt: dateOrUndefined(firstResponseDueAt) } : {}),
        ...(dateOrUndefined(resolutionDueAt) ? { resolutionDueAt: dateOrUndefined(resolutionDueAt) } : {}),
      };
      if (existingCase) {
        await replaceSupportCaseProfileCommand(existingCase.id, input, {
          expectedVersion: existingCase.resourceVersion,
          actor: { id: session?.principal.memberId, name: session?.principal.displayName },
        });
      } else {
        await createSupportCaseCommand(input, {
          actor: { id: session?.principal.memberId, name: session?.principal.displayName },
        });
      }
      unregisterUnsavedWorkRef.current();
      if (navigateAfterSave) backToList();
      return true;
    } catch (error) {
      setMessage(formatApplicationError(error, { locale }));
      return false;
    } finally {
      setSaving(false);
    }
  };

  saveHandlerRef.current = (navigateAfterSave = false) => save(undefined, navigateAfterSave);
  useEffect(() => {
    let unregister: () => void = () => undefined;
    unregister = registerUnsavedWork({
      id: `support-case-form:${caseId ?? "new"}`,
      title: vi ? "Phiếu hỗ trợ chưa lưu" : "Unsaved Support Ticket",
      isDirty: dirty && !saving,
      save: () => saveHandlerRef.current(false),
      discard: () => unregister(),
    });
    unregisterUnsavedWorkRef.current = unregister;
    return unregister;
  }, [caseId, dirty, saving, vi]);

  return (
    <div className="crm-form-page space-y-5 text-xs">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button type="button" aria-label={vi ? "Quay lại danh sách Phiếu hỗ trợ" : "Back to Support Tickets"} onClick={() => backToList()} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><ArrowLeft size={16} /></button>
          <div><h1 className="text-base font-semibold text-slate-950">{isEditMode ? (vi ? "Chỉnh sửa Phiếu hỗ trợ" : "Edit Support Ticket") : (vi ? "Tạo Phiếu hỗ trợ" : "Create Support Ticket")}</h1><p className="mt-1 text-[11px] text-slate-400">{vi ? `Chiến lược ${carePolicy.mode === "REACTIVE" ? "phản hồi theo yêu cầu" : carePolicy.mode === "PROACTIVE" ? "chủ động" : "kết hợp"}; loại phiếu, kênh và cam kết thời gian được lấy từ cấu hình workspace.` : "Care type, intake channel and time commitments are driven by workspace support policy."}</p></div>
        </div>
        <Button type="button" actionIntent="save" size="sm" icon={<Save size={14} />} className="min-w-28" loading={saving} disabled={saving} onClick={save}>{vi ? "Lưu phiếu" : "Save case"}</Button>
      </div>

      {message && <p role="alert" className="text-xs text-slate-600">{message}</p>}
      {!isEditMode && organizationIdParam && !sourceOrganization && <p className="text-xs text-slate-600">{vi ? "Không tìm thấy tổ chức nguồn hoặc bạn không có quyền truy cập." : "The source organization was not found or is not accessible."}</p>}
      {!isEditMode && sourceOrganization && !sourceOrganizationCustomer && <p className="text-xs text-slate-600">{vi ? `Đã điền thông tin từ ${sourceOrganization.displayName}, nhưng tổ chức chưa có Customer 360 liên kết. Hãy chọn khách hàng trước khi lưu.` : `Details from ${sourceOrganization.displayName} were prefilled, but the organization has no linked customer profile. Select a customer before saving.`}</p>}

      <form onSubmit={save} className="crm-form-surface grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Section title={vi ? "Nội dung chăm sóc" : "Care request"} icon={<UserRound size={15} />}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={vi ? "Chủ đề *" : "Subject *"} wide><Input id="support-title" ref={titleRef} required error={fieldErrors.title} value={title} onChange={(event) => { setTitle(event.target.value); setFieldErrors((current) => ({ ...current, title: undefined })); }} placeholder={vi ? "Ví dụ: Khách hàng cần tư vấn gói nâng cấp" : "Example: Customer needs upgrade consultation"} /></Field>
              <Field label={vi ? "Mô tả" : "Description"} wide><Textarea rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={vi ? "Nội dung yêu cầu, mong đợi của khách hàng và thông tin cần theo dõi..." : "Request details, customer expectation and follow-up context..."} /></Field>
              <Field label={vi ? "Loại chăm sóc" : "Care type"}><Select value={category} onChange={(event) => setCategory(event.target.value as SupportCaseCategory)}>{careCategories.map((value) => <option key={value} value={value}>{getCustomerCareCategoryLabel(carePolicy, value, locale) || (vi ? SUPPORT_CASE_CATEGORY_CONFIG[value].labelVi : SUPPORT_CASE_CATEGORY_CONFIG[value].labelEn)}</option>)}</Select></Field>
              <Field label={vi ? "Mức ưu tiên" : "Priority"}><Select value={priority} onChange={(event) => setPriority(event.target.value as SupportCasePriority)}>{Object.keys(SUPPORT_CASE_PRIORITY_CONFIG).map((value) => <option key={value} value={value}>{vi ? SUPPORT_CASE_PRIORITY_CONFIG[value as SupportCasePriority].labelVi : SUPPORT_CASE_PRIORITY_CONFIG[value as SupportCasePriority].labelEn}</option>)}</Select></Field>
              <Field label={vi ? "Kênh tiếp nhận" : "Intake channel"}><Select value={source} onChange={(event) => setSource(event.target.value as SupportCaseSource)}>{careSources.map((value) => <option key={value} value={value}>{getCustomerCareSourceLabel(carePolicy, value, locale) || (vi ? SUPPORT_CASE_SOURCE_CONFIG[value].labelVi : SUPPORT_CASE_SOURCE_CONFIG[value].labelEn)}</option>)}</Select></Field>
              <Field label={vi ? "Người phụ trách" : "Owner"}><Select value={ownerId} onChange={(event) => setOwnerId(event.target.value)}><option value="">{vi ? "Chưa phân công" : "Unassigned"}</option>{members.map((member) => <option key={member.memberId} value={member.memberId}>{member.displayName}</option>)}</Select></Field>
            </div>
          </Section>

          <Section title={vi ? "Khách hàng & Người liên hệ" : "Customer & Contact"} icon={<UserRound size={15} />}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={vi ? "Khách hàng *" : "Customer *"} wide><SearchableSelect id="support-customer" required error={fieldErrors.customerId} value={customerId} onChange={(value) => { setCustomerId(value); setContactId(""); setFieldErrors((current) => ({ ...current, customerId: undefined })); }} placeholder={vi ? "Chọn khách hàng" : "Select customer"} searchPlaceholder={vi ? "Tìm khách hàng..." : "Search customers..."} options={customers.map((item) => ({ value: item.id, label: item.displayName || item.companyName || item.name || item.id, description: item.customerCode || item.email || item.phone || item.id, keywords: `${item.customerCode || ""} ${item.email || ""} ${item.phone || ""}` }))} /></Field>
              <Field label={vi ? "Người liên hệ" : "Contact"} wide><SearchableSelect value={contactId} onChange={setContactId} placeholder={vi ? "Không liên kết người liên hệ" : "No linked contact"} searchPlaceholder={vi ? "Tìm người liên hệ..." : "Search contacts..."} options={customerContacts.map((item) => ({ value: item.id, label: item.fullName || item.name || item.email || item.id, description: item.email || item.phone || item.mobilePhone || item.id, keywords: `${item.email || ""} ${item.phone || ""} ${item.mobilePhone || ""}` }))} /></Field>
              <Field label={vi ? "Tên liên hệ" : "Contact name"}><Input value={contactName} onChange={(event) => setContactName(event.target.value)} /></Field>
              <Field label="Email"><Input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} /></Field>
              <Field label={vi ? "Điện thoại" : "Phone"}><Input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} /></Field>
            </div>
          </Section>

          <Section title={vi ? "Bản ghi liên quan" : "Related records"} icon={<Link2 size={15} />}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={vi ? "Đơn hàng" : "Order"}><SearchableSelect value={relatedOrderId} onChange={setRelatedOrderId} placeholder={vi ? "Không liên kết đơn hàng" : "No linked order"} searchPlaceholder={vi ? "Tìm mã đơn hàng..." : "Search order number..."} options={customerOrders.map((item) => ({ value: item.id, label: item.orderNumber || item.id, description: item.state || item.status || "" }))} /></Field>
              <Field label={vi ? "Sản phẩm" : "Product"}><SearchableSelect value={relatedProductId} onChange={setRelatedProductId} placeholder={vi ? "Không liên kết sản phẩm" : "No linked product"} searchPlaceholder={vi ? "Tìm tên hoặc mã sản phẩm..." : "Search product name or SKU..."} options={products.map((item) => ({ value: item.id, label: item.name || item.id, description: item.sku || item.category || "", keywords: `${item.sku || ""} ${item.category || ""}` }))} /></Field>
            </div>
          </Section>
        </div>

        <aside className="space-y-5">
          <Section title={vi ? "Hẹn xử lý tiếp theo" : "Next follow-up"} icon={<CalendarClock size={15} />}>
            <Field label={vi ? "Thời điểm hẹn" : "Follow-up time"}><Input type="datetime-local" value={nextFollowUpAt} onChange={(event) => { nextFollowUpManualRef.current = true; setNextFollowUpAt(event.target.value); }} /></Field>
            <p className="mt-3 text-[11px] leading-5 text-slate-500">{vi ? "Mốc này giúp hàng đợi Phiếu hỗ trợ xác định phiếu cần theo dõi. Nó không tự tạo Công việc." : "This date drives the follow-up queue. It does not create a Task automatically."}</p>
          </Section>

          <Section title={vi ? (carePolicy.commitments.enabled ? "Cam kết thời gian" : "Cam kết thời gian (không áp dụng)") : "Time commitment"} icon={<CalendarClock size={15} />}>
            <div className="space-y-4">
              <Field label={vi ? "Hạn phản hồi đầu" : "First response due"}><Input disabled={!carePolicy.commitments.enabled} type="datetime-local" value={firstResponseDueAt} onChange={(event) => { firstResponseManualRef.current = true; setFirstResponseDueAt(event.target.value); }} /></Field>
              <Field label={vi ? "Hạn hoàn tất" : "Resolution due"}><Input disabled={!carePolicy.commitments.enabled} type="datetime-local" value={resolutionDueAt} onChange={(event) => { resolutionManualRef.current = true; setResolutionDueAt(event.target.value); }} /></Field>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-slate-500">{vi ? (carePolicy.commitments.enabled ? "Deadline mặc định được tính theo mức ưu tiên trong cấu hình workspace và vẫn có thể chỉnh trên từng phiếu." : "Doanh nghiệp đang tắt cam kết thời gian trong cấu hình workspace nên hệ thống không tạo SLA giả.") : "Time commitments are controlled by workspace support policy."}</p>
          </Section>
        </aside>
      </form>
    </div>
  );
};

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 text-xs font-medium text-slate-700">{icon}{title}</div>{children}</section>;
const Field: React.FC<{ label: string; children: React.ReactNode; wide?: boolean }> = ({ label, children, wide }) => <label className={`block ${wide ? "md:col-span-2" : ""}`}><span className="mb-1 block text-[10px] font-medium text-slate-500">{label}</span>{children}</label>;
