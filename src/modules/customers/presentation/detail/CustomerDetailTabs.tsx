import React from "react";
import { useI18n } from "@/i18n";
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
  visibleTabs?: readonly CustomerDetailTab[];
}

export const CustomerDetailTabs: React.FC<CustomerDetailTabsProps> = ({
  activeTab,
  setActiveTab,
  counts,
  isRightPanelVisible,
  onToggleRightPanel,
  visibleTabs,
}) => {
  const { locale } = useI18n();
  return (
  <RelationshipDetailTabs
    activeTab={activeTab}
    onChange={setActiveTab}
    counts={counts}
    isRightPanelVisible={isRightPanelVisible}
    onToggleRightPanel={onToggleRightPanel}
    motionId="customer-primary-tabs"
    visibleTabs={visibleTabs}
    panelLabel={{ visible: locale === "vi" ? "Ẩn bảng quan hệ" : "Hide relationship panel", hidden: locale === "vi" ? "Hiện bảng quan hệ" : "Show relationship panel" }}
  />
  );
};
