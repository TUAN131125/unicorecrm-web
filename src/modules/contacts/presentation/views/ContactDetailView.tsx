import React, { useState, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ShieldAlert, Sparkles } from "lucide-react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { formatVnd } from "@/shared/lib/format/currency";
import { Contact } from "../../domain/model/contact.types";
import { getActiveContactOrganizationRelationships } from "../../domain/model/contactOrganizationRelationships";
import type { CustomerDisplay as Customer } from "@/modules/customers";
import { Deal, DealStage } from "@/modules/deals";
import { Quote } from "@/modules/quotes";
import { QuoteStatus } from "@/modules/quotes";
import type { CrmWorkspaceConfig } from "@/platform/workspace-config";

import { useI18n } from "@/i18n";
import { getProductCatalogSnapshot, subscribeToProductCatalog } from "@/modules/products";
import { useSubscribableSnapshot } from "@/platform/react";
import { RecordDetailFrame } from "@/components/crm/detail-archetype";
import { relationshipRecordPath } from "@/components/crm/relationship-detail";
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
import { type TaskActivitySnapshot } from "@/modules/tasks";
import type { SupportCase } from "@/modules/support";
import { relationshipRefKey, type RelationshipRef } from "@/platform/identity";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { listWorkspaceMemberDirectory, resolveWorkspaceMemberName } from "@/platform/member-directory";
import { getDisplayOrdersForContact } from "@/modules/orders";
import { useContacts } from "../hooks/useContacts";
import { getContactPreference, setContactPreference } from "../../public/contacts";
import { findCustomerForContact, getCustomerDisplayNameForContact } from "../model/contactCustomerLookup";

