import type { FC } from "react";
import { Input, SearchableSelect, Select } from "@/shared/components/ui";
import { ListFilterGrid, ListFilterPopover } from "@/components/crm/list-archetype";
import type { OrderStatusConfig } from "./orderList.types";

export interface OrderFilterPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  locale: string;
  statusConfigs: OrderStatusConfig[];
  allCustomersList: string[];
  allContactsList: string[];
  allOwnersList: string[];
  allProductsList: string[];
  filterStatus: string;
  filterPayment: string;
  filterCustomer: string;
  filterContact: string;
  filterOwner: string;
  filterSourceType: string;
  filterProduct: string;
  filterAmountMin: string;
  filterAmountMax: string;
  filterDateStart: string;
  filterDateEnd: string;
  onStatusChange: (status: string) => void;
  onPaymentChange: (payment: string) => void;
  onCustomerChange: (customer: string) => void;
  onContactChange: (contact: string) => void;
  onOwnerChange: (owner: string) => void;
  onSourceTypeChange: (sourceType: string) => void;
  onProductChange: (product: string) => void;
  onAmountMinChange: (val: string) => void;
  onAmountMaxChange: (val: string) => void;
  onDateStartChange: (val: string) => void;
  onDateEndChange: (val: string) => void;
  onReset: () => void;
}

export const OrderFilterPopover: FC<OrderFilterPopoverProps> = ({
  isOpen,
  onClose,
  title,
  locale,
  statusConfigs,
  allCustomersList,
  allContactsList,
  allOwnersList,
  allProductsList,
  filterStatus,
  filterPayment,
  filterCustomer,
  filterContact,
  filterOwner,
  filterSourceType,
  filterProduct,
  filterAmountMin,
  filterAmountMax,
  filterDateStart,
  filterDateEnd,
  onStatusChange,
  onPaymentChange,
  onCustomerChange,
  onContactChange,
  onOwnerChange,
  onSourceTypeChange,
  onProductChange,
  onAmountMinChange,
  onAmountMaxChange,
  onDateStartChange,
  onDateEndChange,
  onReset,
}) => {
  const isVi = locale === "vi";
  const allLabel = isVi ? "Tất cả" : "All";

  return (
    <ListFilterPopover
      isOpen={isOpen}
      onClose={onClose}
      onReset={onReset}
      ariaLabel={title}
      resetLabel={isVi ? "Đặt lại" : "Reset"}
      doneLabel={isVi ? "Hoàn tất" : "Done"}
    >
      <ListFilterGrid>
        <Select label={isVi ? "Trạng thái đơn hàng" : "Order status"} value={filterStatus} onChange={(event) => onStatusChange(event.target.value)}>
          <option value="all">{allLabel}</option>
          {statusConfigs.map((config) => <option key={config.code} value={config.code}>{isVi ? config.labelVi : config.labelEn}</option>)}
        </Select>

        <Select label={isVi ? "Trạng thái thanh toán" : "Payment status"} value={filterPayment} onChange={(event) => onPaymentChange(event.target.value)}>
          <option value="all">{allLabel}</option>
          <option value="unpaid">{isVi ? "Chưa thanh toán" : "Unpaid"}</option>
          <option value="partial">{isVi ? "Thanh toán một phần" : "Partially paid"}</option>
          <option value="paid">{isVi ? "Đã thanh toán" : "Paid"}</option>
          <option value="refunded">{isVi ? "Đã hoàn tiền" : "Refunded"}</option>
          <option value="overdue">{isVi ? "Quá hạn" : "Overdue"}</option>
        </Select>

        <SearchableSelect
          label={isVi ? "Khách hàng" : "Customer"}
          value={filterCustomer}
          onChange={onCustomerChange}
          clearable={false}
          placeholder={allLabel}
          searchPlaceholder={isVi ? "Tìm khách hàng..." : "Search customers..."}
          options={[{ value: "all", label: allLabel }, ...allCustomersList.map((name) => ({ value: name, label: name }))]}
        />

        <SearchableSelect
          label={isVi ? "Người đại diện" : "Representative"}
          value={filterContact}
          onChange={onContactChange}
          clearable={false}
          placeholder={allLabel}
          searchPlaceholder={isVi ? "Tìm người liên hệ..." : "Search contacts..."}
          options={[{ value: "all", label: allLabel }, ...allContactsList.map((name) => ({ value: name, label: name }))]}
        />

        <SearchableSelect
          label={isVi ? "Người phụ trách" : "Owner"}
          value={filterOwner}
          onChange={onOwnerChange}
          clearable={false}
          placeholder={allLabel}
          searchPlaceholder={isVi ? "Tìm nhân viên..." : "Search owners..."}
          options={[{ value: "all", label: allLabel }, ...allOwnersList.map((name) => ({ value: name, label: name }))]}
        />

        <Select label={isVi ? "Nguồn đơn hàng" : "Order source"} value={filterSourceType} onChange={(event) => onSourceTypeChange(event.target.value)}>
          <option value="all">{allLabel}</option>
          <option value="direct">{isVi ? "Tạo trực tiếp" : "Direct"}</option>
          <option value="quote">{isVi ? "Từ báo giá" : "From quote"}</option>
          <option value="opportunity">{isVi ? "Từ cơ hội" : "From opportunity"}</option>
        </Select>

        <SearchableSelect
          label={isVi ? "Sản phẩm" : "Product"}
          value={filterProduct}
          onChange={onProductChange}
          clearable={false}
          placeholder={allLabel}
          searchPlaceholder={isVi ? "Tìm sản phẩm..." : "Search products..."}
          options={[{ value: "all", label: allLabel }, ...allProductsList.map((name) => ({ value: name, label: name }))]}
        />

        <Input label={isVi ? "Giá trị từ" : "Minimum value"} type="number" value={filterAmountMin} onChange={(event) => onAmountMinChange(event.target.value)} placeholder="0" inputMode="decimal" />
        <Input label={isVi ? "Giá trị đến" : "Maximum value"} type="number" value={filterAmountMax} onChange={(event) => onAmountMaxChange(event.target.value)} placeholder="999000000" inputMode="decimal" />
        <Input label={isVi ? "Ngày đơn hàng từ" : "Order date from"} type="date" value={filterDateStart} onChange={(event) => onDateStartChange(event.target.value)} />
        <Input label={isVi ? "Ngày đơn hàng đến" : "Order date to"} type="date" value={filterDateEnd} onChange={(event) => onDateEndChange(event.target.value)} />
      </ListFilterGrid>
    </ListFilterPopover>
  );
};
