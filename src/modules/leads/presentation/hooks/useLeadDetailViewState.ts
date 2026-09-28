import { useState } from "react";

import { getLeadPreference, removeLeadPreference, setLeadPreference } from "../../public/leads";

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

export function useLeadDetailViewState() {
  const [activeTab, setActiveTab] = useState<LeadDetailTab>("details");
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");
  const [showEmptyFields, setShowEmptyFields] = useState(false);
  const [isRightPanelVisible, setIsRightPanelVisible] = useState(() =>
    getLeadPreference<boolean>("centrix_lead_right_panel_visible", true),
  );
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

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
    showProductForm, setShowProductForm,
    showCampaignForm, setShowCampaignForm,
    showMoreMenu, setShowMoreMenu,
  };
}
