import React from "react";
import { ColumnSettingsDrawer } from "@/components/crm/ColumnSettingsDrawer";

interface LeadColumnSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  allFields: readonly string[];
  visibleColumns: string[];
  onSave: (columns: any[]) => void;
  onResetDefault: () => void;
}

export const LeadColumnSettingsDrawer: React.FC<LeadColumnSettingsDrawerProps> = ({
  isOpen,
  onClose,
  allFields,
  visibleColumns,
  onSave,
  onResetDefault
}) => {
  return (
    <ColumnSettingsDrawer
      isOpen={isOpen}
      onClose={onClose}
      allFields={[...allFields]}
      visibleColumns={visibleColumns}
      onSave={onSave}
      onResetDefault={onResetDefault}
      translationPrefix="leads"
    />
  );
};
