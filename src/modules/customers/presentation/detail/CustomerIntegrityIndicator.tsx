import React, { useState } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { IconButton, RowActionPortal } from "@/shared/components/ui";
import type { RelationshipIntegrityIssue } from "@/platform/relationship-integrity";
import type { Customer360ReadModel } from "../model/customer360ReadModel";

interface CustomerIntegrityIndicatorProps {
  integrity: Customer360ReadModel["integrity"];
  isVi: boolean;
}

export const CustomerIntegrityIndicator: React.FC<CustomerIntegrityIndicatorProps> = ({
  integrity,
  isVi,
}) => {
  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const issueCount = integrity.errorCount + integrity.warningCount;
  if (issueCount === 0) return null;

  const hasBlockingError = integrity.errorCount > 0;
  const title = hasBlockingError
    ? isVi
      ? `${integrity.errorCount} lỗi dữ liệu cần xử lý`
      : `${integrity.errorCount} data error(s) require attention`
    : isVi
      ? `${integrity.warningCount} cảnh báo dữ liệu`
      : `${integrity.warningCount} data warning(s)`;

  return (
    <div
      data-guidance-id="customers.detail.relationship-integrity"
      className="relative shrink-0"
    >
      <IconButton
        id="customer-integrity-indicator"
        variant="secondary"
        size="sm"
        title={title}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={(event) => {
          event.stopPropagation();
          if (open) {
            setOpen(false);
            setAnchorEl(null);
            return;
          }
          setAnchorEl(event.currentTarget);
          setOpen(true);
        }}
        className={
          hasBlockingError
            ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800"
            : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
        }
      >
        {hasBlockingError ? <ShieldAlert size={15} /> : <AlertTriangle size={15} />}
      </IconButton>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white px-1 text-[9px] font-semibold text-white ${
          hasBlockingError ? "bg-rose-600" : "bg-amber-500"
        }`}
      >
        {issueCount > 99 ? "99+" : issueCount}
      </span>

      <RowActionPortal
        open={open}
        anchorEl={anchorEl}
        onClose={() => {
          setOpen(false);
          setAnchorEl(null);
        }}
        width={390}
      >
        <div className="max-h-[min(520px,calc(100vh-96px))] overflow-y-auto p-4 text-left crm-scroll-y">
          <div className="flex items-start gap-3 border-b border-slate-100 pb-3">
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                hasBlockingError
                  ? "bg-rose-50 text-rose-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {hasBlockingError ? <ShieldAlert size={17} /> : <AlertTriangle size={17} />}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold leading-5 text-slate-900">
                {isVi ? "Kiểm tra tính nhất quán dữ liệu" : "Review data consistency"}
              </h3>
              <p className="mt-1 text-xs font-normal leading-5 text-slate-500">
                {isVi
                  ? `${integrity.errorCount} lỗi · ${integrity.warningCount} cảnh báo. Chỉ các lỗi chặn mới cần xử lý ngay.`
                  : `${integrity.errorCount} error(s) · ${integrity.warningCount} warning(s). Only blocking errors require immediate action.`}
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {integrity.issues.map((issue) => (
              <IntegrityIssueRow
                key={`${issue.code}-${issue.recordType}-${issue.recordId}`}
                issue={issue}
                isVi={isVi}
              />
            ))}
          </div>
        </div>
      </RowActionPortal>
    </div>
  );
};

const IntegrityIssueRow: React.FC<{
  issue: RelationshipIntegrityIssue;
  isVi: boolean;
}> = ({ issue, isVi }) => {
  const isError = issue.severity === "ERROR";
  return (
    <div
      className={`min-w-0 rounded-xl border p-3 ${
        isError
          ? "border-rose-200 bg-rose-50/70"
          : "border-amber-200 bg-amber-50/60"
      }`}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 text-xs font-medium leading-5 text-slate-800">
          {presentIssue(issue, isVi)}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
            isError
              ? "bg-rose-100 text-rose-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {isError ? (isVi ? "Lỗi" : "Error") : isVi ? "Cảnh báo" : "Warning"}
        </span>
      </div>
      <div className="mt-1 break-all text-[10px] font-normal leading-4 text-slate-500">
        {recordTypeLabel(issue.recordType, isVi)} · {issue.recordId}
      </div>
    </div>
  );
};

function presentIssue(issue: RelationshipIntegrityIssue, isVi: boolean): string {
  if (!isVi) return issue.message;

  const relatedCount = issue.relatedRecordIds?.length ?? 0;
  const messages: Record<RelationshipIntegrityIssue["code"], string> = {
    ORPHAN_RELATIONSHIP:
      "Có bản ghi đang tham chiếu tới Contact hoặc Organization không còn tồn tại.",
    CUSTOMER_RELATIONSHIP_MISMATCH:
      "Customer và hồ sơ Contact/Organization nguồn không cùng một quan hệ chuẩn.",
    DUPLICATE_CONTACT_IDENTITY:
      relatedCount > 1
        ? `${relatedCount} Contact có thông tin định danh trùng nhau.`
        : "Có nhiều Contact dùng chung thông tin định danh.",
    DUPLICATE_ORGANIZATION_IDENTITY:
      relatedCount > 1
        ? `${relatedCount} tổ chức có thông tin định danh trùng nhau.`
        : "Có nhiều tổ chức dùng chung thông tin định danh.",
    CROSS_WORKSPACE_REFERENCE:
      "Có liên kết dữ liệu vượt ra ngoài workspace hiện tại.",
    BROKEN_SOURCE_CHAIN:
      "Chuỗi nguồn giữa giao dịch và hồ sơ quan hệ đang bị đứt.",
  };
  return messages[issue.code];
}

function recordTypeLabel(recordType: string, isVi: boolean): string {
  if (!isVi) return recordType;
  const labels: Record<string, string> = {
    Contact: "Người liên hệ",
    Organization: "Tổ chức",
    Customer: "Khách hàng",
    Deal: "Cơ hội",
    Quote: "Báo giá",
    Order: "Đơn hàng",
    Payment: "Thanh toán",
    Shipping: "Vận đơn",
    Return: "Đổi / Trả",
    Support: "Hỗ trợ",
    Task: "Công việc",
    Activity: "Tương tác",
  };
  return labels[recordType] ?? recordType;
}
