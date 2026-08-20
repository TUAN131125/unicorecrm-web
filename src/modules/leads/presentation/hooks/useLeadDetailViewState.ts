import { useState } from "react";
import type { CRMActivity } from "@/shared/domain";

import { getLeadPreference, removeLeadPreference, setLeadPreference } from "../../public/leads";
import type { LeadTimelineFilter } from "../components/LeadDetailActivityPanel";

export type LeadDetailTab =
  | "details"
  | "notes"
  | "attachments"
  | "products"
  | "campaigns"
  | "email"
  | "sms"
  | "open_activities"
  | "completed_activities"
  | "care_cases"
  | "others";

export interface LeadAttachmentItem {
  id: string;
  name: string;
  type: string;
  size: string;
  createdAt: string;
  url?: string;
  category?: string;
  description?: string;
  file?: File;
}

const INITIAL_ATTACHMENTS: LeadAttachmentItem[] = [
  { id: "att-1", name: "Ban_Khao_Sat_Yeu_Cau_CoreCRM.pdf", type: "PDF", size: "1.4 MB", createdAt: "12/06/2026", url: "#" },
  { id: "att-2", name: "Bao_Gia_UnicoreCRM_Cloud_SaaS.xlsx", type: "Excel", size: "2.1 MB", createdAt: "14/06/2026", url: "#" },
];

export function useLeadDetailViewState() {
  const [activeTab, setActiveTab] = useState<LeadDetailTab>("details");
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");
  const [showEmptyFields, setShowEmptyFields] = useState(false);
  const [isRightPanelVisible, setIsRightPanelVisible] = useState(() =>
    getLeadPreference<boolean>("centrix_lead_right_panel_visible", true),
  );
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showAttachmentForm, setShowAttachmentForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<CRMActivity | null>(null);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<LeadTimelineFilter>("all");
  const [attachments, setAttachments] = useState<LeadAttachmentItem[]>(INITIAL_ATTACHMENTS);
  const [newLinkName, setNewLinkName] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");

  const toggleRightPanel = () => {
    setIsRightPanelVisible((current) => {
      const next = !current;
      setLeadPreference("centrix_lead_right_panel_visible", next);
      return next;
    });
  };

  return {
    activeTab, setActiveTab,
    isProductPickerOpen, setIsProductPickerOpen,
    fieldSearch, setFieldSearch,
    showEmptyFields, setShowEmptyFields,
    isRightPanelVisible, toggleRightPanel,
    showNoteForm, setShowNoteForm,
    showAttachmentForm, setShowAttachmentForm,
    showProductForm, setShowProductForm,
    showCampaignForm, setShowCampaignForm,
    showMoreMenu, setShowMoreMenu,
    selectedActivity, setSelectedActivity,
    isFilterExpanded, setIsFilterExpanded,
    timelineFilter, setTimelineFilter,
    attachments, setAttachments,
    newLinkName, setNewLinkName,
    newLinkUrl, setNewLinkUrl,
  };
}
