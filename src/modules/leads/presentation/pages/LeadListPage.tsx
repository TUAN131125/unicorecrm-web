import { AuthoritativeQueryBoundary, formatApplicationError } from "@/shared/operations";
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { Archive, Plus, CheckCircle2, Target, ArrowUpRight, UserPlus, RefreshCw, Tag, Sliders, Printer, FileSpreadsheet } from "lucide-react";
import { normalizeApplicationError, type CRMActivity } from "@/shared/domain";
import type { Lead, LeadSource, LeadCampaign } from "../../domain/model/lead.types";
import { getRetainedLeadsSnapshot, isLeadOperationAvailable, LEAD_OPERATION, replaceLeads } from "../../public/leads";
import { LeadWorkState } from "../../domain/model/leadLifecycle.canonical";

import { useI18n } from "@/i18n";
import { ConfirmDialog, Modal, Select, Textarea } from "@/shared/components/ui";

// Modular Lead feature components
import { LeadSavedViewSelector } from "../components/LeadSavedViewSelector";
import { LeadColumnSettingsDrawer } from "../components/LeadColumnSettingsDrawer";
import { LeadFilterPopover } from "../components/LeadFilterPopover";
import { LeadStatisticsModal } from "../components/LeadStatisticsModal";
import { LeadDisqualifyModal } from "../components/LeadDisqualifyModal";
import { LeadArchiveConfirmationModal } from "../components/LeadArchiveConfirmationModal";
import { LeadFollowUpModal } from "../components/LeadFollowUpModal";
import { LeadManageTagsModal } from "../components/LeadManageTagsModal";
import { LeadAddViewModal } from "../components/LeadAddViewModal";
import { LeadTransitionRequirementsModal, type LeadTransitionProfileInput } from "../components/lead-transition/LeadTransitionRequirementsModal";
import { ActionDropdown, ActionDropdownSection } from "@/components/crm/ActionDropdown";
import { PageHeaderActions, PageHeaderMoreButton } from "@/components/crm/PageHeaderActions";
import { ListBulkActionBar, ListPageFrame, ListPageHeader, ListToolbar } from "@/components/crm/list-archetype";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { filterRuntimeRecordsByOwnership, useRecordOwnershipContext } from "@/platform/record-ownership";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";

// Custom hooks
import { useLeadFilters, LeadFiltersState, INITIAL_LEAD_FILTERS, DEFAULT_LEAD_SORT } from "../hooks/useLeadFilters";
import { useLeadSelection } from "../hooks/useLeadSelection";
import { useLeadSavedViews, LeadSavedView } from "../hooks/useLeadSavedViews";
import type { LeadListPresentationSnapshot } from "../model/leadSavedViewPreferences";
import { evaluateLeadContactPolicy, getLeadContactPolicyMessage, LeadContactChannel } from "../../domain/rules/leadContactPolicy";
import { useLeadTable, DEFAULT_VISIBLE_COLUMNS } from "../hooks/useLeadTable";
import { useLeadImportExport } from "../hooks/useLeadImportExport";
import { useLeadDialogs } from "../hooks/useLeadDialogs";
import { useLeads } from "../hooks/useLeads";
import { useLeadActions } from "../hooks/useLeadActions";
import { useLeadServerPagedCollection } from "../hooks/useLeadServerPagedCollection";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { useLeadReferenceData } from "../hooks/useLeadReferenceData";
import { useLeadPagination } from "../hooks/useLeadPagination";
import { LeadListResults } from "../components/LeadListResults";
import type { LeadKanbanDropTarget } from "../components/LeadKanbanBoard";
import { getConfiguredLeadProfileBlockers } from "../../application/policies/leadProgressiveProfilePolicyRuntime";


const LeadForm = React.lazy(() => import("@/components/LeadForm").then((module) => ({ default: module.LeadForm })));
const LeadImportDialog = React.lazy(() => import("../components/LeadImportDialog").then((module) => ({ default: module.LeadImportDialog })));
const LeadBulkUpdateModal = React.lazy(() => import("../components/LeadBulkUpdateModal").then((module) => ({ default: module.LeadBulkUpdateModal })));

const DEFAULT_LEAD_SAVED_VIEW_SNAPSHOT: LeadListPresentationSnapshot = {
  version: 1,
  searchTerm: "",
  filters: INITIAL_LEAD_FILTERS,
  sort: DEFAULT_LEAD_SORT,
  orderedColumnIds: [...DEFAULT_VISIBLE_COLUMNS],
  layout: "table",
  ownershipScope: "ALLOWED",
};
interface LeadListPageProps {
  globalSearchTerm?: string;
  sources?: LeadSource[];
  campaigns?: LeadCampaign[];
}