interface ContactDetailPageProps {
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
import type { useContactDetailController } from "../hooks/useContactDetailController";

type Controller = NonNullable<ReturnType<typeof useContactDetailController>>;

export function ContactDetailView({ controller }: { controller: Controller }) {
  const {
    canUpdateContact,
    contactOpportunityAvailable,
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
  } = controller;
  const openOpportunity = contactOpportunityAvailable ? () => setShowOpportunityModal(true) : undefined;
  return (
    <RecordDetailFrame id="contact-detail-page-workspace" className="min-w-0 space-y-4 rounded-2xl bg-slate-50 p-1 text-[11px] text-slate-700">
      
      {/* 1. COMPACT CRM RECORD HEADER */}
      <ContactRecordHeader
        contact={contact}
        ownerName={ownerName}
        canUpdateContact={canUpdateContact}
        onEditClick={() => setShowEditModal(true)}
        onCreateOpportunityClick={openOpportunity}
        onAddNoteClick={() => setShowQuickNoteModal(true)}
        onUploadAttachmentClick={() => {
          setActiveTab("attachments");
          showToast(tx("contactDetail.toast.attachmentPrompt", "Mở khung tài liệu đính kèm."));
        }}
        onCreateQuoteClick={handleRequestCreateQuote}
        onAddAppointmentClick={() => setShowMeetingModal(true)}
        onAddTaskClick={() => setShowTaskModal(true)}
        onArchiveToggle={handleArchiveToggle}
        onDeleteClick={() => setShowDeleteModal(true)}
        showToast={showToast}
      />

      {/* 2. BUSINESS WORKSPACE WITH COLLAPSIBLE INSIGHTS PANEL */}
      <div className="relative min-w-0 xl:min-h-[calc(100vh-170px)]">
        <div className="flex min-w-0 flex-col gap-3 xl:min-h-[calc(100vh-170px)] xl:flex-row xl:items-start">
        {/* Left space: Details & Main Work Tabs Workspace */}
        <main className="w-full min-w-0 xl:flex-1">
          <div className="relative z-10 min-h-[580px] overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm xl:min-h-[calc(100vh-170px)]">
            {/* TABBAR DECORATED INSIDE THE CARD */}
            <ContactDetailTabs
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              counts={{
                relationship: contactNotes.length + (canonicalCustomer ? 1 : 0) + getActiveContactOrganizationRelationships(contact).length,
                sales: affiliatedOpportunities.length + displayQuotes.length,
                transactions: displayOrders.length + contactInvoices.length + contactReceivables.length + contactPayments.length + contactShipping.length + contactReturns.length + displayPurchasedProducts.length,
                service: contactCareCases.length,
                work: tasks.length + careTimelineItems.length,
                attachments: contactAttachments.length,
              }}
              isRightPanelVisible={isPanelOpen}
              onToggleRightPanel={toggleRightPanel}
            />

            {/* TAB CONTENT VIEW AREA */}
            <div className="p-4 sm:p-5 text-slate-800 text-left">
              <RecordTabTransition transitionKey={activeTab} axis="y" minHeightClassName="min-h-[460px]">
              <ContactDetailTabContent
                activeTab={activeTab}
                requestedSubTab={requestedSubTab}
                overview={{
                  contact,
                  customer: canonicalCustomer,
                  customerName: getCustomerDisplayNameForContact(contact),
                  ownerName,
                  locale,
                  opportunityCount: affiliatedOpportunities.length,
                  orderCount: displayOrders.length,
                  invoiceCount: contactInvoices.length,
                  activeTaskCount: tasks.filter((task) => task.status !== "completed").length,
                  supportCount: contactCareCases.length,
                  totalOrderValue,
                  onSelectTab: setActiveTab,
                  onOpenCustomer: canonicalCustomer ? () => navigate(`/customers/${canonicalCustomer.id}`) : undefined,
                  onCreateOpportunity: openOpportunity,
                  onCreateTask: () => setShowTaskModal(true),
                }}
                detailInfo={{ contact, ownerName, totalQuotedAmount, totalOrderValue, latestDealStage }}
                relationships={{
                  contact,
                  customer: canonicalCustomer,
                  customerName: getCustomerDisplayNameForContact(contact),
                  onOpenCustomer: canonicalCustomer ? () => navigate(`/customers/${canonicalCustomer.id}`) : undefined,
                  onOpenOrganization: (organizationId) => navigate(`/organizations/${organizationId}`),
                  onOpenCustomerDirectory: () => navigate("/customers"),
                }}
                notes={{
                  contactNotes, onCreateNote: handleCreateNote, onUpdateNote: handleUpdateNote,
                  onDeleteNote: handleDeleteNote, onTogglePinNote: handleTogglePinNote, isArchived: contact.status === "archived",
                }}
                attachments={{
                  contactAttachments, onUploadAttachment: handleUploadAttachment, onDeleteAttachment: handleDeleteAttachment,
                  onDownloadAttachment: handleDownloadAttachment, isArchived: contact.status === "archived", onModalStateChange: handleModalStateChange,
                }}
                purchasedProducts={{ contact, purchasedProducts: displayPurchasedProducts, onCreateOpportunityClick: openOpportunity, onOpenModule: () => navigate("/products") }}
                opportunities={{
                  opportunities: affiliatedOpportunities, onCreateOpportunityClick: openOpportunity, onOpenModule: () => navigate("/deals"),
                  onCreateQuoteFromOpportunity: handleCreateQuoteFromTab, onAdvanceOpportunityStage: handleAdvanceOpportunityStage,
                  isArchived: contact.status === "archived",
                  completedOrderDealIds: displayOrders.filter(o => o.order?.state === "COMPLETED").map(o => o.order.sourceDealId).filter((id): id is string => Boolean(id)),
                  quotes: canonicalQuotes,
                }}
                orders={{
                  orders: displayOrders,
                  onOpenModule: () => navigate("/orders"),
                  onCreateOrderClick: () => {
                    if (findCustomerForContact(contact)?.id) navigate(`/orders/new?customerId=${findCustomerForContact(contact)?.id}&contactId=${contact.id}`);
                    else showToast(locale === "vi" ? "Liên hệ này chưa gắn với khách hàng. Vui lòng chọn hoặc tạo khách hàng trước khi tạo đơn hàng." : "This contact is not linked to a customer. Please select or create a customer before creating an order.");
                  },
                }}
                quotations={{
                  quotes: displayQuotes, hasOpportunity: affiliatedOpportunities.length > 0, opportunities: affiliatedOpportunities, onOpenModule: () => navigate("/quotes"),
                  onCreateOpportunityClick: openOpportunity, onCreateQuoteClick: handleCreateQuoteFromTab,
                  onSendQuote: handleSendQuoteFromTab, onDeleteQuote: handleDeleteQuoteFromTab, isArchived: contact.status === "archived",
                  onModalStateChange: handleModalStateChange,
                }}
                invoices={{
                  invoices: contactInvoices,
                  receivables: contactReceivables,
                  onOpenInvoice: (id) => navigate(`/invoices/${id}`),
                  onOpenReceivable: (id) => navigate(`/receivables/${id}`),
                  onOpenModule: () => navigate("/invoices"),
                  onCreateInvoice: () => {
                    if (!canonicalCustomer) {
                      showToast(locale === "vi" ? "Cần liên kết Customer 360 trước khi tạo hóa đơn." : "Link Customer 360 before creating an invoice.");
                      setActiveTab("relationship", "people");
                      return;
                    }
                    navigate(`/invoices/new?customerId=${canonicalCustomer.id}&contactId=${contact.id}`);
                  },
                }}
                payments={{
                  transactions: contactPayments,
                  receivables: contactReceivables,
                  onOpenPayments: () => navigate("/payments"),
                  onOpenReceivables: () => navigate("/receivables"),
                  onOpenReceivable: (id) => navigate(`/receivables/${id}`),
                }}
                shipping={{
                  bookings: contactShipping,
                  onOpen: (id) => navigate(`/shipping/${id}`),
                  onOpenModule: () => navigate("/shipping"),
                  onReviewOrders: () => setActiveTab("transactions", "orders"),
                }}
                returns={{
                  requests: contactReturns,
                  onOpen: (id) => navigate(`/returns/${id}`),
                  onOpenModule: () => navigate("/returns"),
                  onReviewOrders: () => setActiveTab("transactions", "orders"),
                }}
                purchaseHistory={{
                  orders: displayOrders.map((item) => item.order),
                  invoices: contactInvoices,
                  transactions: contactPayments,
                  bookings: contactShipping,
                  returns: contactReturns,
                  onOpenRecord: (moduleKey, id) => navigate(relationshipRecordPath(moduleKey, id)),
                  onOpenOrders: () => navigate("/orders"),
                }}
                activeTasks={{
                  tasks, onCreateTask: () => setShowTaskModal(true), onScheduleMeeting: () => setShowMeetingModal(true), onOpenModule: () => navigate("/tasks"),
                  onCompleteTask: handleCompleteTask, onRescheduleTask: handleRescheduleTask, isArchived: contact.status === "archived",
                  onModalStateChange: handleModalStateChange,
                }}
                careCases={{
                  cases: contactCareCases,
                  onCreateCase: () => {
                    if (!linkedCustomerId) {
                      showToast(locale === "vi"
                        ? "Liên hệ này chưa gắn với khách hàng. Hãy liên kết khách hàng trước khi tạo Phiếu hỗ trợ."
                        : "This contact is not linked to a customer. Link a customer before creating a Support Ticket.");
                      return;
                    }
                    const params = new URLSearchParams({ contactId: contact.id, customerId: linkedCustomerId });
                    navigate(`/support/cases/new?${params.toString()}`);
                  },
                  onOpenCase: (caseId) => navigate(`/support/cases/${caseId}`),
                  onOpenModule: () => navigate("/support/cases"),
                  isArchived: contact.status === "archived",
                }}
                activities={{
                  activities: careTimelineItems,
                  onLogActivity: () => setShowQuickNoteModal(true),
                  onOpenTasks: () => navigate("/tasks"),
                  onOpenRecord: (moduleKey, recordId) => navigate(relationshipRecordPath(moduleKey, recordId)),
                }}
              />
              </RecordTabTransition>
            </div>
          </div>
        </main>

        {/* Right Interaction Panel (MISA Insight sidebar layout) */}
        <AnimatePresence initial={false} mode="popLayout">
          {isPanelOpen ? (
            <motion.aside
              layout="position"
              key="contact-interaction-panel"
              initial={reduceMotion ? false : { opacity: 0, x: 30, scale: 0.985, filter: "blur(3px)" }}
              animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 22, scale: 0.99, filter: "blur(2px)" }}
              transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 330, damping: 34, mass: 0.78 }}
              className="relative z-10 w-full min-w-0 xl:sticky xl:top-4 xl:h-[calc(100vh-140px)] xl:w-[350px] xl:shrink-0"
            >
              <ContactInsightPanel
                contact={contact}
                tasks={tasks}
                onAddTask={() => setShowTaskModal(true)}
                onAddAppointment={() => setShowMeetingModal(true)}
                onAddNote={() => setShowQuickNoteModal(true)}
                onCreateOpportunity={openOpportunity}
                onCompleteTask={handleCompleteTask}
                onLogCall={() => setShowLogCallModal(true)}
                onSendEmail={() => setShowSendEmailModal(true)}
                onSendSms={() => setShowSendSmsModal(true)}
                onAddMeeting={() => setShowMeetingModal(true)}
                recentActivities={careTimelineItems}
                showToast={showToast}
              />
            </motion.aside>
          ) : null}
        </AnimatePresence>
        </div>

      </div>

      {/* Floating Toast notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 shadow-2xl animate-fade-in text-left">
          <Sparkles size={14} className="text-indigo-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <ContactDetailDialogs
        contact={contact}
        tx={tx}
        edit={{
          isOpen: showEditModal,
          onClose: () => setShowEditModal(false),
          contact,
          onSave: handleSaveContact,
        }}
        opportunity={{
          isOpen: contactOpportunityAvailable && showOpportunityModal,
          onClose: () => setShowOpportunityModal(false),
          contact,
          onSave: handleCreateOpportunity,
        }}
        deleteContact={{
          isOpen: showDeleteModal,
          onClose: () => setShowDeleteModal(false),
          onConfirm: confirmDeleteContact,
        }}
        quickNote={{ isOpen: showQuickNoteModal, onClose: () => setShowQuickNoteModal(false), onSave: handleSaveQuickNote }}
        task={{
          isOpen: showTaskModal, onClose: () => setShowTaskModal(false), onCreated: handleSaveTask,
          defaults: { assigneeId: contact.ownerId || currentMemberId || undefined },
          context: { customerId: canonicalCustomer?.id, relationshipRef: contactRelationshipRef, recordRef: { moduleKey: "contacts", recordId: contact.id, label: contact.fullName || contact.name }, sourceRef: { type: "CONTACT_DETAIL", id: contact.id }, label: contact.fullName || contact.name },
        }}
        meeting={{ isOpen: showMeetingModal, onClose: () => setShowMeetingModal(false), onSave: handleSaveMeeting, isDoNotContact: contact.status === "do_not_contact" || contact.doNotContact }}
        logCall={{ isOpen: showLogCallModal, onClose: () => setShowLogCallModal(false), onSave: handleSaveLogCall, isDoNotContact: contact.status === "do_not_contact" || contact.doNotContact }}
        email={{ isOpen: showSendEmailModal, onClose: () => setShowSendEmailModal(false), prefilledEmail: contact.email || contact.workEmail || "", onSend: handleSendEmail, isDoNotContact: contact.status === "do_not_contact" || contact.doNotContact }}
        sms={{ isOpen: showSendSmsModal, onClose: () => setShowSendSmsModal(false), prefilledPhone: contact.phone || contact.mobilePhone || "", onSend: handleSendSms, isDoNotContact: contact.status === "do_not_contact" || contact.doNotContact }}
      />

    </RecordDetailFrame>
  );
}
