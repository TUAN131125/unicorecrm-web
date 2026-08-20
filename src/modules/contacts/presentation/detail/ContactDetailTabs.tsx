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
  const { tx } = useI18n();
  return (
    <RelationshipDetailTabs
      activeTab={activeTab}
      onChange={setActiveTab}
      counts={counts}
      isRightPanelVisible={isRightPanelVisible}
      onToggleRightPanel={onToggleRightPanel}
      motionId="contact-primary-tabs"
      panelLabel={{
        visible: tx("contactDetail.panel.hide", "Ẩn lịch sử tương tác"),
        hidden: tx("contactDetail.panel.show", "Hiện lịch sử tương tác"),
      }}
    />
  );
};