export const LeadListPage: React.FC<LeadListPageProps> = ({
  globalSearchTerm = "",
  sources = [],
  campaigns = []
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, locale } = useI18n();
  const viewMode = searchParams.get("view") === "kanban" ? "kanban" : "table";
  const { leads, query: fullCollectionQuery } = useLeads({ loadAuthoritative: viewMode === "kanban" });
  const leadActions = useLeadActions();
  const referenceData = useLeadReferenceData(sources, campaigns);
  const access = useEffectiveAccess();
  const canCreateLeads = access.can(CAPABILITIES.LEADS_CREATE);
  const canExportLeads = access.can(CAPABILITIES.LEADS_EXPORT);
  const canBulkLeads = access.can(CAPABILITIES.LEADS_BULK);
  const canUpdateLeads = access.can(CAPABILITIES.LEADS_UPDATE);
  const canQualifyLeads = access.can(CAPABILITIES.LEADS_QUALIFY);
  const ownership = useRecordOwnershipContext("leads", CAPABILITIES.LEADS_ASSIGN);
  const workspace = useWorkspaceContextSnapshot();
  // Record scope is selected through the saved-view menu (All / Mine / My team).
  // Keep the base data set at the complete allowed scope so the duplicated scope
  // selector does not compete with the view and layout controls.
  const scopedLeads = useMemo(
    () => filterRuntimeRecordsByOwnership("leads", CAPABILITIES.LEADS_ASSIGN, leads, "ALLOWED"),
    [leads, ownership?.workspaceId, ownership?.memberId, ownership?.dataScope],
  );

  // View mode management
  const setViewMode = (newMode: "table" | "kanban") => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("view", newMode);
    setSearchParams(nextParams, { replace: true });
  };

  const getReturnToUrl = (mode: "table" | "kanban") => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("view", mode);
    return `${location.pathname}?${nextParams.toString()}`;
  };

  // Toast management
  const [toast, setToast] = useState<{ message: string; actionLabel?: string; onAction?: () => void } | null>(null);
  const [verificationLeadId, setVerificationLeadId] = useState<string | null>(null);
  const [showStatistics, setShowStatistics] = useState(false);
  const [archivePending, setArchivePending] = useState(false);
  const archiveSubmittingRef = React.useRef(false);
  const showToast = (message: string) => {
    setToast({ message });
    window.setTimeout(() => setToast(null), 3500);
  };
  const showActionToast = (message: string, actionLabel: string, onAction: () => void) => {
    setToast({ message, actionLabel, onAction });
    window.setTimeout(() => setToast(null), 6000);
  };

  // 1. Saved Views Custom Hook
  const savedViews = useLeadSavedViews(DEFAULT_LEAD_SAVED_VIEW_SNAPSHOT);

  // 2. Filters Custom Hook
  const filters = useLeadFilters(scopedLeads, savedViews.activeView, ownership);
  useEffect(() => {
    if (globalSearchTerm) filters.setSearchTerm(globalSearchTerm);
  }, [globalSearchTerm]);
  const leadServerQuery = useMemo(() => {
    const stateFromFilter = Object.values(LeadWorkState).includes(filters.filters.status as LeadWorkState)
      ? filters.filters.status as LeadWorkState
      : filters.filters.status ? LeadWorkState.CLOSED : undefined;
    const stateFromView = savedViews.activeView === "new"
      ? LeadWorkState.NEW
      : savedViews.activeView === "contacted"
        ? LeadWorkState.CONTACTING
        : savedViews.activeView === "qualified"
          ? LeadWorkState.VERIFYING
          : undefined;
    const ownerId = filters.filters.ownerId
      || (savedViews.activeView === "my_leads" ? ownership?.memberId : undefined);
    return {
      ...(filters.searchTerm.trim() ? { search: filters.searchTerm.trim() } : {}),
      ...((stateFromFilter ?? stateFromView) ? { filters: {
        workState: stateFromFilter ?? stateFromView,
        ...(ownerId ? { ownerId } : {}),
      } } : ownerId ? { filters: { ownerId } } : {}),
    };
  }, [filters.filters.ownerId, filters.filters.status, filters.searchTerm, ownership?.memberId, savedViews.activeView]);
  const serverPagination = useLeadServerPagedCollection({
    scopeKey: workspace.workspaceId,
    enabled: viewMode === "table",
    query: leadServerQuery,
    initialPageSize: 50,
    project: projectServerLeadPage,
    evictProjection: clearLeadProjection,
  });
  const canArchiveLeads = isLeadOperationAvailable(LEAD_OPERATION.ARCHIVE)
    && access.can(CAPABILITIES.LEADS_DELETE);
  const canAssignLeadBatch = Boolean(ownership?.canAssign)
    && isLeadOperationAvailable(LEAD_OPERATION.ASSIGN_OWNER_BATCH);
  const canAdvanceLeadBatch = canBulkLeads
    && isLeadOperationAvailable(LEAD_OPERATION.ADVANCE_WORK_STATE_BATCH);
  const canDisqualifyLeadBatch = canBulkLeads
    && isLeadOperationAvailable(LEAD_OPERATION.DISQUALIFY_BATCH);
  const canTagLeadBatch = canBulkLeads
    && isLeadOperationAvailable(LEAD_OPERATION.APPLY_TAG_BATCH);
  const canScheduleLeadBatch = canBulkLeads
    && isLeadOperationAvailable(LEAD_OPERATION.SCHEDULE_FOLLOW_UP_BATCH);
  const canArchiveLeadBatch = access.can(CAPABILITIES.LEADS_DELETE)
    && isLeadOperationAvailable(LEAD_OPERATION.ARCHIVE_BATCH);
  const serverPageLeadIds = useMemo(
    () => new Set(serverPagination.items.map((lead) => lead.id)),
    [serverPagination.items],
  );
  const serverPageItems = useMemo(
    () => filters.filteredLeads.filter((lead) => serverPageLeadIds.has(lead.id)),
    [filters.filteredLeads, serverPageLeadIds],
  );
  const localPagination = useLeadPagination(filters.filteredLeads, 50);
  const pagination = serverPagination.connected && viewMode === "table"
    ? {
        page: serverPagination.page,
        setPage: serverPagination.setPage,
        pageSize: serverPagination.pageSize,
        setPageSize: serverPagination.setPageSize,
        pageCount: serverPagination.pageCount,
        pageItems: serverPageItems,
        rangeStart: serverPagination.rangeStart,
        rangeEnd: serverPagination.rangeEnd,
        totalItems: serverPagination.totalItems,
        canGoPrevious: serverPagination.canGoPrevious,
        canGoNext: serverPagination.canGoNext,
      }
    : localPagination;
  const leadQuery = viewMode === "table" ? serverPagination : fullCollectionQuery;
  const previousViewModeRef = React.useRef(viewMode);
  useEffect(() => {
    const previousViewMode = previousViewModeRef.current;
    previousViewModeRef.current = viewMode;
    if (previousViewMode !== "kanban" && viewMode === "kanban" && fullCollectionQuery.state !== "IDLE") {
      void fullCollectionQuery.refresh();
    }
  }, [fullCollectionQuery.refresh, fullCollectionQuery.state, viewMode]);

  // 3. Selection Custom Hook
  const selection = useLeadSelection();

  // 4. Table Custom Hook
  const table = useLeadTable(showToast, t);

  const captureSavedViewSnapshot = (): LeadListPresentationSnapshot => ({
    version: 1,
    searchTerm: filters.searchTerm,
    filters: structuredClone(filters.filters),
    sort: structuredClone(filters.sort),
    orderedColumnIds: [...table.visibleColumns],
    layout: viewMode,
    ownershipScope: "ALLOWED",
  });

  const handleSelectSavedView = (key: string) => {
    const snapshot = savedViews.selectSavedView(key);
    selection.clearSelection();
    if (!snapshot) {
      filters.resetFilters();
      return;
    }
    filters.setSearchTerm(snapshot.searchTerm);
    filters.setFilters(structuredClone(snapshot.filters));
    filters.setSort(structuredClone(snapshot.sort));
    table.applyVisibleColumns(snapshot.orderedColumnIds);
    setViewMode(snapshot.layout);
  };

  const handleSaveView = (name: string) => {
    const result = savedViews.saveView(name, captureSavedViewSnapshot());
    if ("error" in result) {
      const message = result.error === "duplicate"
        ? (locale === "vi" ? "Tên giao diện đã tồn tại." : "A saved view with this name already exists.")
        : (locale === "vi" ? "Hãy nhập tên giao diện hợp lệ." : "Enter a valid saved-view name.");
      showToast(message);
      return;
    }
    showToast(result.mode === "created"
      ? (locale === "vi" ? `Đã lưu giao diện "${name}".` : `Saved view "${name}".`)
      : (locale === "vi" ? `Đã cập nhật giao diện "${name}".` : `Updated view "${name}".`));
  };

  const handleDeleteSavedView = (key: string) => {
    const wasActive = savedViews.activeView === key;
    if (!savedViews.deleteCustomView(key)) return;
    if (wasActive) filters.resetFilters();
    showToast(locale === "vi" ? "Đã xóa giao diện đã lưu." : "Saved view deleted.");
  };

  // 5. Import/Export Custom Hook
  const importExport = useLeadImportExport(
    scopedLeads,
    selection.selectedLeadIds,
    selection.clearSelection,
    showToast,
    locale,
  );

  // 7. Dialogs Custom Hook
  const dialogs = useLeadDialogs(selection.selectedLeadIds, showToast, locale, ownership?.memberId || "");
  const closeNewLeadModal = React.useCallback(() => dialogs.setIsNewLeadOpen(false), [dialogs.setIsNewLeadOpen]);
  const newLeadUnsavedChanges = useUnsavedChangesGuard(closeNewLeadModal);
  const openNewLeadModal = React.useCallback(() => {
    newLeadUnsavedChanges.setIsDirty(false);
    dialogs.setIsNewLeadOpen(true);
  }, [dialogs.setIsNewLeadOpen, newLeadUnsavedChanges.setIsDirty]);
  useEffect(() => {
    if (!dialogs.isNewLeadOpen) {
      newLeadUnsavedChanges.setIsDirty(false);
      newLeadUnsavedChanges.setIsConfirmOpen(false);
    }
  }, [dialogs.isNewLeadOpen, newLeadUnsavedChanges.setIsConfirmOpen, newLeadUnsavedChanges.setIsDirty]);

  // Helper helper to bulk update individual filters
  const setFilterValue = (key: keyof LeadFiltersState, value: any) => {
    filters.setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Single Action: Reopen Lead
  const handleReopenLead = async (leadId: string) => {
    const newActivity: CRMActivity = {
      id: `act_reopen_${Date.now()}_${leadId}`,
      icon: "unlock",
      title: locale === "vi" ? "Mở lại khách hàng tiềm năng" : "Lead Reopened",
      description: locale === "vi"
        ? "Khách hàng tiềm năng được đưa về bước Đang liên hệ để tiếp tục xác minh."
        : "Lead returned to Contacting for a new verification cycle.",
      createdAt: t("common.justNow"),
      author: t("common.system"),
      type: "system",
    };
    await leadActions.reopen(leadId, newActivity);
    showToast(t("leads.reopen.success"));
  };

  // Close dropdowns on outside click or Escape key
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("#header-more-btn") && !target.closest("#header-more-menu")) {
        dialogs.setIsHeaderMoreOpen(false);
      }
      if (!target.closest(".row-more-btn") && !target.closest(".row-more-menu")) {
        dialogs.setOpenRowActionId(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dialogs.setIsHeaderMoreOpen(false);
        dialogs.setOpenRowActionId(null);
      }
    };

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dialogs]);

  // handle action from URL parameter (?action=create)
  useEffect(() => {
    if (searchParams.get("action") === "create") {
      openNewLeadModal();
    }
  }, [openNewLeadModal, searchParams]);

  // Dynamic Actions
  const handleBulkAdvanceToVerifying = async () => {
    try {
      const eligibleIds = selection.selectedLeadIds.filter((leadId) => leads.some((lead) => lead.id === leadId && lead.leadWorkState === LeadWorkState.CONTACTING));
      await leadActions.advanceEligibleToVerifying(eligibleIds);
      const advancedCount = eligibleIds.length;
      if (advancedCount === 0) {
        showToast(locale === "vi"
          ? "Chỉ khách hàng tiềm năng ở bước Đang liên hệ mới có thể chuyển sang Xác minh."
          : "Only Leads in Contacting can move to Verifying.");
        return;
      }
      selection.clearSelection();
      showToast(locale === "vi"
        ? `Đã chuyển ${advancedCount} Lead sang bước Đang xác minh.`
        : `Moved ${advancedCount} Leads to Verifying.`);
    } catch (error) {
      showToast(formatApplicationError(error, { locale }));
    }
  };

  const handleBulkUpdateConfirm = async (data: { status: string }) => {
    try {
      const targetIds = data.status === LeadWorkState.CONTACTING
        ? selection.selectedLeadIds.filter((leadId) => leads.some((lead) => lead.id === leadId && lead.leadWorkState === LeadWorkState.NEW))
        : data.status === LeadWorkState.VERIFYING
          ? selection.selectedLeadIds.filter((leadId) => leads.some((lead) => lead.id === leadId && lead.leadWorkState === LeadWorkState.CONTACTING))
          : [];
      const updated = data.status === LeadWorkState.CONTACTING
        ? await leadActions.advanceNewToContacting(targetIds)
        : await leadActions.advanceEligibleToVerifying(targetIds);
      const updatedCount = updated.length;
      dialogs.setIsBulkUpdateOpen(false);
      selection.clearSelection();
      showToast(locale === "vi"
        ? `Đã chuyển ${updatedCount} Lead theo lifecycle hợp lệ.`
        : `Moved ${updatedCount} Leads through valid lifecycle transitions.`);
    } catch (error) {
      showToast(formatApplicationError(error, { locale }));
    }
  };

  // Executing modals
  const handleDisqualifyConfirm = async (data: {
    reason: string;
    note: string;
    needRecontact: boolean;
    recontactDate?: string;
    recontactNote?: string;
  }): Promise<boolean> => {
    const targetIds = dialogs.disqualifyLeadId ? [dialogs.disqualifyLeadId] : selection.selectedLeadIds;
    if (targetIds.length === 0) return false;

    if (data.needRecontact) {
      showToast(locale === "vi" ? "Trường hợp cần tiếp tục chăm sóc phải chọn kết quả Chăm sóc, không chọn Không phù hợp." : "Future re-engagement belongs to NURTURE, not DISQUALIFIED.");
      return false;
    }
    const evidence = data.note.trim() || undefined;

    try {
      if (targetIds.length === 1) {
        await leadActions.disqualify(targetIds[0]!, { reason: data.reason, evidence });
      } else {
        await leadActions.disqualifyMany(targetIds, { reason: data.reason, evidence });
      }

      dialogs.setIsDisqualifyModalOpen(false);
      dialogs.setDisqualifyLeadId(null);
      selection.clearSelection();
      showToast(t("leads.bulkDisqualifiedSuccess"));
      return true;
    } catch (error) {
      const applicationError = normalizeApplicationError(error);
      if (applicationError.code === "VERSION_CONFLICT" || applicationError.code === "LEAD_BATCH_VERSION_CONFLICT") {
        void leadQuery.refresh().catch(() => undefined);
      }
      showToast(formatApplicationError(applicationError, { locale }));
      return false;
    }
  };

  const handleFollowUpConfirm = async (data: {
    date: string;
    note: string;
  }) => {
    try {
      const targetIds = dialogs.followUpLeadId ? [dialogs.followUpLeadId] : selection.selectedLeadIds;
      if (targetIds.length === 0) return;

      const activeTargetIds = targetIds.filter((leadId) => leads.some((lead) => lead.id === leadId && lead.leadWorkState !== LeadWorkState.CLOSED));
      const parsedFollowUpAt = Date.parse(data.date);
      if (!Number.isFinite(parsedFollowUpAt)) {
        throw new Error("LEAD_FOLLOW_UP_DATE_INVALID");
      }
      const note = data.note.trim() || (locale === "vi" ? "Liên hệ lại theo lịch đã chọn." : "Follow up at the selected time.");
      await leadActions.scheduleFollowUpMany(activeTargetIds, {
        followUpAt: new Date(parsedFollowUpAt).toISOString(),
        note,
      });

      dialogs.setIsFollowUpModalOpen(false);
      dialogs.setFollowUpLeadId(null);
      selection.clearSelection();
      showToast(t("leads.followUp.success"));
    } catch (error) {
      showToast(formatApplicationError(error, { locale }));
    }
  };

  // Bulk action triggers
  const handleBulkMarkContacted = async () => {
    try {
      const updated = await leadActions.advanceNewToContacting(selection.selectedLeadIds);
      selection.clearSelection();
      showToast(locale === "vi" ? `Đã chuyển ${updated.length} Lead sang Đang liên hệ.` : `Moved ${updated.length} Leads to Contacting.`);
    } catch (error) {
      showToast(formatApplicationError(error, { locale }));
    }
  };

  const executeBulkReassign = async () => {
    if (!ownership?.canAssign) {
      showToast(locale === "vi" ? "Bạn không có quyền bàn giao khách hàng tiềm năng." : "You do not have permission to reassign Leads.");
      return;
    }
    if (!dialogs.selectedReassignOwnerId || !dialogs.reassignReason.trim()) {
      showToast(locale === "vi" ? "Hãy chọn người nhận và nhập lý do bàn giao." : "Select the new owner and enter a handover reason.");
      return;
    }
    await leadActions.reassignMany(selection.selectedLeadIds, {
      ownerId: dialogs.selectedReassignOwnerId,
      reason: dialogs.reassignReason,
    });
    selection.clearSelection();
    dialogs.setIsReassignModalOpen(false);
    showToast(t("leads.reassignedAlert"));
  };

  // Manual creation delegates server-owned IDs, timestamps, lifecycle and audit evidence to the active Lead runtime.
  const handleCreateLeadFromForm = async (formData: Partial<Lead>) => {
    const saved = await leadActions.createFromForm(formData);
    const ownerName = ownership?.visibleOwners.find((owner) => owner.memberId === saved.ownerId)?.displayName
      || (locale === "vi" ? "người phụ trách hiện tại" : "the current owner");
    dialogs.setIsNewLeadOpen(false);
    showActionToast(
      locale === "vi" ? `Đã tạo Lead và giao cho ${ownerName}.` : `Lead created and assigned to ${ownerName}.`,
      locale === "vi" ? "Mở chi tiết" : "Open record",
      () => navigate(`/leads/${saved.id}`, { state: { returnTo: getReturnToUrl(viewMode), tab: "overview" } }),
    );
  };

  const getLeadHeaderMoreDropdownSections = (): ActionDropdownSection[] => [
    {
      id: "bulk-actions",
      title: t("leads.actions.bulk"),
      items: [
        ...(canAssignLeadBatch ? [{
          id: "bulk-handover",
          label: `${t("leads.actions.handover")} ${selection.selectedLeadIds.length > 0 ? `(${selection.selectedLeadIds.length})` : ""}`,
          icon: <UserPlus size={14} />,
          disabled: selection.selectedLeadIds.length === 0,
          onClick: dialogs.handleBulkReassign,
        }] : []),
        ...(canAdvanceLeadBatch ? [
          {
            id: "bulk-update",
            label: `${t("leads.actions.bulkUpdate")} ${selection.selectedLeadIds.length > 0 ? `(${selection.selectedLeadIds.length})` : ""}`,
            icon: <Sliders size={14} />,
            disabled: selection.selectedLeadIds.length === 0,
            onClick: () => {
              dialogs.setBulkUpdateStatus("");
              dialogs.setBulkUpdateOwner("");
              dialogs.setIsBulkUpdateOpen(true);
            },
          },
          {
            id: "bulk-verify",
            label: `${locale === "vi" ? "Bắt đầu xác minh" : "Start verifying"} ${selection.selectedLeadIds.length > 0 ? `(${selection.selectedLeadIds.length})` : ""}`,
            icon: <ArrowUpRight size={14} />,
            disabled: selection.selectedLeadIds.length === 0,
            onClick: handleBulkAdvanceToVerifying,
          },
        ] : []),
        ...(canTagLeadBatch ? [{
          id: "manage-tags",
          label: locale === "vi" ? "Gắn nhãn cho khách hàng tiềm năng đã chọn" : "Tag selected Leads",
          icon: <Tag size={14} />,
          disabled: selection.selectedLeadIds.length === 0,
          onClick: () => dialogs.setIsManageTagsModalOpen(true),
        }] : []),
        ...(canArchiveLeadBatch ? [{
          id: "bulk-archive",
          label: `${t("leads.actions.bulkArchive", "Lưu trữ")} ${selection.selectedLeadIds.length > 0 ? `(${selection.selectedLeadIds.length})` : ""}`,
          icon: <Archive size={14} />,
          destructive: true,
          disabled: selection.selectedLeadIds.length === 0,
          onClick: () => {
            dialogs.setLeadToArchive(null);
            dialogs.setShowArchiveConfirm(true);
          },
        }] : []),
      ],
    },
    ...(canCreateLeads && canBulkLeads && isLeadOperationAvailable(LEAD_OPERATION.IMPORT_BATCH) ? [{
      id: "import",
      title: locale === "vi" ? "Nhập dữ liệu" : "Import",
      items: [{
        id: "import-csv",
        label: locale === "vi" ? "Nhập khách hàng tiềm năng từ CSV" : "Import Leads from CSV",
        icon: <FileSpreadsheet size={14} className="text-violet-600" />,
        onClick: () => dialogs.setIsImportOpen(true),
      }],
    }] : []),
    {
      id: "presentation",
      title: locale === "vi" ? "Trình bày" : "Presentation",
      items: [
        {
          id: "print-list",
          label: t("leads.actions.printList"),
          icon: <Printer size={14} />,
          onClick: () => window.print(),
        },
        ...(canExportLeads && isLeadOperationAvailable(LEAD_OPERATION.REQUEST_EXPORT) ? [{
          id: "export-all",
          label: t("leads.actions.exportAll"),
          icon: <FileSpreadsheet size={14} className="text-emerald-600" />,
          onClick: importExport.handleBulkExport,
        }] : []),
      ],
    },
  ];

  const runLifecycleAction = async (action: () => Promise<unknown>, successVi: string, successEn: string) => {
    try {
      await action();
      showToast(locale === "vi" ? successVi : successEn);
    } catch (error) {
      showToast(formatApplicationError(error, { locale }));
    }
  };

  const handleMarkContacted = (leadId: string) => runLifecycleAction(
    () => leadActions.changeWorkState(leadId, LeadWorkState.CONTACTING),
    "Đã chuyển Lead sang Đang liên hệ.",
    "Lead moved to Contacting.",
  );

  const requestStartVerifying = (leadId: string) => {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead) return;
    const blockers = getConfiguredLeadProfileBlockers(lead, LeadWorkState.VERIFYING);
    if (blockers.length > 0) {
      setVerificationLeadId(leadId);
      return;
    }
    runLifecycleAction(
      () => leadActions.startVerification(leadId),
      "Đã chuyển khách hàng tiềm năng sang Đang xác minh.",
      "Lead moved to Verifying.",
    );
  };

  const handleStartVerifying = (leadId: string) => requestStartVerifying(leadId);

  const handleVerificationReadinessConfirm = async (input: LeadTransitionProfileInput) => {
    if (!verificationLeadId) return;
    try {
      await leadActions.startVerification(verificationLeadId, input);
      setVerificationLeadId(null);
      showToast(locale === "vi" ? "Đã chuyển khách hàng tiềm năng sang Đang xác minh." : "Lead moved to Verifying.");
    } catch (error) {
      showToast(formatApplicationError(error, { locale }));
    }
  };

  const handleKanbanMove = (leadId: string, target: LeadKanbanDropTarget) => {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead) return;

    if (target === "POSITIVE_OUTCOME") {
      if (lead.leadWorkState !== LeadWorkState.VERIFYING) {
        showToast(locale === "vi"
          ? "Khách hàng tiềm năng phải ở bước Đang xác minh trước khi chốt kết quả."
          : "The Lead must be Verifying before an outcome can be committed.");
        return;
      }
      navigate(`/leads/${leadId}/qualify`);
      return;
    }

    if (lead.leadWorkState === target) return;
    if (target === LeadWorkState.VERIFYING) {
      requestStartVerifying(leadId);
      return;
    }
    if (target !== LeadWorkState.CONTACTING) {
      showToast(locale === "vi"
        ? "Không thể chuyển Lead về trạng thái trước đó."
        : "This Lead cannot be moved to a previous state.");
      return;
    }

    runLifecycleAction(
      () => leadActions.changeWorkState(leadId, target),
      target === LeadWorkState.CONTACTING
        ? "Đã chuyển Lead sang Đang liên hệ."
        : "Đã cập nhật trạng thái Lead.",
      target === LeadWorkState.CONTACTING
        ? "Lead moved to Contacting."
        : "Lead status updated.",
    );
  };

  const handleLeadCall = (lead: Lead) => {
    const decision = evaluateLeadContactPolicy(lead, LeadContactChannel.CALL);
    if (!decision.allowed || !lead.phone) {
      showToast(getLeadContactPolicyMessage(decision.reason, locale));
      return;
    }
    const dialLink = document.createElement("a");
    dialLink.href = `tel:${lead.phone}`;
    dialLink.click();
    showToast(locale === "vi" ? "Đã mở ứng dụng gọi điện trên thiết bị." : "Opened the device dialer.");
  };

  const handleRefresh = () => {
    void leadQuery.refresh();
  };

  const handleArchiveConfirm = async () => {
    if (archiveSubmittingRef.current) return;
    const targetIds = dialogs.leadToArchive ? [dialogs.leadToArchive] : selection.selectedLeadIds;
    if (targetIds.length === 0) return;

    archiveSubmittingRef.current = true;
    setArchivePending(true);
    try {
      if (dialogs.leadToArchive) {
        await leadActions.archive(dialogs.leadToArchive);
        showToast(t("leads.archive.success", "Đã lưu trữ Lead; hồ sơ và lịch sử vẫn được giữ lại."));
      } else {
        await leadActions.archiveMany(selection.selectedLeadIds);
        selection.clearSelection();
        showToast(t("leads.bulkArchiveSuccess", "Đã lưu trữ các Lead đã chọn."));
      }
      dialogs.setShowArchiveConfirm(false);
      dialogs.setLeadToArchive(null);
    } catch (error) {
      const applicationError = normalizeApplicationError(error);
      if (applicationError.code === "VERSION_CONFLICT" || applicationError.code === "LEAD_BATCH_VERSION_CONFLICT") {
        void leadQuery.refresh().catch(() => undefined);
      }
      showToast(formatApplicationError(applicationError, { locale }));
    } finally {
      archiveSubmittingRef.current = false;
      setArchivePending(false);
    }
  };

  const closeArchiveModal = () => {
    if (archiveSubmittingRef.current) return;
    dialogs.setShowArchiveConfirm(false);
    dialogs.setLeadToArchive(null);
  };

  const closeDisqualifyModal = () => {
    dialogs.setIsDisqualifyModalOpen(false);
    dialogs.setDisqualifyLeadId(null);
  };

  const translateOrFallback = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const getMisaViewLabel = (v: LeadSavedView) => {
    if (v.key.startsWith("custom_")) {
      return v.labelKey;
    }

    const normalizedLabelKey = v.labelKey
      .replace(/^leads\.customViews\.views\./, "")
      .replace(/^leads\.customViews\./, "");
    return translateOrFallback(`leads.customViews.${normalizedLabelKey}`, normalizedLabelKey);
  };

  return (
    <ListPageFrame id="lead-list-page">

      {/* PAGE HEADER */}
      <ListPageHeader
        title={t("sidebar.leads", "Leads")}
        count={serverPagination.connected && viewMode === "table" ? serverPagination.totalItems : filters.filteredLeads.length}
        context={locale === "vi" ? "Hàng đợi xác minh khách hàng tiềm năng" : "Lead qualification queue"}
        icon={<Target size={18} />}
        actions={
          <PageHeaderActions
            actions={canCreateLeads ? [
              {
                id: "add-lead",
                label: t("leads.addLead"),
                icon: <Plus size={14} />,
                onClick: openNewLeadModal,
                variant: "primary",
              },
            ] : []}
            moreActions={
              <div>
                <PageHeaderMoreButton
                  id="header-more-btn"
                  active={dialogs.isHeaderMoreOpen}
                  onClick={(e) => {
                    dialogs.setHeaderMoreAnchorEl(e.currentTarget);
                    dialogs.setIsHeaderMoreOpen(!dialogs.isHeaderMoreOpen);
                  }}
                  title={locale === "vi" ? "Thêm thao tác" : "More Actions"}
                />
                {dialogs.isHeaderMoreOpen && (
                  <ActionDropdown
                    isOpen={dialogs.isHeaderMoreOpen}
                    anchorRef={dialogs.headerMoreAnchorEl}
                    onClose={() => {
                      dialogs.setIsHeaderMoreOpen(false);
                      dialogs.setHeaderMoreAnchorEl(null);
                    }}
                    sections={getLeadHeaderMoreDropdownSections()}
                    width={256}
                  />
                )}
              </div>
            }
          />
        }
      />

      {/* 2. DYNAMIC LEAD TOOLBAR WITH SAVED VIEWS DROPDOWN AND SEARCH */}
      <ListToolbar
        searchValue={filters.searchTerm}
        onSearchChange={filters.setSearchTerm}
        searchPlaceholder={t("leads.quickSearchPlaceholder", locale === "vi" ? "Tìm kiếm thông minh..." : "Smart search...")}
        viewMode={viewMode}
        onViewModeChange={(val) => setViewMode(val as "table" | "kanban")}
        viewOptions={[
          { value: "table" as const, label: locale === "vi" ? "Danh sách" : "List view" },
          { value: "kanban" as const, label: "Kanban" }
        ]}
        showFilters={true}
        onOpenFilters={() => dialogs.setIsFilterOpen(!dialogs.isFilterOpen)}
        onCloseFilters={() => dialogs.setIsFilterOpen(false)}
        filtersOpen={dialogs.isFilterOpen}
        showColumns={true}
        onOpenColumns={() => table.setIsColumnSettingsOpen(true)}
        showStats={true}
        onOpenStats={() => setShowStatistics(true)}
        statsLabel={locale === "vi" ? "Thống kê" : "Statistics"}
        activeFilterCount={filters.activeFiltersCount}
        hasActiveFilters={filters.hasActiveFilters}
        filtersLabel={t("leads.filterPanel.title", locale === "vi" ? "Bộ lọc" : "Filters")}
        columnsLabel={locale === "vi" ? "Cột" : "Columns"}
        filtersPanel={(
          <LeadFilterPopover
            isOpen={dialogs.isFilterOpen}
            onClose={() => dialogs.setIsFilterOpen(false)}
            owners={referenceData.members}
            sources={referenceData.sources}
            campaigns={referenceData.campaigns}
            sort={filters.sort}
            setSort={filters.setSort}
            filterStatus={filters.filters.status}
            setFilterStatus={(val) => setFilterValue("status", val)}
            filterOwner={filters.filters.ownerId}
            setFilterOwner={(val) => setFilterValue("ownerId", val)}
            filterSource={filters.filters.source}
            setFilterSource={(val) => setFilterValue("source", val)}
            filterCampaign={filters.filters.campaignId}
            setFilterCampaign={(val) => setFilterValue("campaignId", val)}
            filterNextFollowUpAt={filters.filters.nextFollowUpAt}
            setFilterNextFollowUpAt={(val) => setFilterValue("nextFollowUpAt", val)}
            filterOverdue={filters.filters.overdue}
            setFilterOverdue={(val) => setFilterValue("overdue", val)}
            filterQualificationOutcome={filters.filters.qualificationOutcome}
            setFilterQualificationOutcome={(val) => setFilterValue("qualificationOutcome", val)}
            filterRecontactAt={filters.filters.recontactAt}
            setFilterRecontactAt={(val) => setFilterValue("recontactAt", val)}
            filterConverted={filters.filters.converted}
            setFilterConverted={(val) => setFilterValue("converted", val)}
            filterDuplicate={filters.filters.duplicate}
            setFilterDuplicate={(val) => setFilterValue("duplicate", val)}
            onResetAll={filters.resetFilters}
          />
        )}
        leftSlot={
          <div data-guidance-id="leads.list.saved-view" className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
            <LeadSavedViewSelector
              customViews={savedViews.customViews}
              activeView={savedViews.activeView}
              onSelectView={handleSelectSavedView}
              isViewDropdownOpen={savedViews.isViewDropdownOpen}
              setIsViewDropdownOpen={savedViews.setIsViewDropdownOpen}
              isAddViewOpen={savedViews.isAddViewOpen}
              setIsAddViewOpen={savedViews.setIsAddViewOpen}
              leadsCount={scopedLeads.length}
              onDeleteCustomView={handleDeleteSavedView}
              onAddViewClick={savedViews.openCreateView}
            />
            {savedViews.activeView.startsWith("custom_") && (
              <button
                type="button"
                onClick={() => savedViews.openEditView(savedViews.activeView)}
                className="text-xs text-indigo-600 hover:underline font-medium shrink-0 mr-1 cursor-pointer"
              >
                {t("common.edit", "Sửa")}
              </button>
            )}
          </div>
        }
        rightSlot={
          <button
            type="button"
            onClick={handleRefresh}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-xs transition-all hover:bg-slate-50 hover:text-violet-700"
            title={locale === "vi" ? "Làm mới" : "Refresh"}
            aria-label={locale === "vi" ? "Làm mới danh sách khách hàng tiềm năng" : "Refresh Lead list"}
          >
            <RefreshCw size={14} />
          </button>
        }
      />

      {/* 3. BULK ACTION BAR */}
      <ListBulkActionBar
        selectedCount={selection.selectedLeadIds.length}
        label={t("common.selected", "Đã chọn")}
        onClear={() => selection.clearSelection()}
      >
        {canDisqualifyLeadBatch && <button
          id="bulk-status-unqualified-btn"
          type="button"
          onClick={() => dialogs.handleOpenDisqualify(null)}
          className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-medium text-rose-700 shadow-sm hover:bg-slate-100"
        >
          {t("leads.markDisqualified")}
        </button>}
        {canScheduleLeadBatch && <button
          type="button"
          onClick={() => dialogs.handleOpenFollowUp(null)}
          className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-medium text-indigo-700 shadow-sm hover:bg-slate-100"
        >
          {t("leads.columnNextFollowUp", "Đặt lịch liên hệ lại")}
        </button>}
        {canAdvanceLeadBatch && <button
          id="bulk-status-contacted-btn"
          type="button"
          onClick={handleBulkMarkContacted}
          className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-medium text-amber-700 shadow-sm hover:bg-slate-100"
        >
          {t("leads.markContacted")}
        </button>}
        {canAssignLeadBatch && (
          <button
            id="bulk-assignall-btn"
            type="button"
            onClick={dialogs.handleBulkReassign}
            className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-2.5 py-1.5 text-[10px] font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            <UserPlus size={11} />
            <span>{t("leads.assignOwner")}</span>
          </button>
        )}
        {canArchiveLeadBatch && (
          <button
            id="bulk-archive-btn"
            type="button"
            onClick={() => {
              dialogs.setLeadToArchive(null);
              dialogs.setShowArchiveConfirm(true);
            }}
            className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] font-medium text-red-600 hover:bg-red-100"
          >
            <Archive size={11} />
            <span>{locale === "vi" ? "Lưu trữ" : "Archive"}</span>
          </button>
        )}
      </ListBulkActionBar>

      {/* 4. LEAD RESULT WORKSPACE */}
      <AuthoritativeQueryBoundary
        query={leadQuery}
        hasData={pagination.pageItems.length > 0}
        loadingTitleVi="Đang tải danh sách Lead"
        loadingTitleEn="Loading Leads"
        errorTitleVi="Không thể tải danh sách Lead"
        errorTitleEn="Lead list could not be loaded"
      >
      <LeadListResults
        leads={pagination.pageItems}
        viewMode={viewMode}
        activeView={savedViews.activeView}
        selectedLeadIds={selection.selectedLeadIds}
        visibleColumns={table.visibleColumns}
        columnWidths={table.columnWidths}
        openRowActionId={dialogs.openRowActionId}
        campaigns={referenceData.campaigns}
        memberById={referenceData.memberById}
        productById={referenceData.productById}
        canArchive={canArchiveLeads}
        canCreate={canCreateLeads}
        page={pagination.page}
        pageCount={pagination.pageCount}
        pageSize={pagination.pageSize}
        totalItems={pagination.totalItems}
        rangeStart={pagination.rangeStart}
        rangeEnd={pagination.rangeEnd}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        onOpenCreate={openNewLeadModal}
        onSelectAll={selection.selectAll}
        onSelectRow={selection.toggleSelection}
        onColumnResize={table.handleColumnResize}
        onColumnReset={table.handleColumnReset}
        setOpenRowActionId={dialogs.setOpenRowActionId}
        getReturnToUrl={getReturnToUrl}
        onMoveLead={handleKanbanMove}
        onCall={handleLeadCall}
        {...(canUpdateLeads ? {
          onMarkContacted: handleMarkContacted,
          onQualify: handleStartVerifying,
          onReopen: handleReopenLead,
          onFollowUp: dialogs.handleOpenFollowUp,
        } : {})}
        {...(canQualifyLeads ? {
          onDisqualify: dialogs.handleOpenDisqualify,
          onConvert: (leadId: string) => navigate(`/leads/${leadId}/qualify`),
        } : {})}
        onArchive={(leadId) => {
          dialogs.setLeadToArchive(leadId);
          dialogs.setShowArchiveConfirm(true);
        }}
        onViewDetails={(leadId) => navigate(`/leads/${leadId}`, { state: { returnTo: getReturnToUrl(viewMode), tab: "overview" } })}
      />
      </AuthoritativeQueryBoundary>

      <LeadStatisticsModal
        isOpen={showStatistics}
        onClose={() => setShowStatistics(false)}
        leads={scopedLeads}
        locale={locale}
      />

      <React.Suspense fallback={null}>
      <LeadImportDialog
        isOpen={dialogs.isImportOpen}
        onClose={() => dialogs.setIsImportOpen(false)}
        onImported={(count) => showToast(locale === "vi" ? `Đã nhập ${count} Lead từ CSV.` : `Imported ${count} Leads from CSV.`)}
        defaultOwnerId={ownership?.memberId || ""}
        actorName={ownership?.displayName || t("common.system")}
      />
      </React.Suspense>

      {/* 5. ADD NEW LEAD MANUALLY MODAL */}
      <Modal variant="form"
        isOpen={dialogs.isNewLeadOpen}
        onClose={newLeadUnsavedChanges.requestClose}
        title={t("leadForm.addTitle")}
        size="lg"
        scrollBody={false}
        bodyClassName="p-0"
        footer={<div id="lead-create-modal-footer" className="contents" />}
      >
        <React.Suspense fallback={<div className="p-6 text-sm text-slate-500">{locale === "vi" ? "Đang tải biểu mẫu…" : "Loading form…"}</div>}>
        <LeadForm
          onSubmit={handleCreateLeadFromForm}
          onCancel={newLeadUnsavedChanges.requestClose}
          onDirtyChange={newLeadUnsavedChanges.setIsDirty}
          ownerOptions={ownership?.assignableOwners || []}
          sources={referenceData.sources}
          campaigns={referenceData.campaigns}
          products={referenceData.products}
          defaultOwnerId={ownership?.memberId || ""}
          canAssignOwner={Boolean(ownership?.canAssign)}
          footerPortalId="lead-create-modal-footer"
        />
        </React.Suspense>
      </Modal>

      <ConfirmDialog
        isOpen={newLeadUnsavedChanges.isConfirmOpen}
        onClose={() => newLeadUnsavedChanges.setIsConfirmOpen(false)}
        onConfirm={newLeadUnsavedChanges.confirmDiscard}
        title={locale === "vi" ? "Bỏ thay đổi chưa lưu?" : "Discard unsaved changes?"}
        message={locale === "vi"
          ? "Thông tin khách hàng tiềm năng bạn vừa nhập chưa được lưu. Bạn có chắc chắn muốn đóng biểu mẫu?"
          : "The Lead information you entered has not been saved. Are you sure you want to close the form?"}
        confirmText={locale === "vi" ? "Bỏ thay đổi" : "Discard changes"}
        cancelText={locale === "vi" ? "Tiếp tục chỉnh sửa" : "Keep editing"}
        type="warning"
      />

      {/* 6. ADVANCED DISQUALIFICATION MODAL */}
      <LeadDisqualifyModal
        isOpen={dialogs.isDisqualifyModalOpen}
        onClose={closeDisqualifyModal}
        onConfirm={handleDisqualifyConfirm}
      />

      {/* 7. QUICK REOUTREACH / FOLLOW-UP MODAL */}
      <LeadFollowUpModal
        isOpen={dialogs.isFollowUpModalOpen}
        onClose={() => dialogs.setIsFollowUpModalOpen(false)}
        onConfirm={handleFollowUpConfirm}
      />

      <LeadTransitionRequirementsModal
        isOpen={Boolean(verificationLeadId)}
        lead={verificationLeadId ? leads.find((lead) => lead.id === verificationLeadId) ?? null : null}
        requiredFields={verificationLeadId
          ? getConfiguredLeadProfileBlockers(
              leads.find((lead) => lead.id === verificationLeadId) ?? {},
              LeadWorkState.VERIFYING,
            )
          : []}
        onClose={() => setVerificationLeadId(null)}
        onConfirm={handleVerificationReadinessConfirm}
      />

      {/* BULK UPDATE MODAL */}
      <React.Suspense fallback={null}>
      <LeadBulkUpdateModal
        isOpen={dialogs.isBulkUpdateOpen}
        onClose={() => dialogs.setIsBulkUpdateOpen(false)}
        selectedCount={selection.selectedLeadIds.length}
        onConfirm={handleBulkUpdateConfirm}
      />
      </React.Suspense>

      {/* MANAGE TAGS MODAL */}
      <LeadManageTagsModal
        isOpen={dialogs.isManageTagsModalOpen}
        onClose={() => dialogs.setIsManageTagsModalOpen(false)}
        selectedCount={selection.selectedLeadIds.length}
        onApply={async (tag) => {
          await leadActions.applyTagMany(selection.selectedLeadIds, tag);
          showToast(locale === "vi" ? `Đã gắn nhãn “${tag}” cho ${selection.selectedLeadIds.length} Lead.` : `Applied “${tag}” to ${selection.selectedLeadIds.length} Leads.`);
        }}
      />

      {/* 9. ADD CUSTOM VIEWS MODAL */}
      <LeadAddViewModal
        isOpen={savedViews.isAddViewOpen}
        onClose={() => savedViews.setIsAddViewOpen(false)}
        onConfirm={handleSaveView}
        initialName={savedViews.editingView?.labelKey || ""}
        mode={savedViews.editingViewKey ? "edit" : "create"}
      />

      {/* 10. CUSTOM TOAST NOTIFICATION */}
      {toast && (
        <div id="lead-list-page-custom-toast-alert" className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700 shadow-xl animate-fade-in text-left font-sans">
          <CheckCircle2 size={14} className="text-indigo-600 shrink-0" />
          <span className="min-w-0 flex-1">{toast.message}</span>
          {toast.actionLabel && toast.onAction ? (
            <button type="button" className="shrink-0 font-semibold text-violet-700 hover:underline" onClick={() => { const action = toast.onAction; setToast(null); action?.(); }}>
              {toast.actionLabel}
            </button>
          ) : null}
        </div>
      )}

      {/* 11. SINGLE / BULK ARCHIVE CONFIRMATION */}
      <LeadArchiveConfirmationModal
        isOpen={dialogs.showArchiveConfirm}
        bulk={!dialogs.leadToArchive}
        selectedCount={dialogs.leadToArchive ? 1 : selection.selectedLeadIds.length}
        pending={archivePending}
        onClose={closeArchiveModal}
        onConfirm={() => { void handleArchiveConfirm(); }}
      />

      {/* BULK REASSIGN OWNER MODAL */}
      <ConfirmDialog
        isOpen={dialogs.isReassignModalOpen}
        onClose={() => dialogs.setIsReassignModalOpen(false)}
        onConfirm={executeBulkReassign}
        title={locale === "vi" ? "Bàn giao khách hàng tiềm năng hàng loạt" : "Bulk Lead Handover"}
        confirmText={t("common.confirm")}
        cancelText={t("common.cancel")}
      >
        <div className="space-y-4 pt-2 text-left font-sans">
          <p className="text-xs text-slate-500">
            {locale === "vi" ? `Chọn nhân viên nhận bàn giao cho ${selection.selectedLeadIds.length} Lead đã chọn.` : `Select the receiver personnel for the ${selection.selectedLeadIds.length} selected lead records.`}
          </p>
          <Select
            label={t("leads.columnOwner")}
            required
            value={dialogs.selectedReassignOwnerId}
            onChange={(e) => dialogs.setSelectedReassignOwnerId(e.target.value)}
            className="rounded-xl border-slate-200 text-xs"
          >
            {(ownership?.assignableOwners || []).map((owner) => (
              <option key={owner.memberId} value={owner.memberId}>{owner.displayName}</option>
            ))}
          </Select>
          <Textarea
            label={locale === "vi" ? "Lý do bàn giao" : "Handover reason"}
            required
            value={dialogs.reassignReason}
            onChange={(event) => dialogs.setReassignReason(event.target.value)}
            placeholder={locale === "vi" ? "Ví dụ: chuyển theo khu vực phụ trách" : "For example: reassigned by territory"}
          />
        </div>
      </ConfirmDialog>

      {/* 13. SIDE-SLIDING CUSTOMIZE COLUMNS PREFERENCES DRAWER */}
      <LeadColumnSettingsDrawer
        isOpen={table.isColumnSettingsOpen}
        onClose={() => table.setIsColumnSettingsOpen(false)}
        allFields={table.allColumnFields}
        visibleColumns={table.visibleColumns}
        onSave={table.handleSaveColumns}
        onResetDefault={table.handleResetDefaultColumns}
      />

    </ListPageFrame>
  );
};

function projectServerLeadPage(records: readonly Lead[]): void {
  const byId = new Map(getRetainedLeadsSnapshot().map((lead) => [lead.id, lead]));
  for (const lead of records) byId.set(lead.id, lead);
  replaceLeads([...byId.values()]);
}

function clearLeadProjection(): void {
  replaceLeads([]);
}
