import React from "react";
import { Input, Select } from "@/shared/components/ui";
import { ListFilterGrid, ListFilterPopover } from "@/components/crm/list-archetype";
import { useI18n } from "@/i18n";
import { getWorkspaceMemberOptions } from "@/platform/member-directory";
import type { CustomerHealth, CustomerStatus, CustomerType } from "../../domain/model/customer.types";

interface CustomerFilterPopoverProps {
  isOpen: boolean;
  onClose(): void;
  typeFilter: CustomerType | "all";
  setTypeFilter(value: CustomerType | "all"): void;
  statusFilter: CustomerStatus | "all";
  setStatusFilter(value: CustomerStatus | "all"): void;
  healthFilter: CustomerHealth | "all";
  setHealthFilter(value: CustomerHealth | "all"): void;
  ownerFilter: string;
  setOwnerFilter(value: string): void;
  segmentFilter: string;
  setSegmentFilter(value: string): void;
  nextCareDateFilter: string;
  setNextCareDateFilter(value: string): void;
  segments: string[];
  authoritativeFiltersOnly?: boolean;
  onResetAll(): void;
}

export const CustomerFilterPopover: React.FC<CustomerFilterPopoverProps> = ({
  isOpen,
  onClose,
  typeFilter,
  setTypeFilter,
  statusFilter,
  setStatusFilter,
  healthFilter,
  setHealthFilter,
  ownerFilter,
  setOwnerFilter,
  segmentFilter,
  setSegmentFilter,
  nextCareDateFilter,
  setNextCareDateFilter,
  segments,
  authoritativeFiltersOnly = false,
  onResetAll,
}) => {
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const allLabel = isVi ? "Tất cả" : "All";

  return (
    <ListFilterPopover
      isOpen={isOpen}
      onClose={onClose}
      onReset={onResetAll}
      ariaLabel={isVi ? "Bộ lọc khách hàng" : "Customer filters"}
      resetLabel={isVi ? "Đặt lại" : "Reset"}
      doneLabel={isVi ? "Hoàn tất" : "Done"}
    >
      <ListFilterGrid>
        <Select
          label={isVi ? "Loại khách hàng" : "Customer type"}
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as CustomerType | "all")}
        >
          <option value="all">{allLabel}</option>
          <option value="B2B">B2B</option>
          <option value="B2C">B2C</option>
        </Select>

        <Select
          label={isVi ? "Trạng thái" : "Status"}
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as CustomerStatus | "all")}
        >
          <option value="all">{allLabel}</option>
          <option value="NEW">{isVi ? "Mới" : "New"}</option>
          <option value="ACTIVE">{isVi ? "Đang hoạt động" : "Active"}</option>
          <option value="AT_RISK">{isVi ? "Có rủi ro" : "At risk"}</option>
          <option value="INACTIVE">{isVi ? "Không hoạt động" : "Inactive"}</option>
          <option value="CHURNED">{isVi ? "Rời bỏ" : "Churned"}</option>
          <option value="DO_NOT_CONTACT">{isVi ? "Không liên hệ" : "Do not contact"}</option>
          <option value="ARCHIVED">{isVi ? "Đã lưu trữ" : "Archived"}</option>
        </Select>

        {!authoritativeFiltersOnly && <Select
          label={isVi ? "Sức khỏe quan hệ" : "Relationship health"}
          value={healthFilter}
          onChange={(event) => setHealthFilter(event.target.value as CustomerHealth | "all")}
        >
          <option value="all">{allLabel}</option>
          <option value="GOOD">{isVi ? "Tốt" : "Good"}</option>
          <option value="WATCH">{isVi ? "Theo dõi" : "Watch"}</option>
          <option value="RISK">{isVi ? "Rủi ro" : "Risk"}</option>
        </Select>}

        <Select
          label={isVi ? "Người phụ trách" : "Owner"}
          value={ownerFilter}
          onChange={(event) => setOwnerFilter(event.target.value)}
        >
          <option value="all">{allLabel}</option>
          {getWorkspaceMemberOptions().map((user) => (
            <option key={user.id} value={user.id}>{user.name}</option>
          ))}
        </Select>

        <Select
          label={isVi ? "Phân khúc" : "Segment"}
          value={segmentFilter}
          onChange={(event) => setSegmentFilter(event.target.value)}
        >
          <option value="all">{allLabel}</option>
          {segments.map((segment) => <option key={segment} value={segment}>{segment}</option>)}
        </Select>

        {!authoritativeFiltersOnly && <Input
          label={isVi ? "Ngày chăm sóc tiếp" : "Next care date"}
          type="date"
          value={nextCareDateFilter}
          onChange={(event) => setNextCareDateFilter(event.target.value)}
        />}
      </ListFilterGrid>
    </ListFilterPopover>
  );
};
