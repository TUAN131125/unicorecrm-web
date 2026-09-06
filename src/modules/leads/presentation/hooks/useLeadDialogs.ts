import { useState, useCallback } from "react";

export const useLeadDialogs = (
  selectedLeadIds: string[],
  showToast: (msg: string) => void,
  locale: string,
  defaultReassignOwnerId = "",
) => {
  // Modal Boolean states
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDisqualifyModalOpen, setIsDisqualifyModalOpen] = useState(false);
  const [disqualifyLeadId, setDisqualifyLeadId] = useState<string | null>(null);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpLeadId, setFollowUpLeadId] = useState<string | null>(null);
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [bulkUpdateStatus, setBulkUpdateStatus] = useState("");
  const [bulkUpdateOwner, setBulkUpdateOwner] = useState("");
  const [isManageTagsModalOpen, setIsManageTagsModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [selectedReassignOwnerId, setSelectedReassignOwnerId] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Dropdown states
  const [isHeaderMoreOpen, setIsHeaderMoreOpen] = useState(false);
  const [headerMoreAnchorEl, setHeaderMoreAnchorEl] = useState<HTMLElement | null>(null);
  const [openRowActionId, setOpenRowActionId] = useState<string | null>(null);

  // Helper methods
  const handleOpenDisqualify = useCallback((leadId: string | null) => {
    setDisqualifyLeadId(leadId);
    setIsDisqualifyModalOpen(true);
  }, []);

  const handleOpenFollowUp = useCallback((leadId: string | null) => {
    setFollowUpLeadId(leadId);
    setIsFollowUpModalOpen(true);
  }, []);

  const handleBulkReassign = useCallback(() => {
    if (selectedLeadIds.length === 0) {
      showToast(locale === "vi" ? "Vui lòng chọn ít nhất một tiềm năng" : "Please select at least one lead");
      return;
    }
    setSelectedReassignOwnerId(defaultReassignOwnerId);
    setReassignReason("");
    setIsReassignModalOpen(true);
  }, [defaultReassignOwnerId, selectedLeadIds, showToast, locale]);

  return {
    // New Lead
    isNewLeadOpen,
    setIsNewLeadOpen,

    // Import
    isImportOpen,
    setIsImportOpen,

    // Disqualify
    isDisqualifyModalOpen,
    setIsDisqualifyModalOpen,
    disqualifyLeadId,
    setDisqualifyLeadId,
    handleOpenDisqualify,

    // Follow Up
    isFollowUpModalOpen,
    setIsFollowUpModalOpen,
    followUpLeadId,
    setFollowUpLeadId,
    handleOpenFollowUp,

    // Bulk Update
    isBulkUpdateOpen,
    setIsBulkUpdateOpen,
    bulkUpdateStatus,
    setBulkUpdateStatus,
    bulkUpdateOwner,
    setBulkUpdateOwner,

    // Manage Tags
    isManageTagsModalOpen,
    setIsManageTagsModalOpen,

    // Delete confirmation
    showDeleteConfirm,
    setShowDeleteConfirm,
    leadToDelete,
    setLeadToDelete,
    archiveReason,
    setArchiveReason,

    // Reassign
    isReassignModalOpen,
    setIsReassignModalOpen,
    selectedReassignOwnerId,
    setSelectedReassignOwnerId,
    reassignReason,
    setReassignReason,
    handleBulkReassign,

    // Filter drawer
    isFilterOpen,
    setIsFilterOpen,

    // Dropdowns
    isHeaderMoreOpen,
    setIsHeaderMoreOpen,
    headerMoreAnchorEl,
    setHeaderMoreAnchorEl,
    openRowActionId,
    setOpenRowActionId,
  };
};
