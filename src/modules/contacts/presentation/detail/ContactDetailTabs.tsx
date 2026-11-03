import React from "react";
import {
  RelationshipDetailTabs,
  type RelationshipDetailCounts,
  type RelationshipDetailTab,
} from "@/components/crm/relationship-detail";
import { useI18n } from "@/i18n";
import { useEffectiveAccess } from "@/platform/access-control";
import { isContactConnectedMode } from "../../public/contacts";

export type ContactTab = RelationshipDetailTab;

interface ContactDetailTabsProps {
  activeTab: ContactTab;
  setActiveTab(tab: ContactTab): void;
  counts: RelationshipDetailCounts;
  isRightPanelVisible: boolean;
  onToggleRightPanel(): void;
}

export const ContactDetailTabs: React.FC<ContactDetailTabsProps> = ({
  activeTab,
  setActiveTab,
  counts,
  isRightPanelVisible,
  onToggleRightPanel,
}) => {
  const { locale } = useI18n();
  const access = useEffectiveAccess();
  const visibleTabs: ContactTab[] = ["overview", "relationship"];
  if (access.can("deals.read") || access.can("quotes.read")) visibleTabs.push("sales");
  if (access.can("orders.read") || access.can("invoices.read") || access.can("payments.read") || access.can("receivables.read")) visibleTabs.push("transactions");
  if (access.can("support.read")) visibleTabs.push("service");
  if (access.can("tasks.read")) visibleTabs.push("work");
  return (
    <RelationshipDetailTabs
      activeTab={activeTab}
      visibleTabs={isContactConnectedMode() ? visibleTabs : undefined}
      onChange={setActiveTab}
      counts={counts}
      isRightPanelVisible={isRightPanelVisible}
      onToggleRightPanel={onToggleRightPanel}
      motionId="contact-primary-tabs"
      panelLabel={{
        visible: locale === "vi" ? "Ẩn bảng quan hệ" : "Hide relationship panel",
        hidden: locale === "vi" ? "Hiện bảng quan hệ" : "Show relationship panel",
      }}
    />
  );
};
