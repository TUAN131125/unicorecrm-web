import React from "react";
import { ColumnSettingsDrawer } from "@/components/crm/ColumnSettingsDrawer";

interface ContactColumnSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  allFields: string[];
  visibleColumns: string[];
  onSave: (columns: any[]) => void;
  onResetDefault: () => void;
}

export const ContactColumnSettingsDrawer: React.FC<ContactColumnSettingsDrawerProps> = ({
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
      allFields={allFields}
      visibleColumns={visibleColumns}
      onSave={onSave}
      onResetDefault={onResetDefault}
      translationPrefix="contacts"
    />
  );
};
