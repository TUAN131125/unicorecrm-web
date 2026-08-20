import React, { useState } from "react";
import { Archive, Download, FileText, HeartPulse, Printer, UploadCloud, Waypoints } from "lucide-react";
import { ActionDropdown, type ActionDropdownSection } from "@/components/crm/ActionDropdown";
import { PageHeaderMoreButton } from "@/components/crm/PageHeaderActions";
import { useI18n } from "@/i18n";

interface CustomerTopActionMenuProps {
  selectedCount: number;
  onExportAll(): void;
  onPrintList(): void;
  onBulkArchive(): void;
  onOpenSegments(): void;
  onOpenHealth(): void;
  onOpenArchived(): void;
  onDownloadImportTemplate(): void;
  onAdvancedImport(): void;
}

export const CustomerTopActionMenu: React.FC<CustomerTopActionMenuProps> = ({
  selectedCount,
  onExportAll,
  onPrintList,
  onBulkArchive,
  onOpenSegments,
  onOpenHealth,
  onOpenArchived,
  onDownloadImportTemplate,
  onAdvancedImport,
}) => {
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const [isOpen, setIsOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const sections: ActionDropdownSection[] = [
    {
      id: "general",
      title: isVi ? "THAO TÁC KHÁC" : "MORE ACTIONS",
      items: [
        { id: "export", label: isVi ? "Xuất toàn bộ" : "Export all", icon: <FileText size={13} />, onClick: onExportAll },
        { id: "print", label: isVi ? "In danh sách" : "Print list", icon: <Printer size={13} />, onClick: onPrintList },
      ],
    },
    {
      id: "bulk-actions",
      title: `${isVi ? "THAO TÁC HÀNG LOẠT" : "BULK ACTIONS"}${selectedCount > 0 ? ` (${selectedCount})` : ""}`,
      items: [
        { id: "bulk-archive", label: isVi ? "Lưu trữ đã chọn" : "Archive selected", icon: <Archive size={13} />, disabled: selectedCount === 0, onClick: onBulkArchive },
      ],
    },
    {
      id: "customer-center",
      title: isVi ? "TRUNG TÂM KHÁCH HÀNG" : "CUSTOMER CENTER",
      items: [
        { id: "segments", label: isVi ? "Quản lý phân khúc" : "Manage segments", icon: <Waypoints size={13} />, onClick: onOpenSegments },
        { id: "health", label: isVi ? "Sức khỏe khách hàng" : "Customer health", icon: <HeartPulse size={13} />, onClick: onOpenHealth },
        { id: "archived", label: isVi ? "Khách hàng đã lưu trữ" : "Archived customers", icon: <Archive size={13} />, onClick: onOpenArchived },
      ],
    },
    {
      id: "import",
      title: "EXCEL OPERATIONS",
      items: [
        { id: "download-template", label: isVi ? "Tải mẫu nhập liệu" : "Download import template", icon: <Download size={13} />, onClick: onDownloadImportTemplate },
        { id: "advanced-import", label: isVi ? "Nhập liệu nâng cao" : "Advanced import", icon: <UploadCloud size={13} />, onClick: onAdvancedImport },
      ],
    },
  ];

  return (
    <div className="relative inline-block text-left">
      <PageHeaderMoreButton
        active={isOpen}
        onClick={(event) => {
          event.stopPropagation();
          setAnchorEl(event.currentTarget);
          setIsOpen(!isOpen);
        }}
        title={isVi ? "Thao tác khác" : "More actions"}
      />
      <ActionDropdown
        isOpen={isOpen}
        anchorRef={anchorEl}
        onClose={() => { setIsOpen(false); setAnchorEl(null); }}
        sections={sections}
        width={240}
      />
    </div>
  );
};
