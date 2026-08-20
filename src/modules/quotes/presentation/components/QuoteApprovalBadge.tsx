import React from "react";
import { Badge } from "@/shared/components/ui";
import { QuoteApprovalStatus, type Quote } from "../../domain/model/quote.types";

export const QuoteApprovalBadge: React.FC<{ quote: Pick<Quote, "approvalRequired" | "approvalStatus" | "approvalRequestedAt"> }> = ({ quote }) => {
  if (!quote.approvalRequired) return <Badge variant="success" size="xs" className="whitespace-nowrap">Không cần duyệt</Badge>;
  if (quote.approvalStatus === QuoteApprovalStatus.APPROVED) return <Badge variant="success" size="xs" className="whitespace-nowrap">Đã duyệt</Badge>;
  if (quote.approvalStatus === QuoteApprovalStatus.CHANGES_REQUESTED) return <Badge variant="danger" size="xs" className="whitespace-nowrap">Cần chỉnh sửa</Badge>;
  if (quote.approvalStatus === QuoteApprovalStatus.PENDING && quote.approvalRequestedAt) return <Badge variant="warning" size="xs" className="whitespace-nowrap">Chờ duyệt</Badge>;
  return <Badge variant="warning" size="xs" className="whitespace-nowrap">Cần duyệt</Badge>;
};
