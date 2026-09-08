import { backendUnavailableMessage, formatOperationUnavailableError } from "@/shared/operations";
import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Contact } from "../../domain/model/contact.types";
import { archiveContactViaApi, createContactViaApi, isContactCreateAvailable, isContactRetentionUnavailable, isContactUpdateAvailable, restoreContactCommand } from "../../public/contacts";
import { getOrganizationAccountsSnapshot } from "@/modules/organizations";
import type { CustomerDisplay as Customer } from "@/modules/customers";
import { createDealCommand, Deal, DealStage } from "@/modules/deals";
import { createTaskCommand } from "@/modules/tasks";
import { getDealNextActionTaskIntentKey } from "@/workflows/work-activation";
import { isContactOpportunityCreationUnavailable } from "@/workflows/contact-opportunity-creation";
import { CRMActivity } from "@/shared/domain";
import type { CrmWorkspaceConfig } from "@/platform/workspace-config";
import { getProductCatalogSnapshot, subscribeToProductCatalog } from "@/modules/products";
import { DEFAULT_CRM_WORKSPACE_CONFIG } from "@/platform/workspace-config/workspaceConfigDefaults";
import { useI18n } from "@/i18n";
import { notifyProduct } from "@/components/feedback/ProductDialogService";
import { resolveWorkspaceMemberName, getWorkspaceMemberOptions } from "@/platform/member-directory";
import { useSubscribableSnapshot } from "@/platform/react";
import { getContactStatusLabel } from "../list/contactList.helpers";
import type { ContactCreateInput } from "../list/ContactCreateModal";
import { useContacts } from "../hooks/useContacts";
import { useContactListFilters } from "../hooks/useContactListFilters";
import { useContactListViewSettings } from "../hooks/useContactListViewSettings";
import { createContactPresentationSnapshot, resolveContactPresentationSnapshot, type ContactListPresentationSnapshot } from "../model/contactSavedViewPreferences";
import { findCustomerForContact, getCustomerDisplayNameForContact } from "../model/contactCustomerLookup";
import { normalizeContactCanonicalProfile } from "../../domain/model/contactCanonicalProfile";
import { getWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useEffectiveAccess } from "@/platform/access-control";

