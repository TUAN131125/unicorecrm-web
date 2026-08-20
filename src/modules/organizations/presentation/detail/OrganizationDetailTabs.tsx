import React from "react";
import {
  RelationshipDetailTabs,
  type RelationshipDetailCounts,
  type RelationshipDetailTab,
} from "@/components/crm/relationship-detail";

export type OrganizationDetailTab = RelationshipDetailTab;

interface OrganizationDetailTabsProps {
  activeTab: OrganizationDetailTab;
  onChange(tab: OrganizationDetailTab): void;
  counts: RelationshipDetailCounts;
  isRightPanelVisible: boolean;
  onToggleRightPanel(): void;
}

export const OrganizationDetailTabs: React.FC<OrganizationDetailTabsProps> = ({
  activeTab,
  onChange,
  counts,
  isRightPanelVisible,
  onToggleRightPanel,
}) => (
  <RelationshipDetailTabs
    activeTab={activeTab}
    onChange={onChange}
    counts={counts}
    isRightPanelVisible={isRightPanelVisible}
    onToggleRightPanel={onToggleRightPanel}
    motionId="organization-primary-tabs"
  />
);
