import React from "react";
import {
  RelationshipDetailTabs,
  type RelationshipDetailCounts,
  type RelationshipDetailTab,
} from "@/components/crm/relationship-detail";
import { useI18n } from "@/i18n";

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
  return (
    <RelationshipDetailTabs
      activeTab={activeTab}
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