export interface ContactListPageProps {
  customers: Customer[];
  deals: Deal[];
  setDeals: React.Dispatch<React.SetStateAction<Deal[]>>;
  crmConfig?: CrmWorkspaceConfig;
}
export function useContactListController({
  customers,
  deals,
  setDeals,
  crmConfig = DEFAULT_CRM_WORKSPACE_CONFIG
}: ContactListPageProps) {
  const { t, tx, locale } = useI18n();
  const access = useEffectiveAccess();
  const navigate = useNavigate();
  const { contacts, setContacts, query: contactQuery } = useContacts();
  const productCatalog = useSubscribableSnapshot(getProductCatalogSnapshot, subscribeToProductCatalog);
  const {
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    linkFilter, setLinkFilter,
    sourceFilter, setSourceFilter,
    ownerFilter, setOwnerFilter,
    priorityFilter, setPriorityFilter,
    sortBy, setSortBy,
    relationshipLevelFilter, setRelationshipLevelFilter,
    decisionRoleFilter, setDecisionRoleFilter,
    nextFollowUpAtFilter, setNextFollowUpAtFilter,
    lastInteractionAtFilter, setLastInteractionAtFilter,
    doNotContactFilter, setDoNotContactFilter,
    hasActiveFilters,
    activeFiltersCount,
    resetFilters,
  } = useContactListFilters();
  const {
    activeView,
    selectSavedView,
    isViewDropdownOpen, setIsViewDropdownOpen,
    customViews,
    isHeaderMoreOpen, setIsHeaderMoreOpen,
    isColumnSettingsOpen, setIsColumnSettingsOpen,
    visibleColumns,
    columnWidths,
    createCustomView,
    updateCustomView,
    deleteCustomView,
    saveColumnSettings,
    resetColumnSettings,
    resizeColumn,
    resetColumnWidth,
  } = useContactListViewSettings();
  const [viewMode, setViewMode] = useState<"card" | "table">("table");
  const [showStatisticsPanel, setShowStatisticsPanel] = useState(false);
  // Filter popover visibility state
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [savedViewDialog, setSavedViewDialog] = useState<
    { mode: "create" } | { mode: "edit"; viewKey: string } | null
  >(null);
  const [viewName, setViewName] = useState("");
  const [viewNameError, setViewNameError] = useState("");
  const [isSavingView, setIsSavingView] = useState(false);
  const viewSaveInFlightRef = useRef(false);
  const [viewToDelete, setViewToDelete] = useState<string | null>(null);
  // Row selection and bulk action states
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [openRowActionId, setOpenRowActionId] = useState<string | null>(null);
  const [showBulkReassignModal, setShowBulkReassignModal] = useState(false);
  const getCurrentViewSnapshot = (): ContactListPresentationSnapshot => createContactPresentationSnapshot({
    visibleColumns,
    columnWidths,
    filters: {
      searchTerm,
      statusFilter,
      linkFilter,
      sourceFilter,
      ownerFilter,
      priorityFilter,
      relationshipLevelFilter,
      decisionRoleFilter,
      nextFollowUpAtFilter,
      lastInteractionAtFilter,
      doNotContactFilter,
    },
    sortBy,
    viewMode,
  });
  const applySavedPresentationState = (snapshot?: ContactListPresentationSnapshot) => {
    const resolved = resolveContactPresentationSnapshot(snapshot);
    const filters = resolved.filters!;
    setSearchTerm(filters.searchTerm!);
    setStatusFilter(filters.statusFilter!);
    setLinkFilter(filters.linkFilter!);
    setSourceFilter(filters.sourceFilter!);
    setOwnerFilter(filters.ownerFilter!);
    setPriorityFilter(filters.priorityFilter!);
    setRelationshipLevelFilter(filters.relationshipLevelFilter!);
    setDecisionRoleFilter(filters.decisionRoleFilter!);
    setNextFollowUpAtFilter(filters.nextFollowUpAtFilter!);
    setLastInteractionAtFilter(filters.lastInteractionAtFilter!);
    setDoNotContactFilter(filters.doNotContactFilter ?? null);
    setSortBy(resolved.sortBy!);
    setViewMode(resolved.viewMode!);
  };
  const getActiveCustomView = () => customViews.find((view) => view.key === activeView && !view.isShared);
  const handleSelectSavedView = (view: string) => {
    const applied = selectSavedView(view);
    applySavedPresentationState(applied);
    setSelectedContactIds([]);
  };
  // Add/update custom view handlers
  const closeSavedViewDialog = () => {
    setSavedViewDialog(null);
    setViewNameError("");
  };
  const handleAddViewClick = () => {
    setViewName("");
    setViewNameError("");
    setSavedViewDialog({ mode: "create" });
    setIsViewDropdownOpen(false);
  };
  const handleEditViewClick = () => {
    const viewToEdit = getActiveCustomView();
    if (!viewToEdit) return;
    setViewName(viewToEdit.labelKey);
    setViewNameError("");
    setSavedViewDialog({ mode: "edit", viewKey: viewToEdit.key });
    setIsViewDropdownOpen(false);
  };
  const handleSubmitSavedView = (e: React.FormEvent) => {
    e.preventDefault();
    if (viewSaveInFlightRef.current || !savedViewDialog) return;
    const trimmedName = viewName.trim();
    if (!trimmedName) {
      setViewNameError(tx("contactList.customViews.validation.required", "Vui l\u00f2ng nh\u1eadp t\u00ean giao di\u1ec7n."));
      return;
    }
    viewSaveInFlightRef.current = true;
    setIsSavingView(true);
    try {
      // Snapshot the live presentation state only after the explicit submit action.
      const snapshot = getCurrentViewSnapshot();
      const result = savedViewDialog.mode === "edit"
        ? updateCustomView(savedViewDialog.viewKey, trimmedName, snapshot)
        : createCustomView(trimmedName, snapshot);
      if (result.ok === false) {
        setViewNameError(result.error === "duplicate"
          ? tx("contactList.customViews.validation.duplicate", "T\u00ean giao di\u1ec7n \u0111\u00e3 t\u1ed3n t\u1ea1i.")
          : tx("contactList.customViews.validation.required", "Vui l\u00f2ng nh\u1eadp t\u00ean giao di\u1ec7n."));
        return;
      }
      const completedMode = savedViewDialog.mode;
      closeSavedViewDialog();
      setViewName("");
      showToast(completedMode === "edit"
        ? tx("contactList.toastMessage.updatedView", "\u0110\u00e3 c\u1eadp nh\u1eadt giao di\u1ec7n th\u00e0nh c\u00f4ng.")
        : tx("contactList.toastMessage.addedView", "\u0110\u00e3 th\u00eam giao di\u1ec7n th\u00e0nh c\u00f4ng.", { name: trimmedName }));
    } finally {
      viewSaveInFlightRef.current = false;
      setIsSavingView(false);
    }
  };
  const handleDeleteCustomView = () => {
    if (!viewToDelete) return;
    const defaultPresentation = deleteCustomView(viewToDelete);
    if (defaultPresentation) applySavedPresentationState(defaultPresentation);
    setViewToDelete(null);
    showToast(tx("contactList.toastMessage.deletedView", "\u0110\u00e3 x\u00f3a giao di\u1ec7n th\u00e0nh c\u00f4ng"));
  };
  const handleResetFilters = () => {
    resetFilters();
    showToast(tx("contactList.toastMessage.resetFilters", "Đã đặt lại tất cả bộ lọc"));
  };
  // Column settings actions
  const handleSaveColumnSettings = (columns: any[]) => {
    saveColumnSettings(columns);
    showToast(tx("contactList.toastMessage.updatedColumns", "Cập nhật hiển thị thành công"));
  };
  const handleResetColumnSettings = () => {
    resetColumnSettings();
    showToast(tx("contactList.toastMessage.resetColumns", "Đã đặt lại cấu hình mặc định!"));
  };
  const handleColumnResize = (e: React.MouseEvent, colKey: string) => resizeColumn(e, colKey);
  const handleColumnReset = (colKey: string) => resetColumnWidth(colKey);
  // Checkbox row selections helpers
  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedContactIds(prev => [...prev, id]);
    } else {
      setSelectedContactIds(prev => prev.filter(x => x !== id));
    }
  };
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = sortedContacts.map(c => c.id);
      setSelectedContactIds(allIds);
    } else {
      setSelectedContactIds([]);
    }
  };
  // Bulk actions operations
  const handleBulkChangeOwner = (targetOwnerId: string, remark: string) => {
    if (refuseUnavailableContactWrite(locale === "vi" ? "Bàn giao hàng loạt" : "Bulk owner reassignment")) return;
    const updatedContacts = contacts.map(c => {
      if (selectedContactIds.includes(c.id)) {
        const handoverAct: CRMActivity = {
          id: `act_bulk_handover_${Date.now()}_${c.id}`,
          icon: "UserCheck",
          title: tx("contactList.activity.assignedNewOwner", "BÀN GIAO NGƯỜI PHỤ TRÁCH"),
          description: remark
            ? `Bàn giao liên hệ cho người phụ trách mới: ${getWorkspaceMemberOptions().find(u => u.id === targetOwnerId)?.name}. Ghi chú: ${remark}`
            : `Bàn giao liên hệ cho người phụ trách mới: ${getWorkspaceMemberOptions().find(u => u.id === targetOwnerId)?.name}`,
          createdAt: new Date().toISOString(),
          author: t("contactList.activity.systemAuthor"),
          type: "system"
        };
        return {
          ...c,
          ownerId: targetOwnerId,
          activities: [handoverAct, ...(c.activities || [])]
        };
      }
      return c;
    });
    setContacts(updatedContacts);
    setSelectedContactIds([]);
    setShowBulkReassignModal(false);
    showToast(tx("contactList.toastMessage.bulkReassigned", `Đã bàn giao ${selectedContactIds.length} liên hệ thành công`, { count: selectedContactIds.length }));
  };
  const handleBulkChangeStatus = (newStatus: string) => {
    if (refuseUnavailableContactWrite(locale === "vi" ? "Đổi trạng thái hàng loạt" : "Bulk status change")) return;
    const updatedContacts = contacts.map(c => {
      if (selectedContactIds.includes(c.id)) {
        const statusAct: CRMActivity = {
          id: `act_bulk_status_${Date.now()}_${c.id}`,
          icon: "RefreshCw",
          title: "CẬP NHẬT TRẠNG THÁI HÀNG LOẠT",
          description: `Trạng thái được cập nhật thành: ${t(`contactStatus.${newStatus}`)}`,
          createdAt: new Date().toISOString(),
          author: t("contactList.activity.systemAuthor"),
          type: "system"
        };
        return {
          ...c,
          status: newStatus as any,
          activities: [statusAct, ...(c.activities || [])]
        };
      }
      return c;
    });
    setContacts(updatedContacts);
    setSelectedContactIds([]);
    showToast(tx("contactList.toastMessage.bulkStatusUpdated", "Đã cập nhật trạng thái thành công"));
  };
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });
  const [isConfirming, setIsConfirming] = useState(false);
  const confirmInFlightRef = useRef(false);
  const [promptModal, setPromptModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    value: string;
    onConfirm: (val: string) => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    value: "",
    onConfirm: () => {},
  });
  const requestConfirmation = (title: string, message: string, onConfirm: () => void | Promise<void>) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        if (confirmInFlightRef.current) return;
        confirmInFlightRef.current = true;
        setIsConfirming(true);
        void Promise.resolve(onConfirm())
          .then(() => setConfirmModal((prev) => ({ ...prev, isOpen: false })))
          .catch((error: unknown) => showToast(formatOperationUnavailableError(error, { locale })))
          .finally(() => {
            confirmInFlightRef.current = false;
            setIsConfirming(false);
          });
      },
    });
  };
  const requestPrompt = (title: string, message: string, onConfirm: (val: string) => void) => {
    setPromptModal({
      isOpen: true,
      title,
      message,
      value: "",
      onConfirm: (val) => {
        onConfirm(val);
        setPromptModal((prev) => ({ ...prev, isOpen: false, value: "" }));
      },
    });
  };
  const handleBulkDelete = () => {
    if (refuseUnavailableContactWrite(locale === "vi" ? "Xóa liên hệ hàng loạt" : "Bulk contact delete")) return;
    requestConfirmation(
      tx("contactList.confirm.bulkDeleteTitle", "Xóa liên hệ hàng loạt"),
      tx("contactList.confirm.bulkDelete", `Bạn có chắc chắn muốn xóa ${selectedContactIds.length} liên hệ được chọn?`, { count: selectedContactIds.length }),
      () => {
        const updatedContacts = contacts.filter(c => !selectedContactIds.includes(c.id));
        setContacts(updatedContacts);
        setSelectedContactIds([]);
        showToast(tx("contactList.toastMessage.bulkDeleted", "Đã xóa các liên hệ thành công"));
      }
    );
  };
  const handleBulkArchive = () => {
    if (refuseUnavailableContactWrite(locale === "vi" ? "Lưu trữ hàng loạt" : "Bulk archive")) return;
    requestConfirmation(
      tx("contactList.confirm.bulkArchiveTitle", "Lưu trữ liên hệ hàng loạt"),
      tx("contactList.confirm.bulkArchive", `Bạn có chắc muốn lưu trữ ${selectedContactIds.length} liên hệ đã chọn?`, { count: selectedContactIds.length }),
      () => {
        const updatedContacts = contacts.map(c => {
          if (selectedContactIds.includes(c.id)) {
            return { ...c, status: "archived" as any };
          }
          return c;
        });
        setContacts(updatedContacts);
        setSelectedContactIds([]);
        showToast(tx("contactList.toastMessage.archived", "Đã lưu trữ thành công"));
      }
    );
  };
  const handleBulkAddTags = () => {
    if (refuseUnavailableContactWrite(locale === "vi" ? "Thêm nhãn hàng loạt" : "Bulk tagging")) return;
    requestPrompt(
      tx("contactList.prompt.addTagsTitle", "Thêm thẻ nhãn hàng loạt"),
      tx("contactList.prompt.addTags", "Nhập các thẻ nhãn mới (ngăn cách bằng dấu phẩy):"),
      (inputTags) => {
        const newTags = inputTags.split(",").map(t => t.trim()).filter(Boolean);
        if (newTags.length === 0) return;
        const updatedContacts = contacts.map(c => {
          if (selectedContactIds.includes(c.id)) {
            const currentTags = c.tags || [];
            const mergedTags = Array.from(new Set([...currentTags, ...newTags]));
            return { ...c, tags: mergedTags };
          }
          return c;
        });
        setContacts(updatedContacts);
        setSelectedContactIds([]);
        showToast(tx("contactList.toastMessage.addedTags", `Đã thêm nhãn cho ${selectedContactIds.length} liên hệ`, { count: selectedContactIds.length }));
      }
    );
  };
  const handleBulkDoNotContact = () => {
    if (refuseUnavailableContactWrite(locale === "vi" ? "Chặn liên hệ hàng loạt" : "Bulk do-not-contact")) return;
    requestPrompt(
      tx("contactList.prompt.doNotContactReasonTitle", "Yêu cầu chặn liên hệ"),
      tx("contactList.prompt.doNotContactReason", "Xác nhận chặn / Yêu cầu dừng liên hệ cho các mục đã chọn. Nhập lý do chặn:"),
      (reason) => {
        const updatedContacts = contacts.map(c => {
          if (selectedContactIds.includes(c.id)) {
            return {
              ...c,
              status: "do_not_contact" as any,
              doNotContact: true,
              doNotContactReason: reason || "Yêu cầu từ khách hàng / Customer requested"
            };
          }
          return c;
        });
        setContacts(updatedContacts);
        setSelectedContactIds([]);
        showToast(tx("contactList.toastMessage.setDoNotContact", "Đã chuyển trạng thái chặn liên hệ"));
      }
    );
  };
  // Dropdown states
  const [activeMenuContactId, setActiveMenuContactId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // New Contact form toggle
  const [showAddForm, setShowAddForm] = useState(false);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  // Opportunity Wizard Modal states
  const [selectedContactForDeal, setSelectedContactForDeal] = useState<Contact | null>(null);
  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveMenuContactId(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);
  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);
  // Soft toast dispatch helper
  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = undefined;
    }, 4000);
  };

  /**
   * Contact Create has a production contract; `updateContact` remains BLOCKED and no
   * bulk Contact operation exists. In
   * connected mode they fail closed inside the contacts projection, so the action is
   * refused up front with a user-readable reason.
   */
  const contactCreateAvailable = isContactCreateAvailable();
  const contactUpdateAvailable = isContactUpdateAvailable();
  const canCreateContact = contactCreateAvailable && access.canPerform("contacts", "create");
  const canUpdateContact = contactUpdateAvailable && access.canPerform("contacts", "update");
  const canArchiveContact = !isContactRetentionUnavailable() && access.canPerform("contacts", "delete");
  const contactOpportunityAvailable = !isContactOpportunityCreationUnavailable();
  const contactWritesUnavailable = !contactUpdateAvailable;
  const refuseUnavailableContactWrite = (action: string, unavailable = contactWritesUnavailable): boolean => {
    if (!unavailable) return false;
    showToast(backendUnavailableMessage({ locale, action }));
    return true;
  };
  /**
   * Creating an opportunity for a Contact and moving the Contact to `has_open_opportunity`
   * is WF-01, whichever screen starts it. WF-01 is BLOCKED with
   * `connectedFrontendCoordinatorAllowed: false`, so this must refuse on WF-01 itself
   * before the Deal command — sequencing an authoritative Deal write, an authoritative Task
   * write and a local Contact write does not make the frontend the workflow owner.
   */
  const refuseUnavailableContactOpportunity = (action: string): boolean => {
    if (!isContactOpportunityCreationUnavailable()) return false;
    showToast(backendUnavailableMessage({ locale, action }));
    return true;
  };
  // 1. Core Logic: Add New Contact callback
  const handleSaveContact = async (data: ContactCreateInput) => {
    if (refuseUnavailableContactWrite(locale === "vi" ? "Tạo liên hệ" : "Creating a Contact", !contactCreateAvailable)) return;
    const code = data.contactCode.trim() || `CN${String(contacts.length + 1).padStart(4, "0")}`;
    const tagArray = data.tagsString.split(",").map((tag) => tag.trim()).filter(Boolean);
    const createdAt = new Date().toISOString();
    const normalizedOrganizationName = data.organizationName.trim().toLowerCase();
    const organization = normalizedOrganizationName
      ? getOrganizationAccountsSnapshot().find((account) =>
          [account.displayName, account.legalName].some((name) => name?.trim().toLowerCase() === normalizedOrganizationName),
        )
      : undefined;
    const preferredChannel = data.preferredChannel.toLowerCase() as Contact["preferredContactChannel"];
    const newContactObj = normalizeContactCanonicalProfile({
      id: `contact_${crypto.randomUUID()}`,
      workspaceId: getWorkspaceContextSnapshot().workspaceId,
      contactCode: code,
      code,
      name: data.name,
      fullName: data.name,
      title: data.title || undefined,
      roleTitle: data.title || undefined,
      roleAtCompany: data.title || undefined,
      department: data.department || undefined,
      decisionRole: data.decisionRole || undefined,
      avatarColor: data.avatarColor || undefined,
      email: data.email || undefined,
      workEmail: data.email || undefined,
      phone: data.phone || undefined,
      mobilePhone: data.phone || undefined,
      zaloId: data.zaloId || undefined,
      zalo: data.zaloId || undefined,
      address: data.address || undefined,
      preferredChannel: data.preferredChannel || undefined,
      preferredContactChannel: preferredChannel || undefined,
      communicationConsent: data.communicationConsent,
      consent: {
        current: {
          CALL: data.communicationConsent ? "GRANTED" : "UNKNOWN",
          EMAIL: data.communicationConsent ? "GRANTED" : "UNKNOWN",
          SMS: data.communicationConsent ? "GRANTED" : "UNKNOWN",
          ZALO: data.communicationConsent ? "GRANTED" : "UNKNOWN",
        },
        ledger: [],
        lawfulBasis: data.communicationConsent ? "MANUAL_CONTACT_CREATE" : undefined,
        updatedAt: createdAt,
      },
      organizationName: organization?.displayName || data.organizationName || undefined,
      companyName: organization?.displayName || data.organizationName || undefined,
      relationshipType: data.relationshipType || undefined,
      isPrimaryContact: data.isPrimaryContact,
      influenceLevel: data.influenceLevel,
      source: data.source || undefined,
      priority: data.priority,
      status: data.status,
      ownerId: data.ownerId || undefined,
      nextFollowUpAt: data.nextFollowUpAt ? new Date(data.nextFollowUpAt).toISOString() : undefined,
      lastContactedAt: data.lastContactedAt ? new Date(data.lastContactedAt).toISOString() : undefined,
      tags: tagArray.length > 0 ? tagArray : [t("contactList.activity.newContactTag")],
      notes: data.notes || undefined,
      internalNotes: data.internalNotes || undefined,
      createdAt,
      updatedAt: createdAt,
      createdBy: data.ownerId || undefined,
      updatedBy: data.ownerId || undefined,
      createdFrom: "manual",
      activities: [{
        id: `act_init_${crypto.randomUUID()}`,
        icon: "User",
        title: t("contactList.activity.createdContactProfile"),
        description: t("contactList.activity.initializedProfileDescription", { status: getContactStatusLabel(data.status, t) }),
        createdAt,
        author: t("contactList.activity.systemAuthor"),
        type: "system",
      }],
    }, { workspaceId: getWorkspaceContextSnapshot().workspaceId, now: createdAt });
    const createdContact = await createContactViaApi(newContactObj);
    setShowAddForm(false);
    notifyProduct(t("contactList.quickCreate.created", { name: data.name }), "success", {
      actionLabel: t("contactList.quickCreate.openRecord"),
      onAction: () => navigate(`/contacts/${createdContact.id}`),
      durationMs: 6000,
    });
  };
  // 2. Action Handlers safely complying with CRM Workflows
  const handleCall = (contact: Contact) => {
    if (refuseUnavailableContactWrite(locale === "vi" ? "Ghi cuộc gọi vào hồ sơ Liên hệ" : "Recording the call on the Contact")) return;
    if (contact.phone) {
      showToast(t("contactList.toast.calling", { name: contact.name || contact.phone }));
      // Record call activity in-app
      const callAct: CRMActivity = {
        id: `act_call_${Date.now()}`,
        icon: "Phone",
        title: t("contactList.activity.outboundCall"),
        description: t("contactList.activity.outboundCallDescription", { phone: contact.phone }),
        createdAt: new Date().toISOString(),
        author: t("contactList.activity.youAuthor"),
        type: "call"
      };
      setContacts(prev => prev.map(c => {
        if (c.id === contact.id) {
          return {
            ...c,
            lastContactedAt: new Date().toISOString(),
            activities: [callAct, ...(c.activities || [])]
          };
        }
        return c;
      }));
      setTimeout(() => {
        window.location.href = `tel:${contact.phone}`;
      }, 800);
    } else {
      showToast(t("contactList.toast.noPhone"));
    }
  };
  const handleEmail = (contact: Contact) => {
    if (refuseUnavailableContactWrite(locale === "vi" ? "Ghi email vào hồ sơ Liên hệ" : "Recording the email on the Contact")) return;
    if (contact.email) {
      showToast(t("contactList.toast.draftingEmail", { email: contact.email }));
      const emailAct: CRMActivity = {
        id: `act_email_${Date.now()}`,
        icon: "Mail",
        title: t("contactList.activity.outboundEmailSent"),
        description: t("contactList.activity.outboundEmailDescription", { email: contact.email }),
        createdAt: new Date().toISOString(),
        author: t("contactList.activity.youAuthor"),
        type: "email"
      };
      setContacts(prev => prev.map(c => {
        if (c.id === contact.id) {
          return {
            ...c,
            lastContactedAt: new Date().toISOString(),
            activities: [emailAct, ...(c.activities || [])]
          };
        }
        return c;
      }));
      setTimeout(() => {
        window.location.href = `mailto:${contact.email}`;
      }, 800);
    } else {
      showToast(t("contactList.toast.noEmail"));
    }
  };
  const handleCommitOpportunity = async (oppData: {
    dealName: string;
    dealAmount: number;
    dealOwnerId: string;
    expectedCloseDate: string;
    selectedProductId: string;
    demandSummary: string;
    createFollowUpTask: boolean;
    followUpTaskTitle: string;
    followUpTaskDueAt: string;
    lineItems?: any[];
  }) => {
    if (!selectedContactForDeal) return;
    if (refuseUnavailableContactOpportunity(locale === "vi" ? "Tạo cơ hội từ Liên hệ" : "Creating an opportunity from this Contact")) {
      setSelectedContactForDeal(null);
      return;
    }
    const newDealId = `deal_${Date.now()}`;
    const dealOwner = getWorkspaceMemberOptions().find(u => u.id === oppData.dealOwnerId)?.name || t("contactList.preview.unassigned");
    const followUpDueAt = oppData.createFollowUpTask && oppData.followUpTaskDueAt
      ? new Date(oppData.followUpTaskDueAt).toISOString()
      : undefined;
    const followUpTaskIntentKey = followUpDueAt ? getDealNextActionTaskIntentKey(newDealId, followUpDueAt) : undefined;
    const targetCustomer = findCustomerForContact(selectedContactForDeal);
    const targetCustId = targetCustomer?.id;
    const targetCustName = getCustomerDisplayNameForContact(selectedContactForDeal);
    const lineItemsArray = oppData.lineItems && oppData.lineItems.length > 0
      ? oppData.lineItems.map((li: any, idx: number) => ({
          id: `li_${newDealId}_${idx}`,
          productId: li.product.id,
          productName: li.product.name,
          description: li.product.description || "",
          quantity: li.quantity,
          unitPrice: li.customPrice ?? li.product.listPrice,
          totalPrice: (li.customPrice ?? li.product.listPrice) * li.quantity * (1 - (li.discountPercent || 0) / 100),
          discountPercent: li.discountPercent || 0
        }))
      : (() => {
          const chosenProduct = productCatalog.find(p => p.id === oppData.selectedProductId);
          return chosenProduct ? [
            {
              id: `li_${newDealId}_0`,
              productId: chosenProduct.id,
              productName: chosenProduct.name,
              description: chosenProduct.description || t("contactList.activity.crmServicePlatform"),
              quantity: 1,
              unitPrice: oppData.dealAmount,
              discountPercent: 0
            }
          ] : [];
        })();
    const interestedIds = oppData.lineItems && oppData.lineItems.length > 0
      ? oppData.lineItems.map((li: any) => li.product.id)
      : (() => {
          const chosenProduct = productCatalog.find(p => p.id === oppData.selectedProductId);
          return chosenProduct ? [chosenProduct.id] : [];
        })();
    const newDeal: Deal = {
      id: newDealId,
      name: oppData.dealName,
      buyerRef: selectedContactForDeal.organizationAccountId
        ? { type: "ORGANIZATION_ACCOUNT", id: selectedContactForDeal.organizationAccountId }
        : { type: "CONTACT", id: selectedContactForDeal.id },
      customerId: targetCustId,
      customerName: targetCustName,
      contactId: selectedContactForDeal.id,
      contactName: selectedContactForDeal.name,
      contactTitle: selectedContactForDeal.title,
      contactPhone: selectedContactForDeal.phone,
      contactEmail: selectedContactForDeal.email,
      stage: DealStage.DISCOVERY,
      amount: oppData.dealAmount,
      currency: "VND",
      opportunityScore: 50,
      ownerId: oppData.dealOwnerId,
      expectedCloseDate: oppData.expectedCloseDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      interestedProducts: interestedIds,
      lineItems: lineItemsArray,
      notes: oppData.demandSummary || undefined,
      // Task ids are server-assigned and the follow-up Task is created after this Deal
      // commits, so the Deal carries the schedule without a Task foreign reference.
      ...(followUpDueAt ? {
        nextActionAt: followUpDueAt,
        nextActionSummary: oppData.followUpTaskTitle,
      } : {}),
      activities: [
        {
          id: `act_${Date.now()}`,
          type: "system",
          title: t("contactList.modal.createOpportunityTitle"),
          description: t("contactList.activity.createOpportunityDescription", { dealName: oppData.dealName, contactName: selectedContactForDeal.name }),
          createdAt: new Date().toISOString(),
          author: dealOwner
        }
      ]
    };
    const createdDeal = (await createDealCommand(newDeal)).data;
    // Authoritative Task command. NOT atomic with the Deal command above (WF-21 is
    // blocked): the Deal is already committed, so a Task failure must be reported as a
    // partial outcome naming what committed and what did not — never as total failure.
    if (followUpDueAt && followUpTaskIntentKey) {
      try {
        await createTaskCommand({
        id: followUpTaskIntentKey,
        title: oppData.followUpTaskTitle,
        description: oppData.demandSummary || undefined,
        priority: "NORMAL",
        assigneeId: createdDeal.ownerId,
        dueAt: followUpDueAt,
        customerId: targetCustId,
        relationshipRef: createdDeal.buyerRef,
        recordRef: { moduleKey: "deals", recordId: createdDeal.id, label: createdDeal.name },
        sourceRef: { type: "CONTACT_DEAL_FOLLOW_UP", id: createdDeal.id },
          dedupeKey: `contact-deal-follow-up:${createdDeal.id}:${followUpDueAt}`,
          actorId: createdDeal.ownerId,
          actorName: dealOwner,
        }, {
          idempotencyKey: `task.create:${followUpTaskIntentKey}`,
          correlationId: `deal:${createdDeal.id}`,
        });
      } catch (error) {
        // Deterministic idempotency key: retrying the same follow-up replays rather
        // than creating a second Task. The committed Deal must not be rolled back.
        showToast(locale === "vi"
          ? `Đã tạo cơ hội "${createdDeal.name}". Chưa tạo được công việc theo dõi: ${formatOperationUnavailableError(error, { locale })}`
          : `Opportunity "${createdDeal.name}" was created. Its follow-up Task was not created: ${formatOperationUnavailableError(error, { locale })}`);
        setSelectedContactForDeal(null);
        return;
      }
    }
    if (contactWritesUnavailable) {
      showToast(locale === "vi"
        ? `Đã tạo cơ hội "${createdDeal.name}". Chưa cập nhật được trạng thái Liên hệ vì máy chủ chưa hỗ trợ.`
        : `Opportunity "${createdDeal.name}" was created. The Contact status could not be updated yet because server support has not been released.`);
      setSelectedContactForDeal(null);
      return;
    }
    // Update contact status after creating an opportunity.
    const createOppAct: CRMActivity = {
      id: `act_opp_${Date.now()}`,
      icon: "TrendingUp",
      title: t("contactList.activity.salesOpportunityInitiated", locale === "vi" ? "Khởi tạo cơ hội bán hàng" : "Sales opportunity initiated"),
      description: t("contactList.activity.salesOpportunityInitiatedDescription", { dealName: oppData.dealName, dealAmount: oppData.dealAmount.toLocaleString() }),
      createdAt: new Date().toISOString(),
      author: t("contactList.activity.youAuthor"),
      type: "system"
    };
    setContacts(prev => prev.map(c => {
      if (c.id === selectedContactForDeal.id) {
        return {
          ...c,
          status: "has_open_opportunity",
          activities: [createOppAct, ...(c.activities || [])]
        };
      }
      return c;
    }));
    setSelectedContactForDeal(null);
    const actualOwnerName = resolveWorkspaceMemberName(createdDeal.ownerId);
    const customerNotice = !targetCustId
      ? (locale === "vi" ? " Liên hệ chưa được gắn với hồ sơ khách hàng." : " The contact is not linked to a customer profile yet.")
      : "";
    notifyProduct(
      locale === "vi"
        ? `Đã tạo cơ hội ${createdDeal.name} và giao cho ${actualOwnerName}.${customerNotice}`
        : `Opportunity ${createdDeal.name} was created and assigned to ${actualOwnerName}.${customerNotice}`,
      !targetCustId ? "warning" : "success",
      {
        actionLabel: locale === "vi" ? "Mở chi tiết" : "Open record",
        onAction: () => navigate(`/deals/${createdDeal.id}`),
        durationMs: 7000,
      },
    );
  };
  // `contact.archive` / `contact.restore` are BLOCKED canonical commands: refuse before the
  // confirmation dialog rather than after the user has committed to the action.
  const refuseUnavailableContactRetention = (action: string): boolean => {
    if (!isContactRetentionUnavailable()) return false;
    showToast(backendUnavailableMessage({ locale, action }));
    return true;
  };

  const handleArchiveContact = (contact: Contact) => {
    if (refuseUnavailableContactRetention(locale === "vi" ? "Lưu trữ liên hệ" : "Archiving a Contact")) {
      setActiveMenuContactId(null);
      return;
    }
    requestConfirmation(
      tx("contactList.confirm.archiveContactTitle", "Lưu trữ liên hệ"),
      tx("contactList.confirm.archiveContact", `Lưu trữ liên hệ "${contact.name}"? Hồ sơ và lịch sử vẫn được giữ lại.`, { name: contact.name }),
      async () => {
        await archiveContactViaApi(contact.id);
        setSelectedContactIds(prev => prev.filter(id => id !== contact.id));
        showToast(tx("contactList.toast.contactArchived", "Đã lưu trữ liên hệ; hồ sơ và lịch sử vẫn được giữ lại."));
      }
    );
    setActiveMenuContactId(null);
  };
  const handleToggleArchiveContact = async (contact: Contact) => {
    if (refuseUnavailableContactRetention(contact.status === "archived"
      ? (locale === "vi" ? "Khôi phục liên hệ" : "Restoring a Contact")
      : (locale === "vi" ? "Lưu trữ liên hệ" : "Archiving a Contact"))) return;
    const actorId = contact.ownerId || "current-user";
    if (contact.status === "archived") {
      await restoreContactCommand(contact.id, { actorId, actorName: resolveWorkspaceMemberName(actorId), reason: locale === "vi" ? "Khôi phục từ danh sách lưu trữ." : "Restored from archive." });
      showToast(tx("contactList.toastMessage.restored", "Đã khôi phục liên hệ thành công"));
      return;
    }
    await archiveContactViaApi(contact.id);
    showToast(tx("contactList.toastMessage.archived", "Đã chuyển liên hệ vào danh sách lưu trữ"));
  };
  const handleBulkExport = () => {
    setIsHeaderMoreOpen(false);
    const targetContacts = selectedContactIds.length > 0
      ? contacts.filter(c => selectedContactIds.includes(c.id))
      : contacts;
    // Simulate generation/export of JSON
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(targetContacts, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `UnicoreCRM-Contacts-Export-${new Date().toISOString().substring(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast(tx("contactList.toastMessage.exportedCount", `Đã xuất dữ liệu thành công cho ${targetContacts.length} liên hệ!`, { count: targetContacts.length }));
  };
  const handleDownloadTemplate = () => {
    setIsHeaderMoreOpen(false);
    const headers = ["full_name", "email", "phone", "company_name", "title", "department", "source", "priority", "tags"];
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\nNguyen Van A,vana@example.com,0987654321,Cong ty TNHH A,Giam Doc,Kinh Doanh,website,HIGH,KHACH_HANG_TIEM_NANG";
    const encodedUri = encodeURI(csvContent);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", encodedUri);
    downloadAnchor.setAttribute("download", "Import_Contacts_Template.csv");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast(tx("contactList.toastMessage.templateDownloaded", "Đã tải file mẫu thành công!"));
  };
  // 3. Filtering & Sorting Local Handler
  const filteredContacts = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().substring(0, 10);
    const currentUserId = getWorkspaceMemberOptions()[0]?.id || "";
    return contacts.filter(contact => {
      const clientCustomer = customers.find(c => c.id === findCustomerForContact(contact)?.id);
      const actualCustName = clientCustomer ? clientCustomer.displayName : (getCustomerDisplayNameForContact(contact) || "");
      const valuesToSearch = [
        contact.name,
        contact.fullName,
        contact.contactCode,
        contact.title,
        contact.department,
        contact.email,
        contact.phone,
        contact.source,
        actualCustName,
        ...(contact.tags || [])
      ].map(v => (v || "").toLowerCase());
      const isMatchSearch = valuesToSearch.some(val => val.includes(searchTerm.toLowerCase()));
      // Hide archived contacts from regular views unless we are explicitly on the Archived view or filtering status = archived
      const isArchived = contact.status === "archived";
      const isFilteringArchived = activeView === "archived" || statusFilter === "archived";
      if (isArchived && !isFilteringArchived) {
        return false;
      }
      if (!isArchived && activeView === "archived") {
        return false;
      }
      const isMatchStatus = statusFilter === "all" || contact.status === statusFilter;
      let isMatchLink = true;
      if (linkFilter === "linked") {
        isMatchLink = !!findCustomerForContact(contact)?.id;
      } else if (linkFilter === "unlinked") {
        isMatchLink = !findCustomerForContact(contact)?.id;
      }
      const isMatchSource = sourceFilter === "all" || contact.source === sourceFilter;
      const isMatchOwner = ownerFilter === "all" || contact.ownerId === ownerFilter;
      const isMatchPriority = priorityFilter === "all" || contact.priority === priorityFilter;
      // Advanced filters
      const isMatchRelationship = relationshipLevelFilter === "all" || contact.relationshipLevel === relationshipLevelFilter;
      const isMatchDecision = decisionRoleFilter === "all" || contact.decisionRole === decisionRoleFilter;
      let isMatchNextFollowUp = true;
      if (nextFollowUpAtFilter) {
        isMatchNextFollowUp = !!contact.nextFollowUpAt && contact.nextFollowUpAt.substring(0, 10) === nextFollowUpAtFilter;
      }
      let isMatchLastInteraction = true;
      if (lastInteractionAtFilter) {
        isMatchLastInteraction = !!contact.lastContactedAt && contact.lastContactedAt.substring(0, 10) === lastInteractionAtFilter;
      }
      let isMatchDnc = true;
      if (doNotContactFilter !== null) {
        isMatchDnc = !!contact.doNotContact === doNotContactFilter;
      }
      // Saved views custom rules
      let isMatchView = true;
      if (activeView === "myContacts") {
        isMatchView = contact.ownerId === currentUserId;
      } else if (activeView === "teamContacts") {
        isMatchView = contact.ownerId !== currentUserId && !!contact.ownerId;
      } else if (activeView === "needFollowUpToday") {
        isMatchView = !!contact.nextFollowUpAt && contact.nextFollowUpAt.substring(0, 10) === todayStr;
      } else if (activeView === "overdueFollowUp") {
        isMatchView = !!contact.nextFollowUpAt && new Date(contact.nextFollowUpAt.substring(0, 10)) < new Date(todayStr); // past and not today
      } else if (activeView === "inConsulting") {
        isMatchView = contact.status === "in_consulting";
      } else if (activeView === "hasOpenOpportunity") {
        isMatchView = contact.status === "has_open_opportunity" || (contact.openOpportunityCount || 0) > 0;
      } else if (activeView === "noOpportunityYet") {
        const hasDeals = deals.some(d => d.contactId === contact.id);
        isMatchView = !hasDeals && (contact.openOpportunityCount || 0) === 0;
      } else if (activeView === "nearClosing") {
        isMatchView = deals.some(d => d.contactId === contact.id && ["proposal", "negotiation", "PROPOSAL", "NEGOTIATION", "contract", "CONTRACT"].includes(d.stage));
      } else if (activeView === "becameCustomer") {
        isMatchView = Boolean(findCustomerForContact(contact));
      } else if (activeView === "doNotContact") {
        isMatchView = contact.status === "do_not_contact" || contact.doNotContact === true;
      } else if (activeView === "inactiveLongTime") {
        const lastActiveDate = contact.lastInteractionAt || contact.updatedAt || contact.createdAt;
        const lastIntTime = lastActiveDate ? new Date(lastActiveDate).getTime() : 0;
        const isOld = lastIntTime ? (now.getTime() - lastIntTime) > 90 * 24 * 60 * 60 * 1000 : false;
        isMatchView = contact.status === "inactive" || isOld;
      } else if (activeView === "duplicates") {
        isMatchView = contacts.some(other => {
          if (other.id === contact.id) return false;
          const samePhone = (contact.mobilePhone && other.mobilePhone && contact.mobilePhone === other.mobilePhone) ||
                            (contact.phone && other.phone && contact.phone === other.phone);
          const sameEmail = (contact.workEmail && other.workEmail && contact.workEmail === other.workEmail) ||
                            (contact.email && other.email && contact.email === other.email);
          return samePhone || sameEmail;
        });
      } else if (activeView === "archived") {
        isMatchView = contact.status === "archived";
      }
      return (
        isMatchSearch &&
        isMatchStatus &&
        isMatchLink &&
        isMatchSource &&
        isMatchOwner &&
        isMatchPriority &&
        isMatchRelationship &&
        isMatchDecision &&
        isMatchNextFollowUp &&
        isMatchLastInteraction &&
        isMatchDnc &&
        isMatchView
      );
    });
  }, [
    contacts, customers, searchTerm, statusFilter, linkFilter, sourceFilter, ownerFilter, priorityFilter,
    relationshipLevelFilter, decisionRoleFilter, nextFollowUpAtFilter, lastInteractionAtFilter, doNotContactFilter, activeView
  ]);
  const sortedContacts = useMemo(() => {
    return [...filteredContacts].sort((a, b) => {
      if (sortBy === "recentlyUpdated") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "nextFollowUp") {
        if (!a.nextFollowUpAt) return 1;
        if (!b.nextFollowUpAt) return -1;
        return new Date(a.nextFollowUpAt).getTime() - new Date(b.nextFollowUpAt).getTime();
      }
      if (sortBy === "lastContacted") {
        if (!a.lastContactedAt) return 1;
        if (!b.lastContactedAt) return -1;
        return new Date(b.lastContactedAt).getTime() - new Date(a.lastContactedAt).getTime();
      }
      if (sortBy === "nameAsc") {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });
  }, [filteredContacts, sortBy]);
  // Rich calculations for Contact statistics (on-demand via memo)
  const statsSummary = useMemo(() => {
    const total = contacts.length;
    const linked = contacts.filter((contact) => Boolean(findCustomerForContact(contact))).length;
    const unlinked = total - linked;
    const linkedRate = total > 0 ? (linked / total) * 100 : 0;
    const openOpps = deals.filter(
      (d) => d.contactId && d.stage !== "WON" && d.stage !== "LOST"
    );
    const totalOppValue = openOpps.reduce((sum, d) => sum + (d.amount || 0), 0);
    const hasOppCount = contacts.filter(c => deals.some(d => d.contactId === c.id)).length;
    const oppCreationRate = total > 0 ? (hasOppCount / total) * 100 : 0;
    const priorityCount = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 };
    const sourceCount: Record<string, number> = {};
    let overdueFups = 0;
    let upcomingFups = 0;
    let noFupScheduled = 0;
    const statusCount = {
      active: 0,
      needs_follow_up: 0,
      in_consulting: 0,
      has_open_opportunity: 0,
      inactive: 0,
      do_not_contact: 0,
      archived: 0
    };
    const now = new Date();
    contacts.forEach((c) => {
      const sType = c.status || "active";
      if (statusCount[sType] !== undefined) {
        statusCount[sType]++;
      } else {
        statusCount.active++;
      }
      const p = c.priority || "MEDIUM";
      if (priorityCount[p] !== undefined) {
        priorityCount[p]++;
      }
      const s = c.source || t("contactDetail.fields.noSource");
      sourceCount[s] = (sourceCount[s] || 0) + 1;
      if (!c.nextFollowUpAt) {
        noFupScheduled++;
      } else {
        const fDate = new Date(c.nextFollowUpAt);
        if (fDate < now) {
          overdueFups++;
        } else {
          upcomingFups++;
        }
      }
    });
    const needsFollowUpCount = statusCount.needs_follow_up;
    const overdueFollowUpCount = overdueFups;
    const inConsultingCount = statusCount.in_consulting;
    const openOpportunityCount = statusCount.has_open_opportunity;
    const becameCustomerCount = linked;
    const doNotContactCount = statusCount.do_not_contact;
    const followUpDueRate = total > 0 ? (needsFollowUpCount / total) * 100 : 0;
    const openOpportunityRate = total > 0 ? (openOpportunityCount / total) * 100 : 0;
    const becameCustomerRate = total > 0 ? (becameCustomerCount / total) * 100 : 0;
    const ownerStats = getWorkspaceMemberOptions().map((user) => {
      const userContacts = contacts.filter((c) => c.ownerId === user.id);
      const userOpps = deals.filter((d) => d.ownerId === user.id && d.stage !== "WON" && d.stage !== "LOST");
      const userOppsVal = userOpps.reduce((sum, d) => sum + (d.amount || 0), 0);
      const userClaimsFup = userContacts.filter((c) => {
        if (!c.nextFollowUpAt) return false;
        return new Date(c.nextFollowUpAt) < now;
      }).length;
      return {
        name: user.name,
        contactsCount: userContacts.length,
        needsFollowUp: userClaimsFup,
        openOpps: userOpps.length,
        oppsValue: userOppsVal,
      };
    }).filter((item) => item.contactsCount > 0);
    return {
      total,
      linked,
      unlinked,
      linkedRate,
      openOppsCount: openOpps.length,
      totalOppValue,
      statusCount,
      priorityCount,
      sourceCount,
      overdueFups,
      upcomingFups,
      noFupScheduled,
      ownerStats,
      needsFollowUpCount,
      overdueFollowUpCount,
      inConsultingCount,
      openOpportunityCount,
      becameCustomerCount,
      doNotContactCount,
      followUpDueRate,
      openOpportunityRate,
      becameCustomerRate,
      oppCreationRate
    };
  }, [contacts, deals, locale]);
  return {
    contactCreateAvailable,
    contactUpdateAvailable,
    canCreateContact,
    canUpdateContact,
    canArchiveContact,
    contactOpportunityAvailable,
    contactQuery,
    customers,
    deals,
    setDeals,
    crmConfig,
    t,
    tx,
    locale,
    navigate,
    contacts,
    setContacts,
    productCatalog,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    linkFilter,
    setLinkFilter,
    sourceFilter,
    setSourceFilter,
    ownerFilter,
    setOwnerFilter,
    priorityFilter,
    setPriorityFilter,
    sortBy,
    setSortBy,
    relationshipLevelFilter,
    setRelationshipLevelFilter,
    decisionRoleFilter,
    setDecisionRoleFilter,
    nextFollowUpAtFilter,
    setNextFollowUpAtFilter,
    lastInteractionAtFilter,
    setLastInteractionAtFilter,
    doNotContactFilter,
    setDoNotContactFilter,
    hasActiveFilters,
    activeFiltersCount,
    resetFilters,
    activeView,
    selectSavedView,
    isViewDropdownOpen,
    setIsViewDropdownOpen,
    customViews,
    isHeaderMoreOpen,
    setIsHeaderMoreOpen,
    isColumnSettingsOpen,
    setIsColumnSettingsOpen,
    visibleColumns,
    columnWidths,
    createCustomView,
    updateCustomView,
    deleteCustomView,
    saveColumnSettings,
    resetColumnSettings,
    resizeColumn,
    resetColumnWidth,
    viewMode,
    setViewMode,
    showStatisticsPanel,
    setShowStatisticsPanel,
    isFilterOpen,
    setIsFilterOpen,
    savedViewDialog,
    setSavedViewDialog,
    viewName,
    setViewName,
    viewNameError,
    setViewNameError,
    isSavingView,
    setIsSavingView,
    viewSaveInFlightRef,
    viewToDelete,
    setViewToDelete,
    selectedContactIds,
    setSelectedContactIds,
    openRowActionId,
    setOpenRowActionId,
    showBulkReassignModal,
    setShowBulkReassignModal,
    getCurrentViewSnapshot,
    applySavedPresentationState,
    getActiveCustomView,
    handleSelectSavedView,
    closeSavedViewDialog,
    handleAddViewClick,
    handleEditViewClick,
    handleSubmitSavedView,
    handleDeleteCustomView,
    handleResetFilters,
    handleSaveColumnSettings,
    handleResetColumnSettings,
    handleColumnResize,
    handleColumnReset,
    handleSelectRow,
    handleSelectAll,
    handleBulkChangeOwner,
    handleBulkChangeStatus,
    confirmModal,
    isConfirming,
    setConfirmModal,
    promptModal,
    setPromptModal,
    requestConfirmation,
    requestPrompt,
    handleBulkDelete,
    handleBulkArchive,
    handleBulkAddTags,
    handleBulkDoNotContact,
    activeMenuContactId,
    setActiveMenuContactId,
    toastMessage,
    setToastMessage,
    dropdownRef,
    showAddForm,
    setShowAddForm,
    isHeaderMenuOpen,
    setIsHeaderMenuOpen,
    selectedContactForDeal,
    setSelectedContactForDeal,
    showToast,
    handleSaveContact,
    handleCall,
    handleEmail,
    handleCommitOpportunity,
    handleArchiveContact,
    handleToggleArchiveContact,
    handleBulkExport,
    handleDownloadTemplate,
    filteredContacts,
    sortedContacts,
    statsSummary,
  };
}
