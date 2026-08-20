import React from "react";
import {
  BriefcaseBusiness,
  CheckSquare,
  HeartHandshake,
  LayoutDashboard,
  Paperclip,
  ReceiptText,
  UsersRound,
} from "lucide-react";
import { ResponsiveTabs, type TabItem } from "@/shared/components/ui";
import { DetailPanelToggle } from "@/components/detail/DetailPanelToggle";
import { useI18n } from "@/i18n";

export type RelationshipDetailTab =
  | "overview"
  | "relationship"
  | "sales"
  | "transactions"
  | "service"
  | "work"
  | "attachments";

export type RelationshipDetailCounts = Partial<Record<RelationshipDetailTab, number>>;

interface RelationshipDetailTabsProps {
  activeTab: RelationshipDetailTab;
  onChange(tab: RelationshipDetailTab): void;
  counts?: RelationshipDetailCounts;
  isRightPanelVisible: boolean;
  onToggleRightPanel(): void;
  motionId: string;
  panelLabel?: { visible: string; hidden: string };
}

export const RelationshipDetailTabs: React.FC<RelationshipDetailTabsProps> = ({
  activeTab,
  onChange,
  counts = {},
  isRightPanelVisible,
  onToggleRightPanel,
  motionId,
  panelLabel,
}) => {
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const badge = (id: RelationshipDetailTab) => {
    const count = counts[id] ?? 0;
    return count > 0 ? count : undefined;
  };
  const items: TabItem[] = [
    { id: "overview", label: isVi ? "Tổng quan" : "Overview", icon: <LayoutDashboard size={14} /> },
    { id: "relationship", label: isVi ? "Quan hệ" : "Relationship", icon: <UsersRound size={14} />, badge: badge("relationship") },
    { id: "sales", label: isVi ? "Bán hàng" : "Sales", icon: <BriefcaseBusiness size={14} />, badge: badge("sales") },
    { id: "transactions", label: isVi ? "Giao dịch" : "Transactions", icon: <ReceiptText size={14} />, badge: badge("transactions") },
    { id: "service", label: isVi ? "Dịch vụ" : "Service", icon: <HeartHandshake size={14} />, badge: badge("service") },
    { id: "work", label: isVi ? "Công việc" : "Work", icon: <CheckSquare size={14} />, badge: badge("work") },
    { id: "attachments", label: isVi ? "Tài liệu" : "Attachments", icon: <Paperclip size={14} />, badge: badge("attachments") },
  ];

  return (
    <div className="flex min-w-0 items-center gap-2 border-b border-slate-100 bg-slate-50/50 pr-2">
      <div className="min-w-0 flex-1">
        <ResponsiveTabs
          items={items}
          activeId={activeTab}
          onChange={(id) => onChange(id as RelationshipDetailTab)}
          className="border-b-0 bg-transparent"
          overflowMode="dropdown"
          motionId={motionId}
          reflowKey={isRightPanelVisible}
        />
      </div>
      <DetailPanelToggle
        isPanelVisible={isRightPanelVisible}
        onToggle={onToggleRightPanel}
        visibleLabel={panelLabel?.visible ?? (isVi ? "Ẩn bảng tương tác" : "Hide interaction panel")}
        hiddenLabel={panelLabel?.hidden ?? (isVi ? "Hiện bảng tương tác" : "Show interaction panel")}
      />
    </div>
  );
};
