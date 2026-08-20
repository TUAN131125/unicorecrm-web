import React from "react";
import {
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit3,
  Eye,
  Mail,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Archive,
  X,
} from "lucide-react";
import { QuoteStatus, type Quote } from "../../domain/model/quote.types";
import {
  ActionDropdown,
  type ActionDropdownItem,
  type ActionDropdownSection,
} from "@/components/crm/ActionDropdown";
import type { QuoteActionId } from "../model/quoteActionPolicy";

export interface QuoteActionMenuHandlers {
  onView(quote: Quote): void;
  onEdit(quote: Quote): void;
  onRequestApproval(quote: Quote): void;
  onApprove(quote: Quote): void;
  onRequestChanges(quote: Quote): void;
  onSend(quote: Quote): void;
  onConfirmSent(quote: Quote): void;
  onExportPdf(quote: Quote): void;
  onTransition(quote: Quote, status: QuoteStatus): void;
  onCreateOrder(quote: Quote): void;
  onRevision(quote: Quote): void;
  onDuplicate(quote: Quote): void;
  onDelete(quote: Quote): void;
  onOptimizePrice(quote: Quote): void;
}

interface QuoteActionMenuProps {
  quote: Quote;
  actionIds: QuoteActionId[];
  anchorEl: HTMLElement | null;
  isOpen: boolean;
  onClose(): void;
  locale: string;
  handlers: QuoteActionMenuHandlers;
}

export const QuoteActionMenu: React.FC<QuoteActionMenuProps> = ({
  quote,
  actionIds,
  anchorEl,
  isOpen,
  onClose,
  locale,
  handlers,
}) => {
  const vi = locale === "vi";
  const itemById: Record<QuoteActionId, ActionDropdownItem> = {
    view: {
      id: "view",
      label: vi ? "Xem chi tiết" : "View details",
      icon: <Eye size={14} />,
      onClick: () => handlers.onView(quote),
    },
    edit: {
      id: "edit",
      label: vi ? "Tiếp tục soạn" : "Continue editing",
      icon: <Edit3 size={14} />,
      onClick: () => handlers.onEdit(quote),
    },
    "request-approval": {
      id: "request-approval",
      label: vi ? "Gửi duyệt" : "Request approval",
      icon: <ShieldCheck size={14} />,
      badge: "INTERNAL",
      badgeTone: "warning",
      onClick: () => handlers.onRequestApproval(quote),
    },
    approve: {
      id: "approve",
      label: vi ? "Phê duyệt" : "Approve",
      icon: <CheckCircle2 size={14} />,
      badge: "INTERNAL",
      badgeTone: "success",
      onClick: () => handlers.onApprove(quote),
    },
    "request-changes": {
      id: "request-changes",
      label: vi ? "Yêu cầu chỉnh sửa" : "Request changes",
      icon: <RefreshCw size={14} />,
      badge: "INTERNAL",
      badgeTone: "warning",
      onClick: () => handlers.onRequestChanges(quote),
    },
    send: {
      id: "send",
      label: vi ? "Gửi qua Gmail" : "Send with Gmail",
      icon: <Mail size={14} />,
      onClick: () => handlers.onSend(quote),
    },
    "confirm-sent": {
      id: "confirm-sent",
      label: vi ? "Xác nhận đã gửi" : "Confirm sent",
      icon: <MessageCircle size={14} />,
      onClick: () => handlers.onConfirmSent(quote),
    },
    "export-pdf": {
      id: "export-pdf",
      label: vi ? "Xuất PDF" : "Export PDF",
      icon: <Download size={14} />,
      onClick: () => handlers.onExportPdf(quote),
    },
    accept: {
      id: "accept",
      label: vi ? "Khách chấp nhận" : "Customer accepted",
      icon: <CheckCircle2 size={14} />,
      badge: "CUSTOMER",
      badgeTone: "success",
      onClick: () => handlers.onTransition(quote, QuoteStatus.ACCEPTED),
    },
    reject: {
      id: "reject",
      label: vi ? "Khách từ chối" : "Customer rejected",
      icon: <X size={14} />,
      destructive: true,
      onClick: () => handlers.onTransition(quote, QuoteStatus.REJECTED),
    },
    expire: {
      id: "expire",
      label: vi ? "Đánh dấu hết hạn" : "Mark as expired",
      icon: <Clock size={14} />,
      onClick: () => handlers.onTransition(quote, QuoteStatus.EXPIRED),
    },
    "create-order": {
      id: "create-order",
      label: vi ? "Tạo đơn hàng" : "Create order",
      icon: <ShoppingBag size={14} />,
      badge: "CRM",
      badgeTone: "warning",
      onClick: () => handlers.onCreateOrder(quote),
    },
    revise: {
      id: "revise",
      label: `Revision v${quote.version + 1}`,
      icon: <RefreshCw size={14} />,
      onClick: () => handlers.onRevision(quote),
    },
    duplicate: {
      id: "duplicate",
      label: vi ? "Nhân bản" : "Duplicate",
      icon: <Copy size={14} />,
      onClick: () => handlers.onDuplicate(quote),
    },
    "optimize-price": {
      id: "optimize-price",
      label: vi ? "Gợi ý định giá tối ưu" : "Price optimization suggestion",
      icon: <Sparkles size={14} />,
      badge: "AI",
      badgeTone: "ai",
      onClick: () => handlers.onOptimizePrice(quote),
    },
    delete: {
      id: "delete",
      label: vi ? "Lưu trữ" : "Archive",
      icon: <Archive size={14} />,
      destructive: true,
      onClick: () => handlers.onDelete(quote),
    },
  };

  const actionItems = actionIds.map((actionId) => itemById[actionId]);
  const workflowIds = new Set<QuoteActionId>([
    "request-approval",
    "approve",
    "request-changes",
    "send",
    "confirm-sent",
    "accept",
    "reject",
    "expire",
    "create-order",
  ]);
  const accessIds = new Set<QuoteActionId>(["view", "export-pdf"]);
  const dangerIds = new Set<QuoteActionId>(["delete"]);

  const sections: ActionDropdownSection[] = [
    { id: "access", items: actionItems.filter((item) => accessIds.has(item.id as QuoteActionId)) },
    {
      id: "workflow",
      title: vi ? "Nghiệp vụ" : "Business",
      items: actionItems.filter((item) => workflowIds.has(item.id as QuoteActionId)),
    },
    {
      id: "manage",
      title: vi ? "Quản lý" : "Management",
      items: actionItems.filter((item) => !accessIds.has(item.id as QuoteActionId)
        && !workflowIds.has(item.id as QuoteActionId)
        && !dangerIds.has(item.id as QuoteActionId)),
    },
    {
      id: "danger",
      title: vi ? "Thao tác" : "Actions",
      items: actionItems.filter((item) => dangerIds.has(item.id as QuoteActionId)),
    },
  ];

  return (
    <ActionDropdown
      isOpen={isOpen}
      anchorRef={anchorEl}
      onClose={onClose}
      sections={sections}
      width={272}
    />
  );
};
