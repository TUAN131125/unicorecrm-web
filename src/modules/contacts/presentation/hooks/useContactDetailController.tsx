import { formatApplicationError, backendUnavailableMessage, formatOperationUnavailableError } from "@/shared/operations";
import React, { useState, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ShieldAlert, Sparkles } from "lucide-react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { formatVnd } from "@/shared/lib/format/currency";
import { Contact } from "../../domain/model/contact.types";
import type { CustomerDisplay as Customer } from "@/modules/customers";
import { Deal, DealStage, transitionDealStageCommand } from "@/modules/deals";
import { Quote } from "@/modules/quotes";
import { archiveQuoteCommand } from "@/modules/quotes";
import type { CrmWorkspaceConfig } from "@/platform/workspace-config";

import { useI18n } from "@/i18n";
import { getProductCatalogSnapshot, subscribeToProductCatalog } from "@/modules/products";
import { useSubscribableSnapshot } from "@/platform/react";
import { RecordDetailFrame } from "@/components/crm/detail-archetype";
import { notifyProduct } from "@/components/feedback/ProductDialogService";

// Import modular layouts & subcomponents
import { ContactRecordHeader } from "../detail/ContactRecordHeader";
import { ContactDetailTabs, ContactTab } from "../detail/ContactDetailTabs";
import { ContactDetailDialogs } from "../detail/ContactDetailDialogs";
import { ContactDetailTabContent } from "../detail/ContactDetailTabContent";
import { ContactInsightPanel } from "../detail/ContactInsightPanel";
import { Input, Select, RecordTabTransition } from "@/shared/components/ui";

// Import modular action modals

// Import modular tabs
import { getPurchasedProductsForContact } from "@/modules/customers";
import { CustomerOrder } from "@/modules/orders";
import { getInvoicesSnapshot, getReceivablesSnapshot, subscribeToInvoices } from "@/modules/invoices";
import { getPaymentsSnapshot, subscribeToPayments } from "@/modules/payments";
import { getShippingSnapshot, subscribeToShipping } from "@/modules/shipping";
import { getReturnsSnapshot, subscribeToReturns } from "@/modules/returns";
import { completeTaskCommand, createTaskCommand, rescheduleTaskCommand, type NoteActivityDraft, type Task, type TaskActivitySnapshot } from "@/modules/tasks";
import type { SupportCase } from "@/modules/support";
import { relationshipRefKey, type RelationshipRef } from "@/platform/identity";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { listWorkspaceMemberDirectory, resolveWorkspaceMemberName } from "@/platform/member-directory";
import { getDisplayOrdersForContact } from "@/modules/orders";
import { useContacts } from "../hooks/useContacts";
import { archiveContactViaApi, getContactPreference, isContactUpdateAvailable, isContactRetentionUnavailable, restoreContactCommand, setContactPreference, updateContactViaApi } from "../../public/contacts";
import {
  createContactOpportunityCreationRuntime,
  executeContactOpportunityCreation,
  isContactOpportunityCreationUnavailable,
} from "@/workflows/contact-opportunity-creation";

import { findCustomerForContact, getCustomerDisplayNameForContact } from "../model/contactCustomerLookup";
import { getDealNextActionTaskIntentKey } from "@/workflows/work-activation";
import { useEffectiveAccess } from "@/platform/access-control";

export interface ContactDetailPageProps {
  customers: Customer[];
  deals: Deal[];
  quotes: Quote[];
  crmConfig?: CrmWorkspaceConfig;
  orders: Record<string, CustomerOrder[]> | CustomerOrder[];
  taskActivity: TaskActivitySnapshot;
  careCases: SupportCase[];
}

function resolveTaskAssigneeId(
  value: string,
  members: Array<{ memberId: string; displayName: string }>,
  fallback?: string,
): string {
  const normalized = value.trim().toLowerCase();
  const matched = members.find((member) => member.memberId === value || member.displayName.toLowerCase() === normalized);
  return matched?.memberId || fallback || members[0]?.memberId || value;
}

