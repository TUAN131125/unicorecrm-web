import type { FC } from "react";
import { ColumnSettingsDrawer } from "@/components/crm/ColumnSettingsDrawer";
import type { ColumnConfig } from "./orderList.types";

export interface OrderColumnSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
  columnConfig: ColumnConfig;
  onSave: (visibleColumns: string[]) => void;
  onReset: () => void;
}

const CONFIGURABLE_COLUMNS = [
  { key: "customer", labelVi: "Khách hàng mua", labelEn: "Customer detail link" },
  { key: "contact", labelVi: "Người đại diện", labelEn: "Contact representative" },
  { key: "source", labelVi: "Nguồn gốc hợp đồng", labelEn: "Order source snapshot" },
  { key: "sourceQuote", labelVi: "Mã báo giá", labelEn: "Associated quote ID" },
  { key: "sourceDeal", labelVi: "Cơ hội liên kết", labelEn: "CRM opportunity / Deal" },
  { key: "owner", labelVi: "Phụ trách đơn", labelEn: "Assigned account owner" },
  { key: "productsCount", labelVi: "Số lượng sản phẩm", labelEn: "Line item quantities" },
  { key: "completedAt", labelVi: "Thời điểm hoàn thành", labelEn: "Actual completed timestamp" },
  { key: "createdAt", labelVi: "Thời gian lập đơn", labelEn: "Created timestamp" },
  { key: "updatedAt", labelVi: "Chỉnh sửa sau cùng", labelEn: "Last system adjustment" },
  { key: "expectedDeliveryDate", labelVi: "Hạn bàn giao dự kiến", labelEn: "Expected shipping target" },
  { key: "currency", labelVi: "Đơn vị tiền tệ", labelEn: "Trading currency asset" },
  { key: "state", labelVi: "Trạng thái đơn hàng", labelEn: "Order state" },
  { key: "paymentSummary", labelVi: "Thỏa thuận thanh toán", labelEn: "Payment transaction state" },
  { key: "grandTotal", labelVi: "Trị giá đơn hàng", labelEn: "Total values with VAT" },
  { key: "orderDate", labelVi: "Thời điểm bán", labelEn: "Transactional sales date" },
] as const;

export const OrderColumnSettingsModal: FC<OrderColumnSettingsModalProps> = ({
  isOpen,
  onClose,
  locale,
  columnConfig,
  onSave,
  onReset,
}) => (
  <ColumnSettingsDrawer
    isOpen={isOpen}
    onClose={onClose}
    allFields={CONFIGURABLE_COLUMNS.map((column) => column.key)}
    visibleColumns={columnConfig.visibleColumnOrder.filter((key) => key !== "orderNumber")}
    onSave={(columns) => onSave(["orderNumber", ...columns.filter((key) => key !== "orderNumber")])}
    onResetDefault={onReset}
    translationPrefix=""
    defaultTitle={locale === "vi" ? "Thiết lập cột đơn hàng" : "Order column settings"}
    defaultSearchPlaceholder={locale === "vi" ? "Tìm kiếm cột đơn hàng..." : "Search order columns..."}
    defaultClearAllLabel={locale === "vi" ? "Bỏ chọn tất cả" : "Clear all"}
    defaultDragToReorderLabel={locale === "vi" ? "Kéo thả để sắp xếp" : "Drag and drop to reorder"}
    defaultUnselectedLabel={locale === "vi" ? "Chưa chọn cột tùy chỉnh" : "No configurable columns selected"}
    defaultSaveLabel={locale === "vi" ? "Lưu thiết lập" : "Save settings"}
    getFieldLabel={(fieldKey) => {
      const column = CONFIGURABLE_COLUMNS.find((candidate) => candidate.key === fieldKey);
      return column ? (locale === "vi" ? column.labelVi : column.labelEn) : fieldKey;
    }}
  />
);
