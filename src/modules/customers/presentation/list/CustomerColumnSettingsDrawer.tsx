import React from "react";
import { ColumnSettingsDrawer } from "@/components/crm/ColumnSettingsDrawer";
import { useI18n } from "@/i18n";
import { customerColumnLabel } from "./customerList.helpers";

interface CustomerColumnSettingsDrawerProps {
  isOpen: boolean;
  onClose(): void;
  allFields: string[];
  visibleColumns: string[];
  onSave(columns: unknown[]): void;
  onResetDefault(): void;
}

export const CustomerColumnSettingsDrawer: React.FC<CustomerColumnSettingsDrawerProps> = (props) => {
  const { locale } = useI18n();
  const isVi = locale === "vi";
  return (
    <ColumnSettingsDrawer
      {...props}
      translationPrefix="customers"
      defaultTitle={isVi ? "Tùy chỉnh cột" : "Customize columns"}
      defaultSearchPlaceholder={isVi ? "Tìm cột..." : "Search columns..."}
      defaultSelectedCountLabel={isVi ? `Đã chọn (${props.visibleColumns.length})` : `Selected (${props.visibleColumns.length})`}
      defaultClearAllLabel={isVi ? "Bỏ chọn" : "Clear all"}
      defaultDragToReorderLabel={isVi ? "Kéo thả để đổi thứ tự" : "Drag and drop to reorder"}
      defaultUnselectedLabel={isVi ? "Chưa chọn cột hiển thị" : "No columns selected"}
      defaultSaveLabel={isVi ? "Lưu thay đổi" : "Save changes"}
      allFields={props.allFields}
      getFieldLabel={(field) => customerColumnLabel(field, isVi)}
    />
  );
};

