import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Deal, DealActivity, DealForecastCategory } from "../../domain/model/deal.types";
import { DealStage } from "../../domain/model/deal.types";
import { getStageLabel, getNextStage, isWonStage, isLostStage } from "../../domain/rules/dealStages";
import { validateDealProgressiveProfile } from "../../domain/rules/dealProgressiveProfile";
import { useDeals } from "../hooks/useDeals";
import { useDealStageWindows } from "../hooks/useDealStageWindows";
import { useDealStages } from "../hooks/useDealStages";
import { assertDealDemoImportAllowed, exportDealsSnapshot, isDealStageResetUnavailable } from "../../public/deals";
import { useI18n } from "@/i18n";
import { getContactsSnapshot } from "@/modules/contacts";
import { getOrganizationAccountsSnapshot } from "@/modules/organizations";
import {
  archiveDealCommand,
  closeDealLostCommand,
  createDealCommand,
  reassignDealCommand,
  transitionDealStageCommand,
  updateDealCommand,
  updateDealForecastCommand,
  updateDealNextActionCommand,
} from "../../public/deals";
import { findCustomerByRelationshipRefSnapshot } from "@/modules/customers";
import { getCustomerPresentationRecordSnapshot } from "@/modules/customers";
import { ensureDealNextActionTask, isWorkActivationUnavailable } from "@/workflows/work-activation";
import { notifyProduct, requestConfirmation, requestDecision, requestTextInput } from "@/components/feedback/ProductDialogService";
import { CAPABILITIES } from "@/platform/access-control";
import { filterRuntimeRecordsByOwnership, useRecordOwnershipContext, type OwnershipScopeView } from "@/platform/record-ownership";
import { mapSelectedPickerItemsToDealLineItems, type DealFormDraft } from "../components/DealFormModal";
import { createCreateCommandTarget, createDurableId } from "@/shared/ids";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { backendUnavailableMessage, describePartialCommit, executeSequentialCommits, formatApplicationError } from "@/shared/operations";

