import { useState, useCallback, useRef } from "react";

export const useLeadDialogs = (
  selectedLeadIds: string[],
  showToast: (msg: string) => void,
  locale: string,
  defaultReassignOwnerId = "",
) => {
  // Modal Boolean states
  const [isNewLeadOpen, setIsNewLeadOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isDisqualifyModalOpen, rawsetIsDisqualifyModalOpen] = useState(false);
  const isDisqualifyModalOpenTargets = useRef<string[]>([]);
  const setIsDisqualifyModalOpen = (open: boolean) => { if (open && !isDisqualifyModalOpen) isDisqualifyModalOpenTargets.current = [...selectedLeadIds]; rawsetIsDisqualifyModalOpen(open); };
  const [disqualifyLeadId, setDisqualifyLeadId] = useState<string | null>(null);
  const [isFollowUpModalOpen, rawsetIsFollowUpModalOpen] = useState(false);
  const isFollowUpModalOpenTargets = useRef<string[]>([]);
  const setIsFollowUpModalOpen = (open: boolean) => { if (open && !isFollowUpModalOpen) isFollowUpModalOpenTargets.current = [...selectedLeadIds]; rawsetIsFollowUpModalOpen(open); };
  const [followUpLeadId, setFollowUpLeadId] = useState<string | null>(null);
  const [isBulkUpdateOpen, rawsetIsBulkUpdateOpen] = useState(false);
  const isBulkUpdateOpenTargets = useRef<string[]>([]);
  const setIsBulkUpdateOpen = (open: boolean) => { if (open && !isBulkUpdateOpen) isBulkUpdateOpenTargets.current = [...selectedLeadIds]; rawsetIsBulkUpdateOpen(open); };
  const [bulkUpdateStatus, setBulkUpdateStatus] = useState("");
  const [bulkUpdateOwner, setBulkUpdateOwner] = useState("");
  const [isManageTagsModalOpen, rawsetIsManageTagsModalOpen] = useState(false);
  const isManageTagsModalOpenTargets = useRef<string[]>([]);
  const setIsManageTagsModalOpen = (open: boolean) => { if (open && !isManageTagsModalOpen) isManageTagsModalOpenTargets.current = [...selectedLeadIds]; rawsetIsManageTagsModalOpen(open); };
  const [showArchiveConfirm, rawsetShowArchiveConfirm] = useState(false);
  const showArchiveConfirmTargets = useRef<string[]>([]);
  const setShowArchiveConfirm = (open: boolean) => { if (open && !showArchiveConfirm) showArchiveConfirmTargets.current = [...selectedLeadIds]; rawsetShowArchiveConfirm(open); };
  const [leadToArchive, setLeadToArchive] = useState<string | null>(null);
  const [isReassignModalOpen, rawsetIsReassignModalOpen] = useState(false);
  const isReassignModalOpenTargets = useRef<string[]>([]);
  const setIsReassignModalOpen = (open: boolean) => { if (open && !isReassignModalOpen) isReassignModalOpenTargets.current = [...selectedLeadIds]; rawsetIsReassignModalOpen(open); };
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
  }, [selectedLeadIds]);

  const handleOpenFollowUp = useCallback((leadId: string | null) => {
    setFollowUpLeadId(leadId);
    setIsFollowUpModalOpen(true);
  }, [selectedLeadIds]);

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
    auxiliaryTargets: {
      disqualify: isDisqualifyModalOpenTargets.current, followUp: isFollowUpModalOpenTargets.current,
      update: isBulkUpdateOpenTargets.current, tags: isManageTagsModalOpenTargets.current,
      archive: showArchiveConfirmTargets.current, reassign: isReassignModalOpenTargets.current,
    },
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

    // Archive confirmation
    showArchiveConfirm,
    setShowArchiveConfirm,
    leadToArchive,
    setLeadToArchive,

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
