import React, { useState } from "react";
import { 
  MoreVertical, 
  FileText, 
  Printer, 
  UserPlus, 
  Tag, 
  Archive, 
  Trash2, 
  Share2, 
  Download, 
  UploadCloud, 
  ShieldAlert 
} from "lucide-react";
import { useI18n } from "@/i18n";
import { ActionDropdown, ActionDropdownSection, ActionDropdownItem } from "@/components/crm/ActionDropdown";
import { PageHeaderMoreButton } from "@/components/crm/PageHeaderActions";

export type ContactTopActionMenuProps = {
  selectedCount: number;
  writesAvailable: boolean;
  importsAvailable: boolean;
  onExportAll: () => void;
  onPrintList: () => void;
  onBulkChangeOwner: () => void;
  onBulkAddTags: () => void;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
  onManageSharing: () => void;
  onManageTags: () => void;
  onOpenTrash: () => void;
  onDownloadImportTemplate: () => void;
  onAdvancedImport: () => void;
};

export const ContactTopActionMenu: React.FC<ContactTopActionMenuProps> = ({
  selectedCount,
  writesAvailable,
  importsAvailable,
  onExportAll,
  onPrintList,
  onBulkChangeOwner,
  onBulkAddTags,
  onBulkArchive,
  onBulkDelete,
  onManageSharing,
  onManageTags,
  onOpenTrash,
  onDownloadImportTemplate,
  onAdvancedImport
}) => {
  const { t, tx } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const hasSelected = selectedCount > 0;

  const getSections = (): ActionDropdownSection[] => {
    return [
      {
        id: "general",
        title: t("contactList.actions.moreActions"),
        items: [
          {
            id: "export",
            label: t("contactList.actions.exportAll"),
            icon: <FileText size={13} />,
            onClick: onExportAll
          },
          {
            id: "print",
            label: t("contactList.actions.printList"),
            icon: <Printer size={13} />,
            onClick: onPrintList
          }
        ]
      },
      {
        id: "bulk-actions",
        title: `${t("contactList.bulk.bulkActions")}${hasSelected ? ` (${selectedCount})` : ""}`,
        items: [
          {
            id: "bulk-owner",
            label: t("contactList.actions.bulkChangeOwner"),
            icon: <UserPlus size={13} />,
            disabled: !hasSelected,
            onClick: onBulkChangeOwner
          },
          {
            id: "bulk-tags",
            label: t("contactList.actions.bulkAddTags"),
            icon: <Tag size={13} />,
            disabled: !hasSelected,
            onClick: onBulkAddTags
          },
          {
            id: "bulk-archive",
            label: t("contactList.actions.bulkArchive"),
            icon: <Archive size={13} />,
            disabled: !hasSelected,
            onClick: onBulkArchive
          },
          {
            id: "bulk-delete",
            label: t("contactList.actions.bulkDelete"),
            icon: <Trash2 size={13} />,
            destructive: true,
            disabled: !hasSelected,
            onClick: onBulkDelete
          }
        ].map((item) => ({ ...item, hidden: !writesAvailable }))
      },
      {
        id: "config",
        title: tx("contacts.columnSettings.title", "Cấu hình"),
        items: [
          {
            id: "sharing",
            label: t("contactList.actions.manageSharing"),
            icon: <Share2 size={13} />,
            onClick: onManageSharing,
            hidden: !writesAvailable,
          },
          {
            id: "tags",
            label: t("contactList.actions.manageTags"),
            icon: <Tag size={13} />,
            onClick: onManageTags,
            hidden: !writesAvailable,
          },
          {
            id: "trash-archived",
            label: t("contactList.actions.trashArchived"),
            icon: <ShieldAlert size={13} />,
            onClick: onOpenTrash
          }
        ]
      },
      {
        id: "excel",
        title: "EXCEL OPERATIONS",
        items: [
          {
            id: "download-template",
            label: t("contactList.actions.downloadImportTemplate"),
            icon: <Download size={13} />,
            onClick: onDownloadImportTemplate
          },
          {
            id: "advanced-import",
            label: t("contactList.actions.advancedImport"),
            icon: <UploadCloud size={13} />,
            onClick: onAdvancedImport,
            hidden: !importsAvailable,
          }
        ]
      }
    ];
  };

  return (
    <div className="relative inline-block text-left">
      <PageHeaderMoreButton
        active={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setAnchorEl(e.currentTarget);
          setIsOpen(!isOpen);
        }}
        title={t("contactList.actions.moreActions")}
      />

      <ActionDropdown
        isOpen={isOpen}
        anchorRef={anchorEl}
        onClose={() => {
          setIsOpen(false);
          setAnchorEl(null);
        }}
        sections={getSections()}
        width={240}
      />
    </div>
  );
};