function toDueAt(date: string, time?: string): string {
  if (!date) return new Date().toISOString();
  const candidate = time ? `${date}T${time}:00` : `${date}T17:00:00`;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toISOString();
}
export function useContactDetailController(props: ContactDetailPageProps) {
  const {
  customers,
  deals,
  quotes,
  crmConfig,
  orders,
  taskActivity,
  careCases,
} = props;
  const { tx, locale } = useI18n();
  const access = useEffectiveAccess();
  const reduceMotion = useReducedMotion();
  const currentMemberId = getAuthSessionSnapshot()?.principal.memberId;
  const members = listWorkspaceMemberDirectory();
  const productCatalog = useSubscribableSnapshot(getProductCatalogSnapshot, subscribeToProductCatalog);
  const invoiceSnapshot = useSubscribableSnapshot(getInvoicesSnapshot, subscribeToInvoices);
  const paymentSnapshot = useSubscribableSnapshot(getPaymentsSnapshot, subscribeToPayments);
  const shippingSnapshot = useSubscribableSnapshot(getShippingSnapshot, subscribeToShipping);
  const returnSnapshot = useSubscribableSnapshot(getReturnsSnapshot, subscribeToReturns);
  const navigate = useNavigate();
  const { contacts, setContacts, query: contactQuery } = useContacts();
  const location = useLocation();
  const { contactId } = useParams<{ contactId: string }>();

  // Find target contact
  const contact = contacts.find(c => c.id === contactId);

  // Canonical relationship-workspace tabs with legacy deep-link compatibility.
  const getTabTargetFromQuery = (): { tab: ContactTab; subTab?: string } => {
    const searchParams = new URLSearchParams(location.search);
    const tabName = searchParams.get("tab");
    const requestedView = searchParams.get("view") || undefined;
    const canonical: ContactTab[] = ["overview", "relationship", "sales", "transactions", "service", "work", "attachments"];
    if (tabName && canonical.includes(tabName as ContactTab)) return { tab: tabName as ContactTab, subTab: requestedView };
    const legacy: Record<string, { tab: ContactTab; subTab?: string }> = {
      detailInfo: { tab: "relationship", subTab: "profile" },
      details: { tab: "relationship", subTab: "profile" },
      linkedCustomer: { tab: "relationship", subTab: "people" },
      notes: { tab: "relationship", subTab: "notes" },
      campaigns: { tab: "relationship", subTab: "profile" },
      opportunities: { tab: "sales", subTab: "opportunities" },
      quotations: { tab: "sales", subTab: "quotations" },
      orders: { tab: "transactions", subTab: "orders" },
      invoices: { tab: "transactions", subTab: "invoices" },
      payments: { tab: "transactions", subTab: "payments" },
      shipping: { tab: "transactions", subTab: "shipping" },
      returns: { tab: "transactions", subTab: "returns" },
      purchaseHistory: { tab: "transactions", subTab: "history" },
      purchasedProducts: { tab: "transactions", subTab: "products" },
      careCases: { tab: "service", subTab: "support" },
      activeTasks: { tab: "work", subTab: "tasks" },
      care: { tab: "work", subTab: "tasks" },
      more: { tab: "work", subTab: "history" },
      documents: { tab: "attachments" },
    };
    return tabName && legacy[tabName] ? legacy[tabName] : { tab: "overview" };
  };

  const tabTarget = getTabTargetFromQuery();
  const activeTab = tabTarget.tab;
  const requestedSubTab = tabTarget.subTab;

  const setActiveTab = (tabName: ContactTab, subTab?: string) => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set("tab", tabName);
    if (subTab) searchParams.set("view", subTab);
    else searchParams.delete("view");
    navigate({ search: searchParams.toString() }, { replace: true });
  };

  const [isRightPanelVisible, setIsRightPanelVisible] = useState<boolean>(() =>
    getContactPreference("centrix_contact_right_panel_visible", true),
  );

  const toggleRightPanel = () => {
    setIsRightPanelVisible(prev => {
      const next = !prev;
      setContactPreference("centrix_contact_right_panel_visible", next);
      return next;
    });
  };

  // Toast / Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);

  /**
   * Contact record writes (profile edits, timeline/activity projections, opportunity
   * creation) remain unavailable: `updateContact` is BLOCKED and WF-01
   * contact-opportunity-creation is blocked with
   * `connectedFrontendCoordinatorAllowed: false`. In connected mode these fail closed
   * inside the contacts projection, so the action is refused up front with a
   * user-readable reason instead of throwing out of the event handler.
   */
  const contactUpdateAvailable = isContactUpdateAvailable();
  const canUpdateContact = contactUpdateAvailable && access.canPerform("contacts", "update");
  const canArchiveContact = !isContactRetentionUnavailable() && access.canPerform("contacts", "delete");
  const contactOpportunityAvailable = !isContactOpportunityCreationUnavailable();
  const contactWritesUnavailable = !contactUpdateAvailable;
  const refuseUnavailableContactWrite = (action: string): boolean => {
    if (!contactWritesUnavailable) return false;
    showToast(backendUnavailableMessage({ locale, action }));
    return true;
  };
  /**
   * WF-01 refusal, owned by WF-01. The workflow is BLOCKED with
   * `connectedFrontendCoordinatorAllowed: false`, so connected mode must refuse before the
   * first Deal, Contact or Task write — on the workflow's own availability rather than on
   * Contact-write availability, which would stop protecting WF-01 the day `updateContact`
   * gains a production contract.
   */
  const refuseUnavailableContactOpportunity = (action: string): boolean => {
    if (!isContactOpportunityCreationUnavailable()) return false;
    showToast(backendUnavailableMessage({ locale, action }));
    return true;
  };
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showOpportunityModal, setShowOpportunityModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Modular interaction action modal states
  const [showQuickNoteModal, setShowQuickNoteModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showLogCallModal, setShowLogCallModal] = useState(false);
  const [showSendEmailModal, setShowSendEmailModal] = useState(false);
  const [showSendSmsModal, setShowSendSmsModal] = useState(false);

  // Overlay forms must not collapse the interaction workspace. Keeping the panel mounted
  // preserves the user's context and prevents a distracting layout shift behind the modal.
  const handleModalStateChange = (_open: boolean) => undefined;
  const isPanelOpen = isRightPanelVisible;

  // Sub databases with Live local storage context
  const [contactNotes, setContactNotes] = useState<{ id: string; title: string; body: string; date: string; pinned?: boolean; category?: NoteActivityDraft["category"]; occurredAt?: string }[]>([]);
  const [contactAttachments, setContactAttachments] = useState<{ id: string; name: string; size: string; date: string; category?: string; description?: string; file?: File }[]>([]);


  // Contact-owned local content is initialized from the Contact record only.
  // Commercial, work and payment data are derived from canonical module snapshots below.
  useEffect(() => {
    if (!contact) return;

    const noteDate = (contact.updatedAt || contact.createdAt || new Date().toISOString()).split("T")[0];
    setContactNotes(contact.notes
      ? [{ id: `contact-note-${contact.id}`, title: tx("contactDetail.mock.initialNoteTitle", "Ghi chú liên hệ"), body: contact.notes, date: noteDate, pinned: true }]
      : []);
    setContactAttachments([]);
  }, [contact?.id, contact?.notes, contact?.updatedAt, contact?.createdAt, tx]);
  if (!contact) return null;


  // Cross-module data is resolved through the canonical Customer relationship, never by seeded UI rows.
  const canonicalCustomer = findCustomerForContact(contact);
  const contactRelationshipRef = canonicalCustomer?.relationshipRef ?? (contact.organizationAccountId
    ? { type: "ORGANIZATION_ACCOUNT" as const, id: contact.organizationAccountId }
    : { type: "CONTACT" as const, id: contact.id });
  const hasCustomerCommercialContext = Boolean(canonicalCustomer);
  const ownerName = contact.ownerId ? resolveWorkspaceMemberName(contact.ownerId) : tx("contactDetail.fields.unassignedOwner", "Chưa phân công");
  const relationshipKey = canonicalCustomer ? relationshipRefKey(canonicalCustomer.relationshipRef) : undefined;
  const customerAliases = new Set<string>(canonicalCustomer
    ? [canonicalCustomer.id, canonicalCustomer.customerCode, ...(canonicalCustomer.legacyAliases ?? [])]
    : []);
  const matchesRelationship = (ref?: RelationshipRef) => Boolean(ref && relationshipKey && relationshipRefKey(ref) === relationshipKey);
  const matchesCustomerAlias = (customerId?: string) => Boolean(customerId && customerAliases.has(customerId));

  const displayOrders = hasCustomerCommercialContext ? getDisplayOrdersForContact(orders, contact) : [];
  const relatedOrderIds = new Set(displayOrders.map((item) => item.order.id));
  const contactInvoices = invoiceSnapshot.invoices.filter((invoice) =>
    matchesRelationship(invoice.buyerRef)
    || Boolean(invoice.sourceLinks.orderId && relatedOrderIds.has(invoice.sourceLinks.orderId)),
  );
  const contactInvoiceIds = new Set(contactInvoices.map((invoice) => invoice.id));
  const contactReceivables = getReceivablesSnapshot().filter((entry) => contactInvoiceIds.has(entry.invoiceId));
  const contactPayments = paymentSnapshot.transactions.filter((transaction) =>
    matchesRelationship(transaction.buyerRef) || relatedOrderIds.has(transaction.orderId),
  );
  const contactReturns = returnSnapshot.requests.filter((request) =>
    matchesRelationship(request.buyerRef) || relatedOrderIds.has(request.orderId),
  );
  const relatedReturnIds = new Set(contactReturns.map((request) => request.id));
  const contactShipping = shippingSnapshot.filter((booking) =>
    (booking.sourceType === "ORDER" && relatedOrderIds.has(booking.sourceId))
    || (booking.sourceType === "RETURN" && relatedReturnIds.has(booking.sourceId)),
  );
  const affiliatedOpportunities = deals.filter((deal) =>
    deal.contactId === contact.id
    || matchesRelationship(deal.buyerRef)
    || matchesCustomerAlias(deal.customerId),
  );
  const affiliatedDealIds = new Set(affiliatedOpportunities.map((deal) => deal.id));
  const canonicalQuotes = quotes.filter((quote) =>
    quote.contactId === contact.id
    || matchesRelationship(quote.buyerRef)
    || matchesCustomerAlias(quote.customerId)
    || Boolean((quote.dealId || quote.sourceDealId) && affiliatedDealIds.has((quote.dealId || quote.sourceDealId)!)),
  );
  const displayQuotes = canonicalQuotes.map((quote) => ({
    ...quote,
    total: quote.grandTotal,
    validUntil: quote.validUntil || quote.expiryDate || "—",
    date: quote.createdAt.split("T")[0],
  }));
  const linkedRecordIds = new Set<string>([
    contact.id,
    ...affiliatedOpportunities.map((deal) => deal.id),
    ...canonicalQuotes.map((quote) => quote.id),
    ...displayOrders.map((item) => item.order.id),
    ...contactInvoices.map((invoice) => invoice.id),
    ...contactPayments.map((transaction) => transaction.id),
    ...contactShipping.map((booking) => booking.id),
    ...contactReturns.map((request) => request.id),
  ]);
  const canonicalTasks = taskActivity.tasks.filter((task) =>
    task.status !== "CANCELLED"
    && (matchesRelationship(task.relationshipRef)
      || matchesCustomerAlias(task.customerId)
      || Boolean(task.recordRef && linkedRecordIds.has(task.recordRef.recordId))),
  );
  const canonicalTaskById = new Map(canonicalTasks.map((task) => [task.id, task]));
  const tasks = canonicalTasks.map((task) => ({
    id: task.id,
    title: task.title,
    dueDate: task.dueAt.split("T")[0],
    dueTime: task.dueAt.includes("T") ? task.dueAt.split("T")[1]?.slice(0, 5) : undefined,
    completedDate: task.completedAt?.split("T")[0],
    status: (task.status === "COMPLETED" ? "completed" : "pending") as "completed" | "pending",
    priority: (task.priority === "NORMAL" ? "MEDIUM" : task.priority) as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
    assignee: resolveWorkspaceMemberName(task.assigneeId),
    description: task.description,
  }));
  const linkedCustomerId = findCustomerForContact(contact)?.id;
  const contactCareCases = careCases.filter((item) =>
    item.contactId === contact.id
    || Boolean(item.relationshipRef && relationshipRefKey(item.relationshipRef) === relationshipRefKey({ type: "CONTACT", id: contact.id }))
    || Boolean(linkedCustomerId && item.customerId === linkedCustomerId),
  );

  const displayPurchasedProducts = getPurchasedProductsForContact(contact, customers);

  // Saving edited fields
  const handleSaveContact = async (updatedContact: Contact) => {
    if (refuseUnavailableContactWrite(locale === "vi" ? "Cập nhật hồ sơ Liên hệ" : "Updating the Contact profile")) return;
    await updateContactViaApi(updatedContact);
    setShowEditModal(false);
    showToast(tx("common.updatedSuccessfully", "Đã lưu cập nhật thành công."));
  };

  // Creating opportunity wizard trigger with full CRM details
  // WF-01 contact-opportunity-creation is blocked with
  // connectedFrontendCoordinatorAllowed:false, so connected mode cannot compose it.
  const handleCreateOpportunity = async (dealData: {
    name: string;
    amount: number;
    productId: string;
    ownerId: string;
    source: string;
    pipeline: string;
    stage: string;
    currency: string;
    probability: number;
    expectedCloseDate: string;
    priority: string;
    opportunityType: string;
    demandSummary: string;
    painPoints: string;
    decisionRole: string;
    buyingReadiness: string;
    expectedBudget: number;
    nextAction: string;
    nextFollowUpDate: string;
    createFollowUpTask: boolean;
    note: string;
    lineItems?: any[];
  }) => {
    if (refuseUnavailableContactOpportunity(locale === "vi" ? "Tạo cơ hội từ Liên hệ" : "Creating an opportunity from this Contact")) return;
    const lineItemsArray = dealData.lineItems && dealData.lineItems.length > 0
      ? dealData.lineItems.map((li: any, idx: number) => ({
          id: `li_${Date.now()}_${idx}`,
          productId: li.product.id,
          productName: li.product.name,
          description: li.product.description || "",
          quantity: li.quantity,
          unitPrice: li.customPrice ?? li.product.listPrice,
          totalPrice: (li.customPrice ?? li.product.listPrice) * li.quantity * (1 - (li.discountPercent || 0) / 100),
          discountPercent: li.discountPercent || 0
        }))
      : (() => {
          const matchedProduct = productCatalog.find(p => p.id === dealData.productId);
          return matchedProduct ? [{
            id: `li_${Date.now()}`,
            productId: matchedProduct.id,
            productName: matchedProduct.name,
            description: matchedProduct.description || "",
            quantity: 1,
            unitPrice: dealData.amount,
            totalPrice: dealData.amount,
            discountPercent: 0
          }] : [];
        })();

    const interestedIds = dealData.lineItems && dealData.lineItems.length > 0
      ? dealData.lineItems.map((li: any) => li.product.id)
      : (() => {
          const matchedProduct = productCatalog.find(p => p.id === dealData.productId);
          return matchedProduct ? [matchedProduct.id] : [];
        })();

    const now = new Date().toISOString();
    const dealId = `deal_${Date.now()}`;
    const followUpDueAt = dealData.createFollowUpTask && dealData.nextFollowUpDate
      ? new Date(dealData.nextFollowUpDate).toISOString()
      : undefined;
    const followUpTaskIntentKey = followUpDueAt ? getDealNextActionTaskIntentKey(dealId, followUpDueAt) : undefined;
    const newDealVal: Deal = {
      id: dealId,
      name: dealData.name,
      buyerRef: contact.organizationAccountId
        ? { type: "ORGANIZATION_ACCOUNT", id: contact.organizationAccountId }
        : { type: "CONTACT", id: contact.id },
      customerId: findCustomerForContact(contact)?.id || undefined,
      customerName: getCustomerDisplayNameForContact(contact) || undefined,
      contactId: contact.id,
      contactName: contact.fullName || contact.name,
      contactTitle: contact.title || "",
      contactPhone: contact.phone || "",
      contactEmail: contact.email || "",
      stage: dealData.stage as DealStage,
      amount: dealData.amount,
      opportunityScore: dealData.probability, // Technical Deal probability field; not a Contact score and not used for Contact qualification.
      ownerId: dealData.ownerId,
      expectedCloseDate: dealData.expectedCloseDate,
      createdAt: now,
      updatedAt: now,
      interestedProducts: interestedIds,
      lineItems: lineItemsArray,
      // Task ids are server-assigned and the follow-up Task is created after this Deal,
      // so no Task foreign reference is available; the deterministic key below is an
      // idempotency key only.
      ...(followUpDueAt ? {
        nextActionAt: followUpDueAt,
        nextActionSummary: dealData.nextAction,
      } : {}),
    };

    const optCreatedBody = tx("contactDetail.activity.opportunityCreatedDesc", "Đã lập cơ hội thương mại [{{name}}] - Giá trị: {{amount}} {{currency}} - Tiến trình: {{stage}} - Kế hoạch: {{nextAction}}")
      .replace("{{name}}", dealData.name)
      .replace("{{amount}}", dealData.amount.toLocaleString())
      .replace("{{currency}}", dealData.currency)
      .replace("{{stage}}", dealData.stage)
      .replace("{{nextAction}}", dealData.nextAction || tx("contactDetail.common.notProvided", "Chưa cung cấp"));

    const opportunityResult = executeContactOpportunityCreation(
      {
        contactId: contact.id,
        deal: newDealVal,
        now,
        activity: {
          title: tx("contactDetail.activity.opportunityCreatedTitle", "Sinh cơ hội bán hàng"),
          description: optCreatedBody,
          author: tx("common.system", "Hệ thống"),
        },
      },
      createContactOpportunityCreationRuntime(),
    );

    // Save as an action history log
    const timestampStr = new Date().toISOString().split("T")[0];
    const notProvided = tx("contactDetail.common.notProvided", "Chưa cung cấp");
    const noteBody = [
      `[${tx("contactDetail.activity.opportunityCreatedTitle", "Cơ hội được tạo")}]`,
      `${tx("contactDetail.activity.opportunityNoteType", "Loại hình")}: ${dealData.opportunityType || notProvided}`,
      `${tx("contactDetail.activity.opportunityNoteStage", "Giai đoạn")}: ${dealData.stage || notProvided}`,
      `${tx("contactDetail.activity.opportunityNoteBudget", "Ngân sách")}: ${dealData.amount.toLocaleString()} ${dealData.currency}`,
      `${tx("contactDetail.activity.opportunityNoteDemand", "Nhu cầu")}: ${dealData.demandSummary || notProvided}`,
      `${tx("contactDetail.activity.opportunityNotePainPoint", "Rào cản (Painpoint)")}: ${dealData.painPoints || notProvided}`,
      `${tx("contactDetail.activity.opportunityNoteNextAction", "Kế hoạch kế tiếp")}: ${dealData.nextAction || notProvided}`,
      `${tx("contactDetail.activity.opportunityNoteInternalNote", "Ghi chú nội bộ")}: ${dealData.note || "N/A"}`
    ].join("\n");

    const newNote = {
      id: `note-${Date.now()}`,
      title: tx("contactDetail.activity.opportunityNoteTitle", "Cơ hội: {{name}}").replace("{{name}}", dealData.name),
      body: noteBody,
      date: timestampStr,
      pinned: false
    };
    setContactNotes(prev => [newNote, ...prev]);

    if (followUpDueAt && followUpTaskIntentKey) {
      const actorId = currentMemberId || opportunityResult.deal.ownerId;
      await createTaskCommand({
        id: followUpTaskIntentKey,
        title: dealData.nextAction,
        description: dealData.demandSummary || undefined,
        priority: dealData.priority === "MEDIUM" ? "NORMAL" : dealData.priority as "LOW" | "NORMAL" | "HIGH" | "URGENT",
        assigneeId: opportunityResult.deal.ownerId,
        dueAt: followUpDueAt,
        customerId: canonicalCustomer?.id,
        relationshipRef: contactRelationshipRef,
        recordRef: { moduleKey: "deals", recordId: opportunityResult.deal.id, label: opportunityResult.deal.name },
        sourceRef: { type: "CONTACT_DEAL_FOLLOW_UP", id: opportunityResult.deal.id },
        dedupeKey: `contact-deal-follow-up:${opportunityResult.deal.id}:${followUpDueAt}`,
        actorId,
        actorName: resolveWorkspaceMemberName(actorId),
      }, {
        idempotencyKey: `task.create:${followUpTaskIntentKey}`,
        correlationId: `deal:${opportunityResult.deal.id}`,
      });
    }

    setShowOpportunityModal(false);

    const actualOwnerName = resolveWorkspaceMemberName(opportunityResult.deal.ownerId);
    const missingCustomer = Boolean(contact && !findCustomerForContact(contact)?.id);
    notifyProduct(
      locale === "vi"
        ? `Đã tạo cơ hội ${opportunityResult.deal.name} và giao cho ${actualOwnerName}.${missingCustomer ? " Liên hệ chưa được gắn với hồ sơ khách hàng." : ""}`
        : `Opportunity ${opportunityResult.deal.name} was created and assigned to ${actualOwnerName}.${missingCustomer ? " The contact is not linked to a customer profile yet." : ""}`,
      missingCustomer ? "warning" : "success",
      {
        actionLabel: locale === "vi" ? "Mở chi tiết" : "Open record",
        onAction: () => navigate(`/deals/${opportunityResult.deal.id}`),
        durationMs: 7000,
      },
    );
    setActiveTab("sales", "opportunities");
  };

  // `contact.archive` / `contact.restore` are BLOCKED canonical commands, so the action is
  // refused before any mutation is started rather than failing inside the command boundary.
  const refuseUnavailableContactRetention = (action: string): boolean => {
    if (!isContactRetentionUnavailable()) return false;
    showToast(backendUnavailableMessage({ locale, action }));
    return true;
  };

  const confirmDeleteContact = async () => {
    if (refuseUnavailableContactRetention(locale === "vi" ? "Lưu trữ liên hệ" : "Archiving a Contact")) return;
    await archiveContactViaApi(contact.id);
    setShowDeleteModal(false);
    navigate("/contacts");
  };

  const handleArchiveToggle = async () => {
    if (refuseUnavailableContactRetention(contact.status === "archived"
      ? (locale === "vi" ? "Khôi phục liên hệ" : "Restoring a Contact")
      : (locale === "vi" ? "Lưu trữ liên hệ" : "Archiving a Contact"))) return;
    const actorId = currentMemberId || contact.ownerId || "current-user";
    if (contact.status === "archived") {
      await restoreContactCommand(contact.id, { actorId, actorName: resolveWorkspaceMemberName(actorId), reason: locale === "vi" ? "Khôi phục từ lưu trữ." : "Restored from archive." });
      showToast(tx("contactDetail.toast.unarchived", "Đã khôi phục hồ sơ liên hệ."));
      return;
    }
    await archiveContactViaApi(contact.id);
    showToast(tx("contactDetail.toast.archived", "Đã di chuyển hồ sơ vào mục lưu trữ thành công."));
  };

  // Quote actions operate on canonical Quote records linked to the same relationship.
  const latestDealStage = [...affiliatedOpportunities]
    .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt))[0]?.stage;
  const handleRequestCreateQuote = () => {
    if (affiliatedOpportunities.length === 0) {
      showToast(tx("contactDetail.toast.createOpportunityBeforeQuote", "Bạn cần phải sinh cơ hội kinh doanh trước khi tạo Báo giá."));
      setActiveTab("sales", "opportunities");
    } else if (affiliatedOpportunities.length === 1) {
      navigate(`/quotes/new?dealId=${affiliatedOpportunities[0].id}`);
    } else {
      showToast(tx("contactDetail.toast.multipleOpportunitiesChoose", "Hãy chọn một Cơ hội cụ thể để gán Báo giá tương ứng."));
      setActiveTab("sales", "opportunities");
    }
  };

  const handleCompleteTask = async (id: string) => {
    if (pendingTaskId) return;
    const task = canonicalTaskById.get(id);
    if (!task) return;
    const actorId = currentMemberId || contact.ownerId;
    if (!actorId) {
      showToast(tx("contactDetail.toast.taskOwnerRequired", "Cần xác định người dùng hiện tại trước khi hoàn thành công việc."));
      return;
    }
    setPendingTaskId(id);
    try {
      await completeTaskCommand(id, {
        actorId,
        actorName: resolveWorkspaceMemberName(actorId),
        outcome: tx("contactDetail.activity.completedText", "Đã hoàn thành từ hồ sơ Contact."),
      });
      showToast(tx("contactDetail.toast.taskCompleted", "Đã hoàn thành công việc thành công!"));
    } catch (error) {
      showToast(formatApplicationError(error, { locale }));
    } finally {
      setPendingTaskId(null);
    }
  };

  // Interaction handlers for modular action modals
  const handleSaveQuickNote = (noteData: { title: string; body: string; type: string; pinned?: boolean; occurredAt?: string }) => {
    if (refuseUnavailableContactWrite(locale === "vi" ? "Ghi chú nhanh" : "Saving a quick note")) return;
    const occurredAt = noteData.occurredAt || new Date().toISOString();
    const timestampStr = occurredAt.split("T")[0];
    const newNote = {
      id: `note-${Date.now()}`,
      title: noteData.title,
      body: noteData.body,
      date: timestampStr,
      pinned: noteData.pinned,
      category: noteData.type as NoteActivityDraft["category"],
      occurredAt,
    };
    setContactNotes(prev => [newNote, ...prev]);

    // Append CRM activity (blocked projection in connected mode; already reported above).
    if (contactWritesUnavailable) return;
    setContacts(prev => prev.map(c => {
      if (contact && c.id === contact.id) {
        const currentActivities = c.activities || [];
        const newActivity = {
          id: `act_${Date.now()}`,
          type: "note",
          title: tx("contactDetail.activity.noteAdded", "Đã thêm ghi chú"),
          description: `[${tx(`contactDetail.modals.note.type.${noteData.type}`, noteData.type)}] ${noteData.title}: ${noteData.body}`,
          createdAt: occurredAt,
          author: "Sales Representative"
        };
        return {
          ...c,
          lastInteractionAt: new Date().toISOString(),
          activities: [newActivity, ...currentActivities]
        };
      }
      return c;
    }));

    setShowQuickNoteModal(false);
    showToast(tx("contactDetail.toast.noteAdded", "Ghi chú mới đã được lưu thành công."));
    setActiveTab("relationship", "notes");
  };

  // The Task itself is already committed authoritatively by TaskCreateModal. Only the
  // Contact timeline projection is blocked, so report that partial outcome precisely.
  const handleSaveTask = (task: Task) => {
    if (contactWritesUnavailable) {
      setShowTaskModal(false);
      setActiveTab("work", "tasks");
      showToast(locale === "vi"
        ? "Đã tạo công việc. Chưa ghi được vào dòng thời gian Liên hệ vì máy chủ chưa hỗ trợ."
        : "Task created. It could not be added to the Contact timeline yet because server support has not been released.");
      return;
    }
    setContacts((current) => current.map((item) => {
      if (item.id !== contact.id) return item;
      const currentActivities = item.activities || [];
      const newActivity = {
        id: `act_${Date.now()}`,
        type: "task",
        title: tx("contactDetail.activity.taskCreated", "Công việc mới"),
        description: `${task.title} (${tx("contactDetail.modals.task.typeLabel", "Hạn xử lý")}: ${new Date(task.dueAt).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}) | ${tx("contactDetail.fields.owner", "Phân công")}: ${resolveWorkspaceMemberName(task.assigneeId)}`,
        createdAt: task.createdAt,
        author: resolveWorkspaceMemberName(task.assigneeId),
      };
      return { ...item, activities: [newActivity, ...currentActivities] };
    }));

    setShowTaskModal(false);
    showToast(tx("contactDetail.toast.taskCreatedSuccessfully", "Đã khởi tạo công việc thành công!"));
    setActiveTab("work", "tasks");
  };

  const handleSaveMeeting = async (meetingData: {
    title: string;
    startDate: string;
    startTime: string;
    endTime: string;
    channel: string;
    location?: string;
    attendees?: string;
    owner: string;
    agenda?: string;
    reminder?: boolean;
  }) => {
    // Contact timeline projection is blocked; the authoritative Task command is not.
    if (contactWritesUnavailable) {
      showToast(locale === "vi"
        ? "Đã tạo công việc cho cuộc họp. Chưa ghi được vào dòng thời gian Liên hệ vì máy chủ chưa hỗ trợ."
        : "The meeting Task was created. It could not be added to the Contact timeline yet because server support has not been released.");
    }
    const assigneeId = resolveTaskAssigneeId(meetingData.owner, members, currentMemberId || contact.ownerId);
    const actorId = currentMemberId || contact.ownerId || assigneeId;
    const meetingTaskId = `task_contact_meeting_${toDueAt(meetingData.startDate, meetingData.startTime)}`;
    await createTaskCommand({
      id: meetingTaskId,
      title: `${tx("contactDetail.activityPanel.filters.meeting", "Họp")}: ${meetingData.title}`,
      description: [meetingData.agenda, meetingData.channel, meetingData.location].filter(Boolean).join(" · ") || undefined,
      priority: "HIGH",
      assigneeId,
      dueAt: toDueAt(meetingData.startDate, meetingData.startTime),
      customerId: canonicalCustomer?.id,
      relationshipRef: contactRelationshipRef,
      recordRef: { moduleKey: "contacts", recordId: contact.id, label: contact.fullName || contact.name },
      sourceRef: { type: "CONTACT_MEETING", id: contact.id },
      dedupeKey: `contact-meeting:${contact.id}:${toDueAt(meetingData.startDate, meetingData.startTime)}`,
      actorId,
      actorName: resolveWorkspaceMemberName(actorId),
    }, {
      idempotencyKey: `task.create:${meetingTaskId}`,
      correlationId: `contact:${contact.id}`,
    });

    // Append CRM activity (blocked projection in connected mode; already reported above).
    if (contactWritesUnavailable) return;
    setContacts(prev => prev.map(c => {
      if (contact && c.id === contact.id) {
        const currentActivities = c.activities || [];
        const newActivity = {
          id: `act_${Date.now()}`,
          type: "meeting",
          title: tx("contactDetail.activity.meetingScheduled", "Lịch hẹn cuộc họp"),
          description: `[${meetingData.channel}] ${meetingData.title} | ${meetingData.startDate} ${meetingData.startTime} | ${tx("contactDetail.fields.owner", "Phụ trách")}: ${meetingData.owner}`,
          createdAt: new Date().toISOString(),
          author: "Sales Representative"
        };
        return {
          ...c,
          lastInteractionAt: new Date().toISOString(),
          activities: [newActivity, ...currentActivities]
        };
      }
      return c;
    }));

    setShowMeetingModal(false);
    showToast(tx("contactDetail.toast.meetingScheduledSuccessfully", "Đã đặt lịch hẹn họp thành công!"));
    setActiveTab("work", "tasks");
  };

  const handleSaveLogCall = async (callData: {
    direction: string;
    result: string;
    summary: string;
    nextFollowUpDate?: string;
    createFollowUpTask?: boolean;
  }) => {
    // The Contact timeline projection is blocked in connected mode, but the
    // authoritative follow-up Task command below is not: skip only the projection.
    if (!contactWritesUnavailable) setContacts(prev => prev.map(c => {
      if (contact && c.id === contact.id) {
        const currentActivities = c.activities || [];
        const newActivity = {
          id: `act_${Date.now()}`,
          type: "call",
          title: tx("contactDetail.activity.callLogged", "Cuộc gọi được ghi nhận"),
          description: `[${callData.direction === "outbound" ? "Outbound" : "Inbound"} - ${tx(`contactDetail.modals.call.result.${callData.result}`, callData.result)}] ${callData.summary}`,
          createdAt: new Date().toISOString(),
          author: "Sales Representative"
        };
        return {
          ...c,
          lastInteractionAt: new Date().toISOString(),
          activities: [newActivity, ...currentActivities]
        };
      }
      return c;
    }));

    if (callData.createFollowUpTask && callData.nextFollowUpDate) {
      const assigneeId = currentMemberId || contact.ownerId || members[0]?.memberId || "";
      if (assigneeId) {
        const callTaskId = `task_contact_call_${toDueAt(callData.nextFollowUpDate)}`;
        await createTaskCommand({
          id: callTaskId,
          title: `${tx("contactDetail.activity.followUp", "Theo sát cuộc gọi")}: ${callData.summary.substring(0, 30)}...`,
          priority: "NORMAL",
          assigneeId,
          dueAt: toDueAt(callData.nextFollowUpDate),
          customerId: canonicalCustomer?.id,
          relationshipRef: contactRelationshipRef,
          recordRef: { moduleKey: "contacts", recordId: contact.id, label: contact.fullName || contact.name },
          sourceRef: { type: "CONTACT_CALL_FOLLOW_UP", id: contact.id },
          dedupeKey: `contact-call-follow-up:${contact.id}:${toDueAt(callData.nextFollowUpDate)}`,
          actorId: currentMemberId || assigneeId,
          actorName: resolveWorkspaceMemberName(currentMemberId || assigneeId),
        }, {
          idempotencyKey: `task.create:${callTaskId}`,
          correlationId: `contact:${contact.id}`,
        });
      }
    }

    setShowLogCallModal(false);
    showToast(contactWritesUnavailable
      ? (locale === "vi"
        ? "Đã tạo công việc theo dõi cuộc gọi. Chưa ghi được vào dòng thời gian Liên hệ vì máy chủ chưa hỗ trợ."
        : "The call follow-up Task was created. It could not be added to the Contact timeline yet because server support has not been released.")
      : tx("contactDetail.toast.callLoggedSuccessfully", "Ghi nhận cuộc gọi thành công."));
  };

  const handleSendEmail = (emailData: {
    to: string;
    subject: string;
    body: string;
    attachProposal?: boolean;
  }) => {
    if (refuseUnavailableContactWrite(locale === "vi" ? "Ghi email vào hồ sơ Liên hệ" : "Recording the email on the Contact")) return;
    // Append CRM activity (blocked projection in connected mode; already reported above).
    if (contactWritesUnavailable) return;
    setContacts(prev => prev.map(c => {
      if (contact && c.id === contact.id) {
        const currentActivities = c.activities || [];
        const newActivity = {
          id: `act_${Date.now()}`,
          type: "email",
          title: tx("contactDetail.activity.emailSent", "Email đã gửi"),
          description: `${tx("contactDetail.modals.email.subjectLabel", "Tiêu đề")}: ${emailData.subject} | ${emailData.body}`,
          createdAt: new Date().toISOString(),
          author: "Sales Representative"
        };
        return {
          ...c,
          lastInteractionAt: new Date().toISOString(),
          activities: [newActivity, ...currentActivities]
        };
      }
      return c;
    }));

    if (emailData.attachProposal) {
      const timestampStr = new Date().toISOString().split("T")[0];
      const newAttachment = {
        id: `att-${Date.now()}`,
        name: "SME_UnicoreCRM_Brochure_2026.pdf",
        size: "2.1 MB",
        date: timestampStr
      };
      setContactAttachments(prev => [newAttachment, ...prev]);
    }

    setShowSendEmailModal(false);
    showToast(tx("contactDetail.toast.emailSentSuccessfully", "Email đã được gửi."));
  };

  const handleSendSms = (smsData: {
    phone: string;
    body: string;
  }) => {
    if (refuseUnavailableContactWrite(locale === "vi" ? "Ghi SMS vào hồ sơ Liên hệ" : "Recording the SMS on the Contact")) return;
    // Append CRM activity (blocked projection in connected mode; already reported above).
    if (contactWritesUnavailable) return;
    setContacts(prev => prev.map(c => {
      if (contact && c.id === contact.id) {
        const currentActivities = c.activities || [];
        const newActivity = {
          id: `act_${Date.now()}`,
          type: "sms",
          title: tx("contactDetail.activity.smsSent", "SMS đã gửi"),
          description: smsData.body,
          createdAt: new Date().toISOString(),
          author: "Sales Representative"
        };
        return {
          ...c,
          lastInteractionAt: new Date().toISOString(),
          activities: [newActivity, ...currentActivities]
        };
      }
      return c;
    }));


    setShowSendSmsModal(false);
    showToast(tx("contactDetail.toast.smsSentSuccessfully", "Tin nhắn SMS của bạn đã được chuyển đi thành công."));
    setActiveTab("work", "activities");
  };

  // Contact notes tab actions
  const handleCreateNote = (noteData: NoteActivityDraft) => {
    if (refuseUnavailableContactWrite(locale === "vi" ? "Tạo ghi chú" : "Creating the note")) return;
    const occurredAt = new Date(noteData.occurredAt).toISOString();
    const timestampStr = occurredAt.split("T")[0];
    const newNote = {
      id: `note-${Date.now()}`,
      title: noteData.title,
      body: noteData.body,
      date: timestampStr,
      pinned: noteData.pinned,
      category: noteData.category,
      occurredAt,
    };
    setContactNotes(prev => [newNote, ...prev]);

    setContacts(prev => prev.map(c => {
      if (contact && c.id === contact.id) {
        const currentActivities = c.activities || [];
        const newActivity = {
          id: `act_${Date.now()}`,
          type: "note",
          title: tx("contactDetail.activity.noteAdded", "Đã thêm ghi chú"),
          description: `[${noteData.category}] ${noteData.title}: ${noteData.body}`,
          createdAt: occurredAt,
          author: "Sales Representative"
        };
        return {
          ...c,
          activities: [newActivity, ...currentActivities]
        };
      }
      return c;
    }));
    showToast(tx("contactDetail.toast.noteAdded", "Ghi chú mới đã được lưu thành công."));
  };

  const handleUpdateNote = (id: string, noteData: { title: string; body: string; pinned?: boolean }) => {
    if (refuseUnavailableContactWrite(locale === "vi" ? "Cập nhật ghi chú" : "Updating the note")) return;
    setContactNotes(prev => prev.map(n => n.id === id ? { ...n, ...noteData } : n));
    setContacts(prev => prev.map(c => {
      if (contact && c.id === contact.id) {
        const currentActivities = c.activities || [];
        const newActivity = {
          id: `act_${Date.now()}`,
          type: "note",
          title: tx("contactDetail.activity.noteUpdated", "Đã cập nhật ghi chú"),
          description: `${noteData.title}: ${noteData.body}`,
          createdAt: new Date().toISOString(),
          author: "Sales Representative"
        };
        return {
          ...c,
          activities: [newActivity, ...currentActivities]
        };
      }
      return c;
    }));
    showToast(tx("contactDetail.toast.noteUpdated", "Cập nhật ghi chú thành công."));
  };

  const handleDeleteNote = (id: string) => {
    if (refuseUnavailableContactWrite(locale === "vi" ? "Xóa ghi chú" : "Deleting the note")) return;
    setContactNotes(prev => prev.filter(n => n.id !== id));
    setContacts(prev => prev.map(c => {
      if (contact && c.id === contact.id) {
        const currentActivities = c.activities || [];
        const newActivity = {
          id: `act_${Date.now()}`,
          type: "note",
          title: tx("contactDetail.activity.noteDeleted", "Đã xóa ghi chú"),
          description: "Ghi chú đã bị gỡ khỏi hệ thống.",
          createdAt: new Date().toISOString(),
          author: "Sales Representative"
        };
        return {
          ...c,
          activities: [newActivity, ...currentActivities]
        };
      }
      return c;
    }));
    showToast(tx("contactDetail.toast.noteDeleted", "Đã xóa ghi chú thành công."));
  };

  const handleTogglePinNote = (id: string) => {
    if (refuseUnavailableContactWrite(locale === "vi" ? "Ghim ghi chú" : "Pinning the note")) return;
    setContactNotes(prev => prev.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
    showToast(tx("contactDetail.toast.notePinToggled", "Thay đổi trạng thái ghim ghi chú thành công."));
  };

  // Attachments CRUD
  const handleUploadAttachment = (data: {
    name: string;
    category: "proposal" | "contract" | "quotation" | "identity" | "requirement" | "other";
    size?: string;
    description?: string;
    file?: File;
  }) => {
    if (refuseUnavailableContactWrite(locale === "vi" ? "Tải tài liệu lên hồ sơ Liên hệ" : "Uploading the attachment")) return;
    const timestampStr = new Date().toISOString().split("T")[0];
    const newAttachment = {
      id: `att-${Date.now()}`,
      name: data.name,
      size: data.size || "1.4 MB",
      date: timestampStr,
      category: data.category,
      description: data.description,
      file: data.file,
    };
    setContactAttachments(prev => [newAttachment, ...prev]);

    setContacts(prev => prev.map(c => {
      if (contact && c.id === contact.id) {
        const currentActivities = c.activities || [];
        const newActivity = {
          id: `act_${Date.now()}`,
          type: "attachment",
          title: tx("contactDetail.timeline.attachmentUploaded", "Đã đính kèm tài liệu"),
          description: `${data.name} (${data.category}) | ${locale === "vi" ? "Dung lượng" : "File size"}: ${data.size || "1.4 MB"} ${data.description ? `| ${locale === "vi" ? "Mô tả" : "Description"}: ${data.description}` : ""}`,
          createdAt: new Date().toISOString(),
          author: "Sales Representative"
        };
        return {
          ...c,
          activities: [newActivity, ...currentActivities]
        };
      }
      return c;
    }));
    showToast(tx("contactDetail.toast.attachmentUploaded", "Đã tải lên tệp tin tài liệu thành công."));
  };

  const handleDeleteAttachment = (id: string) => {
    if (refuseUnavailableContactWrite(locale === "vi" ? "Xóa tài liệu" : "Deleting the attachment")) return;
    const att = contactAttachments.find(a => a.id === id);
    setContactAttachments(prev => prev.filter(a => a.id !== id));

    setContacts(prev => prev.map(c => {
      if (contact && c.id === contact.id) {
        const currentActivities = c.activities || [];
        const newActivity = {
          id: `act_${Date.now()}`,
          type: "attachment",
          title: tx("contactDetail.timeline.attachmentDeleted", "Đã xóa tài liệu đính kèm"),
          description: att ? `Đã gỡ tập tin: ${att.name}` : "Tập tin đã bị xóa.",
          createdAt: new Date().toISOString(),
          author: "Sales Representative"
        };
        return {
          ...c,
          activities: [newActivity, ...currentActivities]
        };
      }
      return c;
    }));
    showToast(tx("contactDetail.toast.attachmentDeleted", "Đã xóa tài liệu đính kèm thành công."));
  };

  const handleDownloadAttachment = (id: string) => {
    const att = contactAttachments.find(a => a.id === id);
    if (!att) return;
    if (att.file) {
      const url = URL.createObjectURL(att.file);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = att.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      showToast(`${tx("contactDetail.toast.downloading", "Đang tải xuống tệp:")} ${att.name}`);
      return;
    }
    showToast(tx("contactDetail.toast.downloadUnavailable", "Tệp này chưa có dữ liệu tải xuống trên thiết bị hiện tại."));
  };

  // Opportunity list stage progress and quotations. Deal owns its stage; Contact has no stage mirror.
  const handleAdvanceOpportunityStage = async (dealId: string) => {
    const stageFlow: DealStage[] = [
      DealStage.DISCOVERY,
      DealStage.QUALIFIED,
      DealStage.SOLUTION,
      DealStage.PROPOSAL,
      DealStage.NEGOTIATION,
    ];

    const targetDeal = deals.find((deal) => deal.id === dealId);
    if (!targetDeal) return;

    const currentIndex = stageFlow.indexOf(targetDeal.stage as DealStage);
    if (currentIndex === -1 || currentIndex >= stageFlow.length - 1) {
      showToast(locale === "vi"
        ? "Deal chỉ có thể chuyển sang WON khi có Quote Accepted hoặc Order Confirmed."
        : "A Deal can only move to WON with Quote Accepted or Order Confirmed evidence.");
      return;
    }

    const nextStage = stageFlow[currentIndex + 1];
    const now = new Date().toISOString();
    await transitionDealStageCommand(dealId, nextStage, {
      id: `act_opportunity_progress_${Date.now()}`,
      type: "stage",
      title: tx("contactDetail.activity.opportunityStageAdvanced", "Cập nhật giai đoạn cơ hội bán hàng"),
      description: `Cơ hội [${targetDeal.name}] chuyển từ [${targetDeal.stage}] sang [${nextStage}]`,
      createdAt: now,
      author: "Sales Representative",
      metadata: { fromStage: targetDeal.stage, toStage: nextStage },
    });

    showToast(tx("contactDetail.toast.opportunityStageAdvanced", `Đã cập nhật giai đoạn cơ hội sang ${nextStage}!`));
  };

  const handleCreateQuoteFromTab = (dealId: string) => {
    const matchedDeal = affiliatedOpportunities.find((deal) => deal.id === dealId);
    if (!matchedDeal) {
      showToast(tx("contactDetail.toast.createOpportunityBeforeQuote", "Bạn cần phải sinh cơ hội kinh doanh trước khi tạo Báo giá."));
      return;
    }
    navigate(`/quotes/new?dealId=${matchedDeal.id}`);
  };

  const handleSendQuoteFromTab = async (quoteId: string) => {
    const quote = canonicalQuotes.find((item) => item.id === quoteId);
    if (!quote) return;
    navigate(`/quotes/${quoteId}/edit?action=gmail`);
    showToast(tx("contactDetail.toast.quoteDeliveryRequired", "Mở Báo giá để gửi và lưu bằng chứng giao nhận."));
  };

  const handleDeleteQuoteFromTab = (quoteId: string) => {
    if (!canonicalQuotes.some((item) => item.id === quoteId)) return;
    void archiveQuoteCommand(quoteId, { reason: locale === "vi" ? "Lưu trữ từ chi tiết Liên hệ." : "Archived from Contact detail.", actorId: currentMemberId || contact.ownerId || "current-user" }).then(() => {
      showToast(tx("contactDetail.toast.quoteArchived", "Đã lưu trữ báo giá; lịch sử vẫn được giữ lại."));
    });
  };

  // Task updates always go through the canonical Tasks module.
  const handleRescheduleTask = async (id: string, newDate: string) => {
    if (pendingTaskId) return;
    const task = canonicalTaskById.get(id);
    const actorId = currentMemberId || contact.ownerId;
    if (!task || !actorId) return;
    setPendingTaskId(id);
    try {
      await rescheduleTaskCommand(id, {
        dueAt: toDueAt(newDate, task.dueAt.includes("T") ? task.dueAt.split("T")[1]?.slice(0, 5) : undefined),
        actorId,
        actorName: resolveWorkspaceMemberName(actorId),
      });
      showToast(tx("contactDetail.toast.taskRescheduled", "Điều chỉnh lịch hạn xử lý công việc thành công!"));
    } catch (error) {
      showToast(formatApplicationError(error, { locale }));
    } finally {
      setPendingTaskId(null);
    }
  };

  // Sum up totals for info calculations
  const totalQuotedAmount = displayQuotes.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const totalOrderValue = displayOrders.reduce((acc, curr) => acc + (curr.order.grandTotal || 0), 0);

  // Timeline combines Contact-owned interactions with canonical relationship activities.
  const relationshipActivities = taskActivity.activities.filter((activity) =>
    matchesRelationship(activity.relationshipRef)
    || matchesCustomerAlias(activity.customerId)
    || Boolean(activity.recordRef && linkedRecordIds.has(activity.recordRef.recordId)),
  );
  const careTimelineItems = [
    ...(contact.activities ? contact.activities.map(act => ({
      id: act.id || `contact-activity-${act.createdAt}`,
      title: act.title,
      description: act.description,
      date: act.createdAt ? act.createdAt.split("T")[0] : contact.createdAt.split("T")[0],
      type: act.type || "system"
    })) : []),
    ...relationshipActivities.map((activity) => ({
      id: activity.id,
      title: activity.subject,
      description: activity.body || "",
      date: activity.occurredAt.split("T")[0],
      type: activity.type.toLowerCase(),
      recordRef: activity.recordRef,
    })),
    { id: `contact-origin-${contact.id}`, title: tx("contactDetail.timeline.creation", "Khởi tạo liên hệ"), description: `${tx("contactDetail.timeline.creationDesc", "Hồ sơ liên hệ được tạo từ nguồn")}: ${contact.source || tx("common.manual", "Thao tác tay")}.`, date: contact.createdAt.split("T")[0], type: "system" }
  ].reduce((acc: any[], current) => {
    // Deduplicate logic: collapse event duplicates having similar descriptors
    const key = `${current.type}_${current.title}_${current.description}`;
    const duplicate = acc.find(item => `${item.type}_${item.title}_${item.description}` === key);
    if (!duplicate) {
      acc.push(current);
    }
    return acc;
  }, []).sort((a, b) => {
    const dateA = a.date.includes("/") 
      ? a.date.split("/").reverse().join("-") 
      : a.date;
    const dateB = b.date.includes("/") 
      ? b.date.split("/").reverse().join("-") 
      : b.date;
    return dateB.localeCompare(dateA) || b.id.localeCompare(a.id);
  });
  return {
    contactUpdateAvailable,
    canUpdateContact,
    canArchiveContact,
    contactOpportunityAvailable,
    contactQuery,
    customers,
    deals,
    quotes,
    crmConfig,
    orders,
    taskActivity,
    careCases,
    tx,
    locale,
    reduceMotion,
    currentMemberId,
    members,
    productCatalog,
    navigate,
    contacts,
    setContacts,
    location,
    contactId,
    contact,
    getTabTargetFromQuery,
    activeTab,
    requestedSubTab,
    setActiveTab,
    isRightPanelVisible,
    setIsRightPanelVisible,
    toggleRightPanel,
    toastMessage,
    setToastMessage,
    showToast,
    showEditModal,
    setShowEditModal,
    showOpportunityModal,
    setShowOpportunityModal,
    showDeleteModal,
    setShowDeleteModal,
    showQuickNoteModal,
    setShowQuickNoteModal,
    showTaskModal,
    setShowTaskModal,
    showMeetingModal,
    setShowMeetingModal,
    showLogCallModal,
    setShowLogCallModal,
    showSendEmailModal,
    setShowSendEmailModal,
    showSendSmsModal,
    setShowSendSmsModal,
    handleModalStateChange,
    isPanelOpen,
    contactNotes,
    setContactNotes,
    contactAttachments,
    setContactAttachments,
    canonicalCustomer,
    contactRelationshipRef,
    hasCustomerCommercialContext,
    ownerName,
    relationshipKey,
    customerAliases,
    matchesRelationship,
    matchesCustomerAlias,
    displayOrders,
    contactInvoices,
    contactReceivables,
    contactPayments,
    contactShipping,
    contactReturns,
    affiliatedOpportunities,
    affiliatedDealIds,
    canonicalQuotes,
    displayQuotes,
    linkedRecordIds,
    canonicalTasks,
    canonicalTaskById,
    tasks,
    linkedCustomerId,
    contactCareCases,
    displayPurchasedProducts,
    handleSaveContact,
    handleCreateOpportunity,
    confirmDeleteContact,
    handleArchiveToggle,
    latestDealStage,
    handleRequestCreateQuote,
    handleCompleteTask,
    handleSaveQuickNote,
    handleSaveTask,
    handleSaveMeeting,
    handleSaveLogCall,
    handleSendEmail,
    handleSendSms,
    handleCreateNote,
    handleUpdateNote,
    handleDeleteNote,
    handleTogglePinNote,
    handleUploadAttachment,
    handleDeleteAttachment,
    handleDownloadAttachment,
    handleAdvanceOpportunityStage,
    handleCreateQuoteFromTab,
    handleSendQuoteFromTab,
    handleDeleteQuoteFromTab,
    handleRescheduleTask,
    totalQuotedAmount,
    totalOrderValue,
    relationshipActivities,
    careTimelineItems,
  };
}
