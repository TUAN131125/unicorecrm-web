import React from "react";
import {
  RelationshipDetailTabs,
  type RelationshipDetailCounts,
  type RelationshipDetailTab,
} from "@/components/crm/relationship-detail";

export type CustomerDetailTab = RelationshipDetailTab;

export interface CustomerDetailTarget {
  tab: CustomerDetailTab;
  subTab?: string;
}

interface CustomerDetailTabsProps {
  activeTab: CustomerDetailTab;
  setActiveTab(tab: CustomerDetailTab): void;
  counts: RelationshipDetailCounts;
  isRightPanelVisible: boolean;
  onToggleRightPanel(): void;
}

export const CustomerDetailTabs: React.FC<CustomerDetailTabsProps> = ({
  activeTab,
  setActiveTab,
  counts,
  isRightPanelVisible,
  onToggleRightPanel,
}) => (
  <RelationshipDetailTabs
    activeTab={activeTab}
    onChange={setActiveTab}
    counts={counts}
    isRightPanelVisible={isRightPanelVisible}
    onToggleRightPanel={onToggleRightPanel}
    motionId="customer-primary-tabs"
  />
);
