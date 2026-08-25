import { backendUnavailableMessage, formatApplicationError, formatOperationUnavailableError } from "@/shared/operations";
import React, { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { RecordDetailFrame, type RecordAttachmentItem, type RecordAttachmentUploadData } from "@/components/crm/detail-archetype";
import { Button, ConfirmDialog, RecordTabTransition } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { listWorkspaceMemberDirectory, resolveWorkspaceMemberName } from "@/platform/member-directory";
import {
  completeTaskCommand,
  TaskCreateModal,
  logActivityCommand,
  type Task,
} from "@/modules/tasks";
import { createDealForCustomer, isCustomerCommercialActionsUnavailable } from "@/workflows/customer-commercial-actions";
import { DealFormModal, getDealStagesSnapshot, mapSelectedPickerItemsToDealLineItems, type DealFormDraft } from "@/modules/deals";
import { updateCustomerIdentityFrom360 } from "@/workflows/customer-identity";
import {
  archiveCustomerCommand,
  isCustomerRetentionUnavailable,
  completeCustomerOnboardingSnapshot,
  updateCustomerLifecycleSnapshot,
  type Customer,
} from "../../public/api";
import { buildCustomer360ReadModel } from "../model/customer360ReadModel";
import { customerPresentationPreferences } from "../customerPresentationPreferences";
import {
  CustomerDetailTabs,
  type CustomerDetailTab,
} from "../detail/CustomerDetailTabs";
import { CustomerDetailTabContent } from "../detail/CustomerDetailTabContent";
import {
  CustomerEditModal,
  type CustomerEditDraft,
} from "../detail/CustomerEditModal";
import { CustomerInsightPanel } from "../detail/CustomerInsightPanel";
import {
  CustomerQuickActivityModal,
  type CustomerQuickAction,
  type CustomerQuickActivityDraft,
} from "../detail/CustomerQuickActivityModal";
import { CustomerRecordHeader } from "../detail/CustomerRecordHeader";

interface Customer360PageProps {
  customer: Customer;
  refreshToken?: unknown;
}

const RIGHT_PANEL_PREFERENCE_KEY = "centrix_customer_right_panel_visible";

export const Customer360Page: React.FC<Customer360PageProps> = ({
  customer,
  refreshToken,
}) => {
  const navigate = useNavigate();
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const model = useMemo(
    () => buildCustomer360ReadModel(customer),
    [customer, refreshToken],
  );
  const session = getAuthSessionSnapshot();
  const access = useEffectiveAccess();
  const canCompleteOnboarding = access.can(CAPABILITIES.CUSTOMERS_EDIT);
  const currentMemberId = session?.principal.memberId;
  const members = listWorkspaceMemberDirectory();
  const currentActorName =
    session?.principal.displayName || session?.principal.email || "CRM User";
  const defaultOwnerId =
    customer.careOwnerId ||
    model.identity.ownerId ||
    currentMemberId ||
    members[0]?.memberId ||
    "";
  const ownerId = customer.careOwnerId || model.identity.ownerId;
  const ownerName =
    (ownerId ? resolveWorkspaceMemberName(ownerId) : undefined) ||
    session?.principal.displayName ||
    "—";

  const [activeTab, setActiveTab] = useState<CustomerDetailTab>("overview");
  const [requestedSubTab, setRequestedSubTab] = useState<string>();
  const reduceMotion = useReducedMotion();
  const [isRightPanelVisible, setIsRightPanelVisible] = useState(() =>
    customerPresentationPreferences.get(RIGHT_PANEL_PREFERENCE_KEY, true),
  );
  const [editOpen, setEditOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [quickAction, setQuickAction] = useState<CustomerQuickAction | null>(
    null,
  );
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [savingActivity, setSavingActivity] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [creatingDeal, setCreatingDeal] = useState(false);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [completingOnboarding, setCompletingOnboarding] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [customerAttachments, setCustomerAttachments] = useState<RecordAttachmentItem[]>([]);

  const noteCount = model.timeline.filter(
    (item) => item.kind === "NOTE",
  ).length;
  // Keep the interaction workspace mounted while an overlay form is open. The modal
  // should layer above the detail page without changing its layout or panel preference.
  const isPanelOpen = isRightPanelVisible;


  const selectCustomerView = (tab: CustomerDetailTab, subTab?: string) => {
    setRequestedSubTab(subTab);
    setActiveTab(tab);
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(""), 2800);
  };

  const openDealModal = () => setDealOpen(true);

  const openCareModal = () =>
    navigate(
      `/support/cases/new?customerId=${customer.id}&source=customer_360`,
    );

  const openTaskModal = () => setTaskOpen(true);

  // Customer identity + lifecycle have no production contract yet (WF-06 and
  // `updateCustomerLifecycle` are blocked). Connected mode fails closed inside the
  // workflow; the user must be told the action is unavailable, never left guessing.
  const saveCustomerProfile = (draft: CustomerEditDraft) => {
    if (savingIdentity) return;
    setSavingIdentity(true);
    try {
      updateCustomerIdentityFrom360(customer.id, {
      displayName: draft.displayName,
      email: draft.email,
      phone: draft.phone,
      address: draft.address,
      source: draft.source,
      salutation: draft.salutation,
      title: draft.title,
      department: draft.department,
      roleAtCompany: draft.roleAtCompany,
      workEmail: draft.workEmail,
      personalEmail: draft.personalEmail,
      mobilePhone: draft.mobilePhone,
      workPhone: draft.workPhone,
      otherPhone: draft.otherPhone,
      zalo: draft.zalo,
      facebook: draft.facebook,
      preferredContactChannel: draft.preferredContactChannel,
      communicationConsent: draft.communicationConsent,
      doNotCall: draft.doNotCall,
      doNotEmail: draft.doNotEmail,
      doNotSms: draft.doNotSms,
      doNotZalo: draft.doNotZalo,
      doNotContact: draft.doNotContact,
      doNotContactReason: draft.doNotContactReason,
      decisionRole: draft.decisionRole,
      relationshipLevel: draft.relationshipLevel,
      painPoint: draft.painPoint,
      needSummary: draft.needSummary,
      consultingNote: draft.consultingNote,
      followUpNote: draft.followUpNote,
      contactNotes: draft.contactNotes,
      legalName: draft.legalName,
      taxCode: draft.taxCode,
      domain: draft.domain,
      website: draft.website,
      industry: draft.industry,
      sizeBand: draft.sizeBand,
      employeeCount: parseOptionalNumber(draft.employeeCount),
      annualRevenue: parseOptionalNumber(draft.annualRevenue),
      organizationStatus: draft.organizationStatus,
      organizationRelationshipLevel: draft.organizationRelationshipLevel,
      organizationNotes: draft.organizationNotes,
      actorId: currentMemberId || "system",
    });
      updateCustomerLifecycleSnapshot(customer.id, {
        status: draft.status,
        health: draft.health,
        careOwnerId: draft.careOwnerId || undefined,
        segment: draft.segment.trim() || undefined,
        tags: splitTags(draft.tags),
        nextCareAt: toOptionalBusinessIso(draft.nextCareAt),
        lastCareAt: toOptionalBusinessIso(draft.lastCareAt),
        tier: draft.tier,
        serviceLevel: draft.serviceLevel,
        careCadenceDays: Math.max(1, Math.min(365, Number(draft.careCadenceDays) || 30)),
      });
      setEditOpen(false);
      showToast(
        isVi
          ? "Đã cập nhật Customer và ghi dữ liệu về đúng module sở hữu."
          : "Customer updated through the correct owning modules.",
      );
    } catch (error) {
      showToast(formatOperationUnavailableError(error, {
        locale,
        action: isVi ? "Cập nhật hồ sơ Customer" : "Updating the Customer profile",
      }));
    } finally {
      setSavingIdentity(false);
    }
  };

  const createDeal = async (draft: DealFormDraft) => {
    if (creatingDeal) return;
    // WF-04 customer-commercial-actions is BLOCKED with
    // `connectedFrontendCoordinatorAllowed: false`. `deal.create` and `task.create` are both
    // ready, so nothing else would stop this from committing a Deal and then a Task for a
    // workflow the backend owns. Refuse on WF-04 itself, before the first command.
    if (isCustomerCommercialActionsUnavailable()) {
      setDealOpen(false);
      showToast(backendUnavailableMessage({
        locale,
        action: isVi ? "Tạo cơ hội thương mại cho khách hàng" : "Creating a commercial opportunity for this Customer",
      }));
      return;
    }
    const lineItems = mapSelectedPickerItemsToDealLineItems(draft.lineItems);
    setCreatingDeal(true);
    try {
      const deal = await createDealForCustomer({
      customerId: customer.id,
      id: crypto.randomUUID(),
      name: draft.name,
      amount: draft.amount,
      ownerId: draft.ownerId,
      expectedCloseDate: draft.expectedCloseDate || undefined,
      actorName: currentActorName,
      stage: draft.stage,
      probability: draft.probability,
      forecastCategory: draft.forecastCategory,
      followUpTask: draft.createFollowUpTask && draft.nextActionAt ? {
        title: draft.nextActionSummary,
        dueAt: draft.nextActionAt,
        description: draft.demandSummary || undefined,
      } : undefined,
        notes: [draft.demandSummary, draft.painPoints, draft.notes].filter(Boolean).join(" · "),
        interestedProducts: draft.lineItems.map((item) => item.product.id),
        lineItems,
      });
      setDealOpen(false);
      navigate(`/deals/${deal.id}`);
    } catch (error) {
      showToast(formatApplicationError(error, { locale }));
    } finally {
      setCreatingDeal(false);
    }
  };


  const saveQuickActivity = async (draft: CustomerQuickActivityDraft) => {
    if (savingActivity) return;
    if (!currentMemberId) {
      showToast(
        isVi
          ? "Phiên đăng nhập chưa có member hợp lệ."
          : "The active session has no valid member.",
      );
      return;
    }
    setSavingActivity(true);
    try {
      await logActivityCommand({
        id: crypto.randomUUID(),
        type: draft.type,
        subject: draft.subject,
        body: draft.body,
        actorId: currentMemberId,
        actorName: currentActorName,
        occurredAt: draft.occurredAt,
        customerId: customer.id,
        relationshipRef: customer.relationshipRef,
        recordRef: {
          moduleKey: "customers",
          recordId: customer.id,
          label: model.identity.displayName,
        },
        sourceRef: { type: "CUSTOMER_360", id: customer.id },
      });
      setQuickAction(null);
      showToast(
        isVi
          ? "Đã ghi hoạt động vào timeline Customer 360."
          : "Activity logged to the Customer 360 timeline.",
      );
    } catch (error) {
      showToast(formatApplicationError(error, { locale }));
    } finally {
      setSavingActivity(false);
    }
  };

  const completeTask = async (task: Task) => {
    if (completingTaskId) return;
    if (!currentMemberId) {
      showToast(
        isVi
          ? "Phiên đăng nhập chưa có member hợp lệ."
          : "The active session has no valid member.",
      );
      return;
    }
    setCompletingTaskId(task.id);
    try {
      await completeTaskCommand(task.id, {
        actorId: currentMemberId,
        actorName: currentActorName,
        outcome: isVi
          ? "Hoàn thành từ Customer 360"
          : "Completed from Customer 360",
      });
      showToast(isVi ? "Đã hoàn thành công việc." : "Task completed.");
    } catch (error) {
      showToast(formatApplicationError(error, { locale }));
    } finally {
      setCompletingTaskId(null);
    }
  };

  const openSource = () =>
    navigate(
      customer.relationshipRef.type === "CONTACT"
        ? `/contacts/${customer.relationshipRef.id}`
        : `/organizations/${customer.relationshipRef.id}`,
    );

  const toggleRightPanel = () => {
    setIsRightPanelVisible((current) => {
      const next = !current;
      customerPresentationPreferences.set(RIGHT_PANEL_PREFERENCE_KEY, next);
      return next;
    });
  };



  return (
    <RecordDetailFrame id="customer-detail-page-workspace" className="min-w-0 space-y-4 rounded-2xl bg-slate-50 p-1 text-[11px] text-slate-700">
      <CustomerRecordHeader
        model={model}
        ownerName={ownerName}
        onEditClick={() => setEditOpen(true)}
        onCreateOpportunityClick={openDealModal}
        onCreateQuoteClick={() =>
          navigate(`/quotes/new?customerId=${customer.id}`)
        }
        onCreateOrderClick={() =>
          navigate(`/orders/new?customerId=${customer.id}`)
        }
        onCreateCareClick={openCareModal}
        onAddTaskClick={openTaskModal}
        onOpenSourceClick={openSource}
        onArchiveClick={() => setArchiveOpen(true)}
      />

      {customer.onboardingStatus !== "COMPLETED" && canCompleteOnboarding && (
        <section className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold">{isVi ? "Customer đang chờ hoàn tất onboarding" : "Customer onboarding is pending"}</div>
            <p className="mt-1 text-xs leading-5">{isVi ? "Xác nhận hồ sơ và người phụ trách để chuyển Customer từ NEW sang trạng thái vận hành." : "Confirm the profile and relationship owner to move the Customer from NEW into an operational state."}</p>
          </div>
          <Button
            type="button"
            variant="primary"
            disabled={completingOnboarding}
            onClick={() => {
              if (completingOnboarding) return;
              setCompletingOnboarding(true);
              try {
                completeCustomerOnboardingSnapshot(customer.id, currentMemberId || "system");
                showToast(isVi ? "Đã hoàn tất onboarding Customer." : "Customer onboarding completed.");
              } catch (error) {
                showToast(formatOperationUnavailableError(error, {
                  locale,
                  action: isVi ? "Hoàn tất onboarding Customer" : "Completing Customer onboarding",
                }));
              } finally {
                setCompletingOnboarding(false);
              }
            }}
          >
            {isVi ? "Hoàn tất onboarding" : "Complete onboarding"}
          </Button>
        </section>
      )}

      <div className="relative min-w-0 xl:min-h-[calc(100vh-170px)]">
        <div className="flex min-w-0 flex-col gap-3 xl:min-h-[calc(100vh-170px)] xl:flex-row xl:items-start">
          <main className="w-full min-w-0 xl:flex-1">
            <div className="relative z-10 min-h-[580px] overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm xl:min-h-[calc(100vh-170px)]">
              <CustomerDetailTabs
                activeTab={activeTab}
                setActiveTab={(tab) => selectCustomerView(tab)}
                counts={{
                  overview: 0,
                  relationship:
                    model.identity.contacts.length + noteCount,
                  sales: model.deals.length + model.quotes.length,
                  transactions:
                    model.orders.length +
                    model.invoices.length +
                    model.receivables.length +
                    model.paymentTransactions.length +
                    model.shippingBookings.length +
                    model.returns.length +
                    model.productsPurchased.length,
                  service: model.supportCases.length,
                  work: model.tasks.length + model.timeline.length,
                  attachments: customerAttachments.length,
                }}
                isRightPanelVisible={isPanelOpen}
                onToggleRightPanel={toggleRightPanel}
              />

              <div className="p-4 text-left text-slate-800 sm:p-5">
                <RecordTabTransition transitionKey={activeTab} axis="y" minHeightClassName="min-h-[460px]">
                <CustomerDetailTabContent
                  activeTab={activeTab}
                  requestedSubTab={requestedSubTab}
                  model={model}
                  ownerName={ownerName}
                  onEditIdentity={() => setEditOpen(true)}
                  onCreateOpportunity={openDealModal}
                  onCreateCare={openCareModal}
                  onCreateTask={openTaskModal}
                  onCreateQuickNote={() => setQuickAction("note")}
                  onCompleteTask={completeTask}
                  onOpenSource={openSource}
                  onSelectTab={selectCustomerView}
                  attachments={customerAttachments}
                  onUploadAttachment={(data: RecordAttachmentUploadData) => {
                    setCustomerAttachments((current) => [{
                      id: `customer_attachment_${Date.now()}`,
                      name: data.name,
                      size: data.size || "—",
                      date: new Date().toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US"),
                      category: data.category,
                      description: data.description,
                      file: data.file,
                    }, ...current]);
                    setToastMessage(isVi ? "Tài liệu đã được tải lên." : "Attachment uploaded.");
                  }}
                  onDeleteAttachment={(id) => {
                    setCustomerAttachments((current) => current.filter((item) => item.id !== id));
                    setToastMessage(isVi ? "Tài liệu đã được xóa." : "Attachment removed.");
                  }}
                  onDownloadAttachment={(id) => {
                    const attachment = customerAttachments.find((item) => item.id === id);
                    if (!attachment?.file) {
                      setToastMessage(isVi ? "Tệp này chưa có dữ liệu tải xuống trên thiết bị hiện tại." : "This file is not available on the current device.");
                      return;
                    }
                    const url = URL.createObjectURL(attachment.file);
                    const anchor = document.createElement("a");
                    anchor.href = url;
                    anchor.download = attachment.name;
                    document.body.appendChild(anchor);
                    anchor.click();
                    anchor.remove();
                    window.setTimeout(() => URL.revokeObjectURL(url), 0);
                  }}
                />
                </RecordTabTransition>
              </div>
            </div>
          </main>

          <AnimatePresence initial={false} mode="popLayout">
            {isPanelOpen ? (
              <motion.aside
                layout="position"
                key="customer-flow-panel"
                initial={
                  reduceMotion
                    ? false
                    : { opacity: 0, x: 30, scale: 0.985, filter: "blur(3px)" }
                }
                animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
                exit={
                  reduceMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: 22, scale: 0.99, filter: "blur(2px)" }
                }
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 330, damping: 34, mass: 0.78 }
                }
                className="relative z-10 w-full min-w-0 xl:sticky xl:top-4 xl:h-[calc(100vh-140px)] xl:w-[350px] xl:shrink-0"
              >
                <CustomerInsightPanel
                  model={model}
                  onLogCall={() => setQuickAction("call")}
                  onCreateTask={openTaskModal}
                  onAddMeeting={() => setQuickAction("meeting")}
                  onSendEmail={() => setQuickAction("email")}
                  onSendSms={() => setQuickAction("sms")}
                  onCreateOpportunity={openDealModal}
                  onAddNote={() => setQuickAction("note")}
                  onCreateQuote={() =>
                    navigate(`/quotes/new?customerId=${customer.id}`)
                  }
                  onCreateOrder={() =>
                    navigate(`/orders/new?customerId=${customer.id}`)
                  }
                  onCreateCare={openCareModal}
                  showToast={showToast}
                />
              </motion.aside>
            ) : null}
          </AnimatePresence>
        </div>

      </div>

      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 shadow-2xl animate-fade-in text-left">
          <Sparkles size={14} className="text-indigo-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <CustomerEditModal
        isOpen={editOpen}
        model={model}
        isVi={isVi}
        onClose={() => setEditOpen(false)}
        onSave={saveCustomerProfile}
      />

      <CustomerQuickActivityModal
        action={quickAction}
        isVi={isVi}
        email={model.identity.email}
        phone={model.identity.phone}
        onClose={() => setQuickAction(null)}
        onSave={saveQuickActivity}
      />

      <DealFormModal
        isOpen={dealOpen}
        onClose={() => setDealOpen(false)}
        mode="create"
        initialValues={{
          name: isVi ? `Cơ hội - ${model.identity.displayName}` : `Opportunity - ${model.identity.displayName}`,
          customerName: model.identity.displayName,
          ownerId: defaultOwnerId,
          source: "Customer 360",
        }}
        owners={members.map((member) => ({ memberId: member.memberId, displayName: member.displayName }))}
        stages={getDealStagesSnapshot()}
        customerNameLocked
        onSubmit={createDeal}
      />

      <TaskCreateModal
        isOpen={taskOpen}
        onClose={() => setTaskOpen(false)}
        title={isVi ? "Thêm công việc cho Customer" : "Add Customer task"}
        context={{
          customerId: customer.id,
          relationshipRef: customer.relationshipRef,
          recordRef: { moduleKey: "customers", recordId: customer.id, label: model.identity.displayName },
          sourceRef: { type: "CUSTOMER_360", id: customer.id },
          label: `${customer.customerCode} · ${model.identity.displayName}`,
        }}
        defaults={{ assigneeId: defaultOwnerId }}
        actorId={currentMemberId}
        actorName={currentActorName}
        onCreated={() => {
          selectCustomerView("work");
          showToast(isVi ? "Đã tạo công việc và gán người xử lý." : "Task created and assigned.");
        }}
        onError={() => showToast(isVi ? "Chưa thể tạo công việc." : "Task could not be created.")}
      />

      <ConfirmDialog
        isOpen={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={async () => {
          // `customer.archive` is a BLOCKED canonical command: refuse before the mutation
          // is started instead of failing inside the command boundary.
          if (isCustomerRetentionUnavailable()) {
            setArchiveOpen(false);
            showToast(backendUnavailableMessage({ locale, action: isVi ? "Lưu trữ khách hàng" : "Archiving a customer" }));
            return;
          }
          await archiveCustomerCommand(customer.id, {
            reason: "Archived from Customer 360",
            actorId: currentMemberId ?? "system",
            actorName: currentActorName,
          });
          setArchiveOpen(false);
          showToast(isVi ? "Đã lưu trữ khách hàng." : "Customer archived.");
        }}
        title={isVi ? "Lưu trữ khách hàng?" : "Archive customer?"}
        description={`${customer.customerCode} · ${model.identity.displayName}`}
        confirmText={isVi ? "Lưu trữ" : "Archive"}
        cancelText={isVi ? "Hủy" : "Cancel"}
        type="danger"
      />
    </RecordDetailFrame>
  );
};



function toOptionalBusinessIso(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T09:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function parseOptionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function splitTags(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}