export function useDealPipelineController() {

  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active View Mode
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const defaultView: "kanban" | "table" = isMobile ? "table" : "kanban";
  const requestedView = searchParams.get("view");
  const viewMode: "kanban" | "table" = requestedView === "kanban" || requestedView === "table"
    ? requestedView
    : defaultView;
  const { deals, setDeals, query: collectionQuery } = useDeals({ loadAuthoritative: viewMode !== "kanban" });
  const ownership = useRecordOwnershipContext("deals", CAPABILITIES.DEALS_ASSIGN);
  const [ownershipScope, setOwnershipScope] = useState<OwnershipScopeView>("ALLOWED");
  /**
   * Kanban card order is a presentation preference, not business data: `DealReadModel`
   * has no ordering field and no command persists one, so drag order must never be
   * written to the Deal repository. It is held here and applied on top of the
   * authoritative collection, which stays the single source of truth for Deal.stage.
   */
  const [kanbanCardOrder, setKanbanCardOrder] = useState<readonly string[]>([]);
  const orderedDeals = useMemo(() => {
    if (kanbanCardOrder.length === 0) return deals;
    const rank = new Map(kanbanCardOrder.map((dealId, index) => [dealId, index]));
    // Array.prototype.sort is stable, so deals without an explicit rank keep the
    // authoritative order among themselves.
    return [...deals].sort((left, right) => (
      (rank.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(right.id) ?? Number.MAX_SAFE_INTEGER)
    ));
  }, [deals, kanbanCardOrder]);
  const scopedDeals = useMemo(
    () => filterRuntimeRecordsByOwnership("deals", CAPABILITIES.DEALS_ASSIGN, orderedDeals, ownershipScope),
    [orderedDeals, ownershipScope, ownership?.workspaceId, ownership?.memberId, ownership?.dataScope],
  );
  const ownershipScopeCounts = useMemo(() => ({
    MINE: filterRuntimeRecordsByOwnership("deals", CAPABILITIES.DEALS_ASSIGN, deals, "MINE").length,
    TEAM: filterRuntimeRecordsByOwnership("deals", CAPABILITIES.DEALS_ASSIGN, deals, "TEAM").length,
    ALLOWED: filterRuntimeRecordsByOwnership("deals", CAPABILITIES.DEALS_ASSIGN, deals, "ALLOWED").length,
  }), [deals, ownership?.workspaceId, ownership?.memberId, ownership?.dataScope]);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [dateStatusFilter, setDateStatusFilter] = useState("all"); // "all", "overdue", "month"
  const [minAmountFilter, setMinAmountFilter] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("all");

  // Create Deal Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDealName, setNewDealName] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCloseDate, setNewCloseDate] = useState("");
  const [newOwnerId, setNewOwnerId] = useState("");
  const [newNextActionAt, setNewNextActionAt] = useState("");
  const [newNextActionSummary, setNewNextActionSummary] = useState("");
  const [newForecastCategory, setNewForecastCategory] = useState<DealForecastCategory>("PIPELINE");

  // List controls
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
  const [moreActionsAnchor, setMoreActionsAnchor] = useState<HTMLElement | null>(null);

  // Stage configuration is owned by the Deal module repository.
  const { stageConfigs, setStageConfigs, resetStageConfigs } = useDealStages();
  const activeStageCodes = useMemo(
    () => stageConfigs.filter((stage) => stage.isActive).sort((left, right) => left.order - right.order).map((stage) => stage.code),
    [stageConfigs],
  );
  const stageWindowQuery = useDealStageWindows({
    enabled: viewMode === "kanban",
    stages: activeStageCodes,
    search: searchTerm,
    ownerId: ownerFilter,
    stageFilter,
    closeDateStatus: dateStatusFilter,
    minimumAmount: currencyFilter !== "all" ? Number(minAmountFilter) || undefined : undefined,
    currency: currencyFilter,
    ownershipScope,
  });
  const query = viewMode === "kanban" && stageWindowQuery.connected ? stageWindowQuery : collectionQuery;

  // Creation Stage custom values
  const [newDealStage, setNewDealStage] = useState("");
  const [newOpportunityScore, setNewOpportunityScore] = useState("40");
  const [newNotes, setNewNotes] = useState("");

  // Edit Opportunity Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);

  // Active column action overlay track
  const [activeActionsDealId, setActiveActionsDealId] = useState<string | null>(null);

  // One canonical stage-advance path prevents duplicate clicks and stale stage transitions.
  const advancingDealIdsRef = React.useRef<Set<string>>(new Set());
  const [advancingDealIds, setAdvancingDealIds] = useState<ReadonlySet<string>>(() => new Set());

  // Kanban Drag & Drop States
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggedOverStage, setDraggedOverStage] = useState<string | null>(null);
  const [draggedOverCardId, setDraggedOverCardId] = useState<string | null>(null);

  // Auto-fill initial values for New Deal form when opened
  useEffect(() => {
    if (isAddModalOpen) {
      const activeConfigs = stageConfigs.filter(s => s.isActive && s.category === "open").sort((a,b) => a.order - b.order);
      if (activeConfigs.length > 0) {
        setNewDealStage(activeConfigs[0].code);
        setNewOpportunityScore(String(activeConfigs[0].probabilityDefault));
      } else {
        setNewDealStage(DealStage.DISCOVERY);
        setNewOpportunityScore("40");
      }
      setNewNotes("");
      setNewNextActionAt("");
      setNewNextActionSummary("");
      setNewForecastCategory("PIPELINE");
      setNewCloseDate("");
      setNewOwnerId((current) => {
        const allowed = ownership?.assignableOwners.some((owner) => owner.memberId === current);
        return allowed ? current : (ownership?.memberId || "");
      });
    }
  }, [isAddModalOpen, ownership?.memberId, ownership?.assignableOwners, stageConfigs]);

  const setViewMode = (mode: "kanban" | "table") => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("view", mode);
      return next;
    }, { replace: true });
  };

  const handleDropCard = async (draggedId: string, targetStage: string, targetCardId?: string) => {
    const targetConfig = stageConfigs.find((stage) => stage.code === targetStage);
    if (targetConfig?.category === "won" || targetConfig?.category === "lost") {
      const decision = await requestDecision({
        title: locale === "vi" ? "Cập nhật kết quả cơ hội" : "Update opportunity outcome",
        message: locale === "vi"
          ? "Giai đoạn kết thúc chỉ được cập nhật qua hành động Thắng hoặc Thua để ghi nhận đầy đủ bằng chứng và kế hoạch chăm sóc tiếp theo."
          : "Terminal stages can only be updated through Won or Lost actions so evidence and follow-up decisions are recorded.",
        tone: "warning",
        actions: [
          { id: "back", label: locale === "vi" ? "Quay lại" : "Go back", variant: "secondary" },
          { id: "lost", label: locale === "vi" ? "Đánh dấu Thua" : "Mark Lost", variant: "danger" },
          { id: "won", label: locale === "vi" ? "Đánh dấu Thắng" : "Mark Won", variant: "success" },
        ],
      });
      const deal = deals.find((item) => item.id === draggedId);
      if (deal && decision === "won") handleMarkWonDirect(deal);
      if (deal && decision === "lost") void handleMarkLostDirect(deal);
      return;
    }

    const moved = (await transitionDealStageCommand(draggedId, targetStage)).data;
    if (!moved) return;

    // `moved` carries the authoritative stage, already projected from the command
    // response by transitionDealStageCommand. Only the visual order is decided here, and
    // it is presentation state: dropping on a card inserts before that card, dropping on
    // the open column body appends to the target stage.
    setKanbanCardOrder((current) => {
      const base = current.length > 0 ? current : deals.map((deal) => deal.id);
      if (!base.includes(draggedId)) return current;
      const stageOf = (dealId: string) => (
        dealId === draggedId ? targetStage : deals.find((deal) => deal.id === dealId)?.stage
      );
      const others = base.filter((dealId) => dealId !== draggedId);
      const explicitTargetIndex = targetCardId ? others.indexOf(targetCardId) : -1;
      const targetIndex = explicitTargetIndex >= 0
        ? explicitTargetIndex
        : others.reduce(
          (lastIndex, dealId, index) => stageOf(dealId) === targetStage ? index + 1 : lastIndex,
          others.length,
        );
      const result = [...others];
      result.splice(targetIndex, 0, draggedId);
      return result;
    });
  };

  const getDealStageLabel = (stage: string | DealStage) => {
    return getStageLabel(stage, stageConfigs, locale);
  };

  // Helper: Overdue Detection
  const isOverdue = (expectedCloseDate: string, stage: string | DealStage) => {
    if (isWonStage(stage, stageConfigs) || isLostStage(stage, stageConfigs)) return false;
    if (!expectedCloseDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const closeDate = new Date(expectedCloseDate);
    closeDate.setHours(0, 0, 0, 0);
    return closeDate < today;
  };

  // Helper: Closing This Month Detection
  const isClosingThisMonth = (expectedCloseDate: string) => {
    if (!expectedCloseDate) return false;
    const today = new Date();
    const closeDate = new Date(expectedCloseDate);
    return closeDate.getFullYear() === today.getFullYear() && closeDate.getMonth() === today.getMonth();
  };

  const getNextDealStage = (stage: string | DealStage): string | null => getNextStage(stage, stageConfigs);
  const isDealAdvancing = (dealId: string) => advancingDealIds.has(dealId);

  const advanceDealStage = async (dealId: string) => {
    if (advancingDealIdsRef.current.has(dealId)) return;

    const deal = deals.find((item) => item.id === dealId);
    if (!deal) {
      notifyProduct(locale === "vi" ? "Không tìm thấy cơ hội để cập nhật." : "The opportunity could not be found.", "danger");
      return;
    }

    const nextStage = getNextDealStage(deal.stage);
    if (!nextStage) return;

    advancingDealIdsRef.current.add(dealId);
    setAdvancingDealIds((current) => new Set(current).add(dealId));
    try {
      const now = new Date().toISOString();
      const activity: DealActivity = {
        id: createDurableId("deal_activity_stage"),
        type: "stage",
        title: t("deals.activities.stageChangedTitle"),
        description: t("deals.activities.stageChangedDescription", {
          from: getDealStageLabel(deal.stage),
          to: getDealStageLabel(nextStage),
        }),
        createdAt: now,
        author: t("common.system"),
        metadata: { fromStage: deal.stage, toStage: nextStage },
      };
      await transitionDealStageCommand(deal.id, nextStage, activity);
    } catch {
      notifyProduct(
        locale === "vi" ? "Không thể chuyển cơ hội sang giai đoạn tiếp theo. Vui lòng thử lại." : "The opportunity could not advance to the next stage. Please try again.",
        "danger",
      );
    } finally {
      advancingDealIdsRef.current.delete(dealId);
      setAdvancingDealIds((current) => {
        const next = new Set(current);
        next.delete(dealId);
        return next;
      });
    }
  };

  // Add Deal action
  const handleAddDealSubmit = async (form: DealFormDraft) => {
    const normalizedName = form.customerName.trim().toLowerCase();
    const organization = getOrganizationAccountsSnapshot().find((account) =>
      [account.displayName, account.legalName].some((name) => name?.trim().toLowerCase() === normalizedName),
    );
    const contact = getContactsSnapshot().find((item) =>
      [item.fullName, item.name].some((name) => name?.trim().toLowerCase() === normalizedName),
    );
    const buyerRef = organization
      ? { type: "ORGANIZATION_ACCOUNT" as const, id: organization.id }
      : contact
        ? { type: "CONTACT" as const, id: contact.id }
        : undefined;
    const customer = buyerRef ? findCustomerByRelationshipRefSnapshot(buyerRef) : undefined;
    const customerDisplay = customer ? getCustomerPresentationRecordSnapshot(customer.id) : undefined;
    const relationship = buyerRef
      ? {
          buyerRef,
          organizationAccountId: organization?.id,
          organizationAccountName: organization?.displayName,
          contactId: contact?.id,
          contactName: contact?.fullName,
          customerId: customer?.id,
          customerName: customerDisplay?.displayName,
        }
      : undefined;

    if (!relationship) {
      await requestDecision({
        title: locale === "vi" ? "Chưa thể tạo cơ hội" : "Opportunity cannot be created",
        message: locale === "vi" ? "Không tìm thấy người liên hệ hoặc doanh nghiệp phù hợp. Hãy liên kết khách hàng trước khi tạo cơ hội." : "No matching contact or organization was found. Link the customer before creating the opportunity.",
        tone: "warning",
        actions: [{ id: "back", label: locale === "vi" ? "Quay lại biểu mẫu" : "Back to form", variant: "secondary" }],
      });
      return;
    }

    const selectedStage = stageConfigs.find((stage) => stage.code === form.stage);
    if (selectedStage?.category === "won" || selectedStage?.category === "lost") {
      await requestDecision({
        title: locale === "vi" ? "Chọn giai đoạn đang mở" : "Choose an open stage",
        message: locale === "vi" ? "Không thể tạo cơ hội trực tiếp ở giai đoạn kết thúc." : "An opportunity cannot be created directly in a terminal stage.",
        tone: "warning",
        actions: [{ id: "back", label: locale === "vi" ? "Chọn lại giai đoạn" : "Choose stage", variant: "secondary" }],
      });
      return;
    }

    const now = new Date().toISOString();
    const nextActionAt = form.createFollowUpTask && form.nextActionAt
      ? new Date(form.nextActionAt).toISOString()
      : undefined;
    // WF-21 work-activation is BLOCKED with `connectedFrontendCoordinatorAllowed: false`.
    // The Deal command and `task.create` are both ready, so nothing else would stop this
    // from committing the Deal and only then failing to activate the requested work.
    // Refuse the whole action up front rather than silently degrading "Deal + follow-up
    // work" into "Deal only" — that would turn a two-part user intent into partial success.
    if (nextActionAt && isWorkActivationUnavailable()) {
      notifyProduct(
        locale === "vi"
          ? "Chưa thể tạo cơ hội kèm công việc kế tiếp: máy chủ chưa hỗ trợ kích hoạt công việc. Hãy bỏ chọn công việc theo dõi để chỉ tạo cơ hội."
          : "An opportunity with a follow-up task cannot be created yet: work activation is not supported by the server. Clear the follow-up task to create the opportunity only.",
        "warning",
      );
      return;
    }
    const validationDraft = {
      name: form.name,
      buyerRef: relationship.buyerRef,
      ownerId: form.ownerId,
      amount: form.amount,
      expectedCloseDate: form.expectedCloseDate,
      nextActionAt,
      nextActionSummary: form.createFollowUpTask ? form.nextActionSummary : undefined,
      forecastCategory: form.forecastCategory,
      stage: form.stage,
    } satisfies Partial<Deal>;
    const missingFields = validateDealProgressiveProfile(validationDraft, form.stage, "QUICK");
    if (missingFields.length > 0) {
      await requestDecision({
        title: t("deals.quickCreate.validationTitle"),
        message: t("deals.quickCreate.validation", { fields: missingFields.join(", ") }),
        tone: "warning",
        actions: [{ id: "back", label: locale === "vi" ? "Quay lại biểu mẫu" : "Back to form", variant: "secondary" }],
      });
      return;
    }

    const lineItems = mapSelectedPickerItemsToDealLineItems(form.lineItems);
    const dealId = createCreateCommandTarget("deal");
    const createdOutcome = await createDealCommand({
      id: dealId,
      name: form.name,
      ...relationship,
      stage: form.stage || DealStage.DISCOVERY,
      amount: form.amount,
      currency: form.currency,
      opportunityScore: form.probability,
      ownerId: form.ownerId || ownership?.memberId || "unassigned",
      notes: [form.demandSummary, form.painPoints, form.notes].filter(Boolean).join(" · ") || undefined,
      expectedCloseDate: form.expectedCloseDate,
      forecastCategory: form.forecastCategory,
      // The Task id is server-assigned, and the next-action Task is only created after
      // this Deal command commits, so no Task reference is known here. A deterministic
      // client key must not be persisted as `nextActionTaskId`; the schedule is carried
      // by `nextActionAt`/`nextActionSummary` and the Task references this Deal through
      // its own `recordRef`/`sourceRef`.
      ...(nextActionAt ? {
        nextActionAt,
        nextActionSummary: form.nextActionSummary,
      } : {}),
      createdAt: now,
      updatedAt: now,
      interestedProducts: form.lineItems.map((item) => item.product.id),
      lineItems,
      activities: [{
        id: createDurableId("deal_activity_created"),
        type: "system",
        title: t("deals.activities.createdTitle"),
        description: t("deals.activities.createdDescription", { deal: form.name }),
        createdAt: now,
        author: t("common.system"),
      }],
    });
    const created = createdOutcome.data;
    // Deal is already committed. Task activation is a separate authoritative command
    // (no atomic Deal+Task backend workflow exists), so a failure here must be
    // reported instead of being swallowed into a "created successfully" message.
    if (nextActionAt) {
      try {
        await ensureDealNextActionTask(created);
      } catch (error) {
        notifyProduct(
          locale === "vi"
            ? `Đã tạo cơ hội nhưng chưa tạo được công việc kế tiếp: ${formatApplicationError(error, { locale })}`
            : `Opportunity created, but its next-action Task was not created: ${formatApplicationError(error, { locale })}`,
          "danger",
          { actionLabel: locale === "vi" ? "Mở chi tiết" : "Open record", onAction: () => navigate(`/deals/${created.id}`), durationMs: 10000 },
        );
        setIsAddModalOpen(false);
        return;
      }
    }
    const ownerName = ownership?.visibleOwners.find((owner) => owner.memberId === created.ownerId)?.displayName || created.ownerId;
    notifyProduct(
      locale === "vi" ? `Đã tạo cơ hội và giao cho ${ownerName}.` : `Opportunity created and assigned to ${ownerName}.`,
      "success",
      { actionLabel: locale === "vi" ? "Mở chi tiết" : "Open record", onAction: () => navigate(`/deals/${created.id}`), durationMs: 6000 },
    );
    setIsAddModalOpen(false);
  };

  // Edit Opportunity Modal Action Open
  const handleOpenEditModal = (deal: Deal) => {
    setEditingDeal(deal);
    setIsEditModalOpen(true);
  };

  // Save changes to opportunity
  const handleEditDealSubmit = async (form: DealFormDraft) => {
    if (!editingDeal) return;
    const nextActionAt = form.createFollowUpTask && form.nextActionAt
      ? new Date(form.nextActionAt).toISOString()
      : undefined;
    // WF-21 work-activation is BLOCKED and coordinator-forbidden. This handler commits the
    // profile and forecast commands before it reaches the next-action step, so the refusal
    // has to happen here — before the first Deal mutation — for the activation request to
    // cost nothing.
    if (nextActionAt && isWorkActivationUnavailable()) {
      notifyProduct(
        locale === "vi"
          ? "Chưa thể cập nhật cơ hội kèm công việc kế tiếp: máy chủ chưa hỗ trợ kích hoạt công việc. Hãy bỏ chọn công việc theo dõi để lưu các thay đổi còn lại."
          : "This opportunity cannot be updated with a follow-up task yet: work activation is not supported by the server. Clear the follow-up task to save the remaining changes.",
        "warning",
      );
      return;
    }
    const editDraft = {
      ...editingDeal,
      name: form.name,
      ownerId: form.ownerId,
      amount: form.amount,
      expectedCloseDate: form.expectedCloseDate,
      nextActionAt,
      nextActionSummary: form.createFollowUpTask ? form.nextActionSummary : undefined,
      forecastCategory: form.forecastCategory,
      stage: form.stage,
    } satisfies Partial<Deal>;
    const missingEditFields = validateDealProgressiveProfile(editDraft, form.stage, "COMPLETE");
    if (missingEditFields.length > 0) {
      await requestDecision({
        title: t("deals.quickCreate.validationTitle"),
        message: t("deals.quickCreate.validation", { fields: missingEditFields.join(", ") }),
        tone: "warning",
        actions: [{ id: "back", label: locale === "vi" ? "Quay lại chỉnh sửa" : "Back to editing", variant: "secondary" }],
      });
      return;
    }

    const targetStage = stageConfigs.find((stage) => stage.code === form.stage);
    if (targetStage?.category === "won" || targetStage?.category === "lost") {
      await requestDecision({
        title: locale === "vi" ? "Cập nhật kết quả bằng hành động riêng" : "Use an outcome action",
        message: locale === "vi" ? "Để kết thúc cơ hội, hãy dùng hành động Đánh dấu Thắng hoặc Đánh dấu Thua." : "Use Mark Won or Mark Lost to close the opportunity.",
        tone: "warning",
        actions: [{ id: "back", label: locale === "vi" ? "Quay lại chỉnh sửa" : "Back to editing", variant: "secondary" }],
      });
      return;
    }

    let handoverReason: string | null = null;
    const ownerChanged = editingDeal.ownerId !== form.ownerId;
    if (ownerChanged) {
      if (!ownership?.canAssign) {
        notifyProduct(locale === "vi" ? "Bạn không có quyền bàn giao cơ hội." : "You do not have permission to reassign opportunities.", "danger");
        return;
      }
      handoverReason = await requestTextInput({
        title: locale === "vi" ? "Lý do bàn giao cơ hội" : "Opportunity handover reason",
        description: locale === "vi" ? "Thay đổi người sở hữu được ghi vào lịch sử trách nhiệm." : "Ownership changes are recorded in the responsibility history.",
        label: locale === "vi" ? "Lý do" : "Reason",
        placeholder: locale === "vi" ? "Ví dụ: chuyển theo khu vực phụ trách" : "For example: reassigned by territory",
        submitLabel: locale === "vi" ? "Bàn giao" : "Reassign",
        cancelLabel: locale === "vi" ? "Giữ người hiện tại" : "Keep current owner",
        requiredMessage: locale === "vi" ? "Hãy nhập lý do bàn giao." : "Enter a handover reason.",
      });
      if (!handoverReason) return;
    }

    const stageChanged = editingDeal.stage !== form.stage;
    const lineItems = mapSelectedPickerItemsToDealLineItems(form.lineItems);
    // No backend operation updates profile, forecast, next action, ownership and stage
    // together, so this is several authoritative commands. An earlier one can commit and a
    // later one fail; the committed work stays committed on the server, so it is reported
    // rather than discarded. Nothing here reverses a committed command.
    const report = await executeSequentialCommits([
      {
        step: "profile",
        run: () => updateDealCommand(editingDeal.id, {
          name: form.name,
          amount: form.amount,
          currency: form.currency,
          notes: [form.demandSummary, form.painPoints, form.notes].filter(Boolean).join(" · ") || undefined,
          interestedProducts: form.lineItems.map((item) => item.product.id),
          lineItems,
          ...(!form.createFollowUpTask ? {
            nextActionAt: undefined,
            nextActionSummary: undefined,
            nextActionRef: undefined,
          } : {}),
          updatedAt: new Date().toISOString(),
        }),
      },
      {
        step: "forecast",
        run: () => updateDealForecastCommand(editingDeal.id, {
          expectedCloseDate: form.expectedCloseDate,
          opportunityScore: form.probability,
          forecastCategory: form.forecastCategory,
          actor: ownership?.displayName,
        }),
      },
      // `taskId` is omitted deliberately: the Task id is server-assigned, so there is no
      // authoritative Task reference to send. A deterministic client key here would persist
      // a Task foreign reference that matches no Task.
      ...(nextActionAt ? [{
        step: "nextAction",
        run: () => updateDealNextActionCommand(editingDeal.id, {
          nextActionAt,
          nextActionSummary: form.nextActionSummary,
        }),
      }, {
        // WF-21. Unreachable in connected mode (the guard above returns first); demo owns
        // its own activation, and a failure there is now a reported partial outcome rather
        // than a special case.
        step: "activation",
        run: () => ensureDealNextActionTask({ ...editingDeal, nextActionAt, nextActionSummary: form.nextActionSummary }),
      }] : []),
      ...(ownerChanged && handoverReason ? [{
        step: "owner",
        run: () => reassignDealCommand(editingDeal.id, {
          ownerId: form.ownerId,
          reason: handoverReason,
          activity: {
            id: createDurableId("deal_activity_owner"),
            type: "system" as const,
            title: locale === "vi" ? "Bàn giao cơ hội" : "Opportunity handover",
            description: `${locale === "vi" ? "Lý do" : "Reason"}: ${handoverReason}`,
            createdAt: new Date().toISOString(),
            author: ownership?.displayName || t("common.system"),
          },
        }),
      }] : []),
      ...(stageChanged ? [{
        step: "stage",
        run: () => transitionDealStageCommand(editingDeal.id, form.stage, {
          id: createDurableId("deal_activity_stage"),
          type: "stage" as const,
          title: t("deals.activities.stageChangedTitle"),
          description: t("deals.activities.stageChangedDescription", { from: getDealStageLabel(editingDeal.stage), to: getDealStageLabel(form.stage) }),
          createdAt: new Date().toISOString(),
          author: t("common.system"),
          metadata: { fromStage: editingDeal.stage, toStage: form.stage },
        }),
      }] : []),
    ]);

    if (report.status !== "FULL_SUCCESS") {
      const stepLabels: Record<string, { vi: string; en: string }> = {
        profile: { vi: "Thông tin cơ hội", en: "The opportunity details" },
        forecast: { vi: "Dự báo", en: "The forecast" },
        nextAction: { vi: "Hành động kế tiếp", en: "The next action" },
        activation: { vi: "Công việc kế tiếp", en: "The follow-up task" },
        owner: { vi: "Bàn giao người phụ trách", en: "The handover" },
        stage: { vi: "Giai đoạn", en: "The stage change" },
      };
      const describe = (keys: readonly string[]) => keys
        .map((key) => (locale === "vi" ? stepLabels[key]?.vi : stepLabels[key]?.en) ?? key)
        .join(", ");
      const failureText = formatApplicationError(report.error, { locale });
      if (report.status === "PARTIAL_SUCCESS") {
        const summary = describePartialCommit(
          report,
          {
            committed: describe(report.committed.map((entry) => entry.step)),
            failed: describe(report.failedStep === undefined ? [] : [report.failedStep]),
          },
          locale,
        );
        notifyProduct(`${summary} ${failureText}`, "danger", {
          actionLabel: locale === "vi" ? "Mở chi tiết" : "Open record",
          onAction: () => navigate(`/deals/${editingDeal.id}`),
          durationMs: 10000,
        });
      } else {
        notifyProduct(failureText, "danger");
      }
      // Whatever committed is authoritative and the local projection is now stale. The
      // commands already project their own authoritative results; the modal stays open so
      // the user can retry only what failed.
      return;
    }

    setIsEditModalOpen(false);
    setEditingDeal(null);
  };

  // Clone opportunity
  const handleDuplicateDeal = async (deal: Deal) => {
    const copySuffix = t("opportunities.copySuffix", "Copy");
    const duplicated: Deal = {
      ...deal,
      id: createCreateCommandTarget("deal"),
      name: `${deal.name} (${copySuffix})`,
      ownerId: ownership?.memberId || deal.ownerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stageEnteredAt: new Date().toISOString(),
      forecastHistory: [],
      activities: [
        {
          id: createDurableId("deal_activity_created"),
          type: "system",
          title: t("deals.activities.createdTitle"),
          description: t("deals.activities.createdDescription", { deal: `${deal.name} (Copy)` }),
          createdAt: new Date().toISOString(),
          author: t("common.system")
        },
        ...(deal.activities || [])
      ]
    };
    const created = (await createDealCommand(duplicated)).data;
    const ownerName = ownership?.visibleOwners.find((owner) => owner.memberId === created.ownerId)?.displayName || created.ownerId;
    notifyProduct(
      locale === "vi" ? `Đã nhân bản cơ hội và giao cho ${ownerName}.` : `Opportunity duplicated and assigned to ${ownerName}.`,
      "success",
      { actionLabel: locale === "vi" ? "Mở chi tiết" : "Open record", onAction: () => navigate(`/deals/${created.id}`), durationMs: 6000 },
    );
  };

  // Delete opportunity
  const handleDeleteDeal = async (dealId: string) => {
    const confirmed = await requestConfirmation({
      title: locale === "vi" ? "Xóa cơ hội?" : "Delete opportunity?",
      message: t("opportunities.confirmDelete", (locale === "vi" ? "Cơ hội sẽ bị xóa khỏi danh sách. Hành động này không thể hoàn tác." : "The opportunity will be removed. This action cannot be undone.")),
      confirmLabel: locale === "vi" ? "Xóa cơ hội" : "Delete opportunity",
      cancelLabel: locale === "vi" ? "Giữ cơ hội" : "Keep opportunity",
      tone: "danger",
    });
    if (!confirmed) return;
    const session = getAuthSessionSnapshot();
    if (!session) {
      notifyProduct(locale === "vi" ? "Phiên đăng nhập không còn hợp lệ." : "The authenticated session is no longer available.", "danger");
      return;
    }
    try {
      await archiveDealCommand(dealId, {
        reason: locale === "vi" ? "Người dùng lưu trữ cơ hội từ danh sách." : "User archived the opportunity from the pipeline.",
        actorId: session.principal.memberId,
        actorName: session.principal.displayName,
      });
      notifyProduct(locale === "vi" ? "Đã lưu trữ cơ hội." : "Opportunity archived.", "success");
    } catch (error) {
      notifyProduct(formatApplicationError(error, { locale }), "danger");
    }
  };

  // Mark Won rapidly. Canonical WON requires commercial commitment evidence.
  const handleMarkWonDirect = async (_deal: Deal) => {
    await requestDecision({
      title: locale === "vi" ? "Chưa đủ điều kiện đánh dấu Thắng" : "Cannot mark as Won yet",
      message: locale === "vi" ? "Cơ hội chỉ được đánh dấu Thắng khi có báo giá đã được chấp nhận hoặc đơn hàng đã xác nhận. Hãy hoàn tất cam kết thương mại trước." : "An opportunity can only be marked Won when a quote is accepted or an order is confirmed. Complete the commercial commitment first.",
      tone: "warning",
      actions: [{ id: "back", label: locale === "vi" ? "Quay lại cơ hội" : "Back to opportunity", variant: "secondary" }],
    });
  };

  // Mark Lost with an explicit recycle decision.
  const handleMarkLostDirect = async (deal: Deal) => {
    const reason = await requestTextInput({
      title: locale === "vi" ? "Đánh dấu cơ hội Thua" : "Mark opportunity as Lost",
      description: locale === "vi" ? "Ghi rõ lý do để đội bán hàng có thể phân tích và cải thiện các cơ hội tiếp theo." : "Record the reason so the sales team can analyze and improve future opportunities.",
      label: t("deals.lostModal.reasonLabel", (locale === "vi" ? "Lý do thua" : "Loss reason")),
      placeholder: locale === "vi" ? "Ví dụ: Ngân sách chưa được phê duyệt" : "For example: Budget was not approved",
      submitLabel: locale === "vi" ? "Tiếp tục" : "Continue",
      cancelLabel: locale === "vi" ? "Quay lại" : "Go back",
      requiredMessage: locale === "vi" ? "Hãy nhập lý do thua." : "Enter a loss reason.",
    });
    if (!reason) return;
    const recycle = await requestConfirmation({
      title: locale === "vi" ? "Lập kế hoạch chăm sóc lại?" : "Plan future follow-up?",
      message: locale === "vi" ? "Đưa cơ hội này vào kế hoạch chăm sóc lại sau 30 ngày?" : "Add this opportunity to a follow-up plan in 30 days?",
      confirmLabel: locale === "vi" ? "Chăm sóc lại" : "Plan follow-up",
      cancelLabel: locale === "vi" ? "Không chăm sóc lại" : "No follow-up",
      tone: "info",
    });
    const revisitAt = recycle
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : undefined;
    const occurredAt = new Date().toISOString();
    await closeDealLostCommand(deal.id, {
      reason: reason.trim(),
      recycleDecision: recycle ? "RECYCLE" : "DO_NOT_RECYCLE",
      revisitAt,
      occurredAt,
    }, {
      id: createDurableId("deal_activity_lost"),
      type: "lost",
      title: t("deals.activities.markedLostTitle"),
      description: t("deals.activities.markedLostDescription", { deal: deal.name, reason: reason.trim() }),
      createdAt: occurredAt,
      author: t("common.system"),
      metadata: { toStage: DealStage.LOST, lostReason: reason.trim() },
    });
  };

  // Browser-specific export lives in infrastructure.
  const handleExportCSV = () => {
    try {
      exportDealsSnapshot(`unicore_deals_${locale === "vi" ? "vi" : "en"}.csv`, filteredDeals, [
      { key: "id", label: "ID", value: (deal) => deal.id },
      { key: "name", label: locale === "vi" ? "Tên cơ hội" : "Name", value: (deal) => deal.name },
      { key: "customer", label: locale === "vi" ? "Khách hàng" : "Customer", value: (deal) => deal.customerName ?? "" },
      { key: "amount", label: locale === "vi" ? "Giá trị" : "Amount", value: (deal) => deal.amount },
      { key: "stage", label: locale === "vi" ? "Giai đoạn" : "Stage", value: (deal) => getDealStageLabel(deal.stage) },
      { key: "closeDate", label: locale === "vi" ? "Ngày chốt dự kiến" : "Close date", value: (deal) => deal.expectedCloseDate },
      { key: "owner", label: locale === "vi" ? "Người phụ trách" : "Owner", value: (deal) => ownership?.visibleOwners.find((owner) => owner.memberId === deal.ownerId)?.displayName || deal.ownerId },
        { key: "score", label: locale === "vi" ? "Điểm (%)" : "Score (%)", value: (deal) => deal.opportunityScore },
      ]);
    } catch (error) {
      notifyProduct(formatApplicationError(error, { locale }), "warning");
    }
  };

  // Dynamic dummy upload representation. Imported rows still resolve to real buyer identities.
  const handleImportDummyLeads = async () => {
    try {
      assertDealDemoImportAllowed();
    } catch (error) {
      notifyProduct(formatApplicationError(error, { locale }), "warning");
      return;
    }
    const accounts = getOrganizationAccountsSnapshot();
    const buyers = accounts.slice(0, 2);
    if (buyers.length < 2) {
      await requestDecision({
        title: locale === "vi" ? "Chưa thể nhập cơ hội" : "Opportunities cannot be imported",
        message: locale === "vi" ? "Cần ít nhất hai doanh nghiệp để liên kết dữ liệu nhập. Hãy tạo thêm doanh nghiệp rồi thử lại." : "At least two organizations are required to link the imported data. Create more organizations and try again.",
        tone: "warning",
        actions: [{ id: "back", label: locale === "vi" ? "Quay lại" : "Go back", variant: "secondary" }],
      });
      return;
    }
    const now = new Date().toISOString();
    const makeImportedDeal = (index: number, stage: DealStage, amount: number, daysToClose: number): Deal => {
      const buyer = buyers[index];
      return {
        id: createCreateCommandTarget("deal"),
        name: index === 0
          ? (locale === "vi" ? "Hợp đồng Triển khai ERP" : "ERP Implementation Contract")
          : (locale === "vi" ? "Cung cấp Thiết bị IoT" : "IoT Hardware Supply"),
        buyerRef: { type: "ORGANIZATION_ACCOUNT", id: buyer.id },
        customerId: findCustomerByRelationshipRefSnapshot({ type: "ORGANIZATION_ACCOUNT", id: buyer.id })?.id,
        customerName: buyer.displayName,
        stage,
        amount,
        opportunityScore: index === 0 ? 50 : 70,
        ownerId: ownership?.memberId || "unassigned",
        expectedCloseDate: new Date(Date.now() + daysToClose * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        nextActionAt: new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
        nextActionSummary: locale === "vi" ? "Xác nhận nhu cầu và bước tiếp theo" : "Confirm need and next step",
        nextActionRef: { type: "MANUAL" },
        createdAt: now,
        updatedAt: now,
        interestedProducts: [],
        lineItems: [],
        activities: [],
      };
    };
    const tempDeal1 = makeImportedDeal(0, DealStage.DISCOVERY, 450000000, 45);
    const tempDeal2 = makeImportedDeal(1, DealStage.QUALIFIED, 180000000, 15);
    await createDealCommand(tempDeal2);
    await createDealCommand(tempDeal1);
    notifyProduct(locale === "vi" ? "Đã nhập 2 cơ hội mới từ tệp." : "2 new opportunities were imported from the file.", "success");
  };

  // Restore default stage configuration through the module repository.
  const handleResetStageConfigs = async () => {
    // Stage configuration has no backend reset contract, so connected mode refuses before the
    // confirmation dialog instead of throwing out of the handler afterwards.
    if (isDealStageResetUnavailable()) {
      notifyProduct(backendUnavailableMessage({
        locale,
        action: locale === "vi" ? "Khôi phục giai đoạn mặc định" : "Restoring the default stages",
      }), "warning");
      return;
    }
    const confirmed = await requestConfirmation({
      title: locale === "vi" ? "Khôi phục giai đoạn mặc định?" : "Restore default stages?",
      message: locale === "vi" ? "Thiết lập giai đoạn hiện tại sẽ được thay thế bằng cấu hình mặc định. Các thay đổi tùy chỉnh sẽ bị mất." : "Current stage settings will be replaced by the default configuration. Custom changes will be lost.",
      confirmLabel: locale === "vi" ? "Khôi phục mặc định" : "Restore defaults",
      cancelLabel: locale === "vi" ? "Giữ thiết lập hiện tại" : "Keep current settings",
      tone: "warning",
    });
    if (confirmed) setStageConfigs(resetStageConfigs());
  };

  // Filter Logic Applied
  const filteredDeals = scopedDeals.filter(deal => {
    // Search Filter
    const matchesSearch =
      deal.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (deal.customerName ?? "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (deal.contactName && deal.contactName.toLowerCase().includes(searchTerm.toLowerCase()));

    // Owner Filter
    const matchesOwner = ownerFilter === "all" || deal.ownerId === ownerFilter;

    // Stage Filter
    const matchesStage = stageFilter === "all" || deal.stage === stageFilter;

    // Expected Close status filter
    let matchesDateStatus = true;
    if (dateStatusFilter === "overdue") {
      matchesDateStatus = isOverdue(deal.expectedCloseDate, deal.stage);
    } else if (dateStatusFilter === "month") {
      matchesDateStatus = isClosingThisMonth(deal.expectedCloseDate);
    }

    // Min Amount Filter
    const minVal = parseFloat(minAmountFilter) || 0;
    const matchesCurrency = currencyFilter === "all" || (deal.currency || "VND") === currencyFilter;
    const matchesAmount = !minAmountFilter || (currencyFilter !== "all" && deal.amount >= minVal);

    return !!(matchesSearch && matchesOwner && matchesStage && matchesDateStatus && matchesCurrency && matchesAmount);
  });

  const pipelineStages = activeStageCodes;

  // Active filter metric
  const activeFilterCount = [
    ownerFilter !== "all",
    stageFilter !== "all",
    dateStatusFilter !== "all",
    currencyFilter !== "all",
    !!minAmountFilter
  ].filter(Boolean).length;

  return {
    deals,
    query,
    stageWindowQuery,
    ownership,
    ownershipScope,
    setOwnershipScope,
    ownershipScopeCounts,
    navigate,
    t,
    locale,
    viewMode,
    searchTerm,
    setSearchTerm,
    ownerFilter,
    setOwnerFilter,
    stageFilter,
    setStageFilter,
    dateStatusFilter,
    setDateStatusFilter,
    minAmountFilter,
    setMinAmountFilter,
    currencyFilter,
    setCurrencyFilter,
    isAddModalOpen,
    setIsAddModalOpen,
    newDealName,
    newCustomerName,
    newAmount,
    newCloseDate,
    newOwnerId,
    newNextActionAt,
    newNextActionSummary,
    newForecastCategory,
    isFilterOpen,
    setIsFilterOpen,
    isMoreActionsOpen,
    setIsMoreActionsOpen,
    moreActionsAnchor,
    setMoreActionsAnchor,
    stageConfigs,
    newDealStage,
    newOpportunityScore,
    newNotes,
    isEditModalOpen,
    setIsEditModalOpen,
    editingDeal,
    setEditingDeal,
    activeActionsDealId,
    setActiveActionsDealId,
    draggingId,
    setDraggingId,
    draggedOverStage,
    setDraggedOverStage,
    draggedOverCardId,
    setDraggedOverCardId,
    setViewMode,
    handleDropCard,
    getDealStageLabel,
    isOverdue,
    getNextDealStage,
    isDealAdvancing,
    advanceDealStage,
    handleAddDealSubmit,
    handleOpenEditModal,
    handleEditDealSubmit,
    handleDuplicateDeal,
    handleDeleteDeal,
    handleMarkWonDirect,
    handleMarkLostDirect,
    handleExportCSV,
    handleImportDummyLeads,
    handleResetStageConfigs,
    filteredDeals,
    pipelineStages,
    activeFilterCount,
  };
}
