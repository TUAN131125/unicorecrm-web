import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  BriefcaseBusiness,
  CheckSquare,
  Clock,
  Edit3,
  FileText,
  HeartHandshake,
  Mail,
  MoreHorizontal,
  Phone,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import {
  Badge,
  Button,
  IconButton,
  MenuDivider,
  MenuItemButton,
  MenuSection,
  RowActionPortal,
} from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import type { Customer360ReadModel } from "../model/customer360ReadModel";
import { CustomerHealthBadge, CustomerStatusBadge, CustomerTypeBadge } from "../components/CustomerStatusBadge";
import { CustomerIntegrityIndicator } from "./CustomerIntegrityIndicator";

interface CustomerRecordHeaderProps {
  model: Customer360ReadModel;
  ownerName: string;
  onEditClick(): void;
  onCreateOpportunityClick(): void;
  onCreateQuoteClick(): void;
  onCreateOrderClick(): void;
  onCreateCareClick(): void;
  onAddTaskClick(): void;
  onOpenSourceClick(): void;
  onArchiveClick(): void;
  isRightPanelVisible?: boolean;
  onToggleRightPanel?(): void;
}

export const CustomerRecordHeader: React.FC<CustomerRecordHeaderProps> = ({
  model,
  ownerName,
  onEditClick,
  onCreateOpportunityClick,
  onCreateQuoteClick,
  onCreateOrderClick,
  onCreateCareClick,
  onAddTaskClick,
  onOpenSourceClick,
  onArchiveClick,
  isRightPanelVisible = true,
  onToggleRightPanel,
}) => {
  const navigate = useNavigate();
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [moreAnchorEl, setMoreAnchorEl] = useState<HTMLElement | null>(null);
  const customer = model.customer;
  const isArchived = customer.status === "ARCHIVED";
  const isDoNotContact = customer.status === "DO_NOT_CONTACT";
  const initials = model.identity.displayName.split(" ").filter(Boolean).map((word) => word[0]).join("").slice(0, 2).toUpperCase() || "CU";

  const closeMenu = () => {
    setIsMoreMenuOpen(false);
    setMoreAnchorEl(null);
  };
  const run = (action: () => void) => {
    action();
    closeMenu();
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm text-left">
      {(isArchived || isDoNotContact) && (
        <div className="flex flex-wrap gap-2">
          {isArchived && (
            <div className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3 py-1 text-[10px] font-extrabold text-zinc-700 border border-zinc-200 uppercase/9">
              <Archive size={12} className="text-zinc-600 shrink-0" />
              <span>{isVi ? "Hồ sơ đã lưu trữ" : "Record archived"}</span>
            </div>
          )}
          {isDoNotContact && (
            <div className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-1 text-[10px] font-extrabold text-rose-700 border border-rose-200 uppercase/9">
              <AlertTriangle size={12} className="text-rose-600 shrink-0 select-none" />
              <span>{isVi ? "Không nên liên hệ trực tiếp" : "Direct contact restricted"}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-4">
            <IconButton id="back-btn" onClick={() => navigate("/customers")} variant="secondary" size="sm" title={isVi ? "Quay lại" : "Back"}>
              <ArrowLeft size={14} />
            </IconButton>

            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-xl border font-extrabold text-base flex items-center justify-center shrink-0 uppercase shadow-inner bg-indigo-50 text-indigo-700 border-indigo-200">
                {initials}
              </div>
              <div className="space-y-1 text-left min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <h2 className="max-w-full break-words text-sm font-black text-slate-800 tracking-tight sm:text-lg [overflow-wrap:anywhere]">{model.identity.displayName}</h2>
                  <CustomerStatusBadge status={customer.status} locale={isVi ? "vi" : "en"} />
                  <CustomerTypeBadge type={customer.type} />
                  <CustomerHealthBadge health={customer.health} locale={isVi ? "vi" : "en"} />
                  {model.identity.primaryContact && <Badge variant="warning" className="text-[9px] py-0.5 font-bold uppercase">{isVi ? "Có liên hệ chính" : "Primary contact"}</Badge>}
                </div>

                <div className="text-[10px] sm:text-xs text-slate-500 font-medium flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-bold text-slate-700">{customer.customerCode}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-600 font-semibold">{ownerName}</span>
                  {model.identity.phone && (
                    <>
                      <span className="text-slate-300">•</span>
                      <a href={`tel:${model.identity.phone}`} className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 font-semibold"><Phone size={11} /> {model.identity.phone}</a>
                    </>
                  )}
                  {model.identity.email && (
                    <>
                      <span className="text-slate-300">•</span>
                      <a href={`mailto:${model.identity.email}`} className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 font-semibold"><Mail size={11} /> {model.identity.email}</a>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 shrink-0 max-w-full">
          <CustomerIntegrityIndicator integrity={model.integrity} isVi={isVi} />

          <IconButton id="edit-direct-btn" onClick={onEditClick} variant="secondary" size="sm" title={isVi ? "Sửa" : "Edit"}>
            <Edit3 size={14} />
          </IconButton>

          {onToggleRightPanel && (
            <IconButton id="mobile-panel-toggle" onClick={onToggleRightPanel} variant="secondary" size="sm" className="2xl:hidden" title={isRightPanelVisible ? (isVi ? "Ẩn lịch sử tương tác" : "Hide activity history") : (isVi ? "Lịch sử hoạt động" : "Activity history")}>
              <Clock size={14} />
            </IconButton>
          )}

          <Button id="create-opp-btn" disabled={isArchived} onClick={onCreateOpportunityClick} variant="primary" size="sm" icon={<Sparkles size={11} />}>
            {isVi ? "Sinh cơ hội" : "Create opportunity"}
          </Button>

          <IconButton
            id="header-more-actions-btn"
            onClick={(event) => {
              event.stopPropagation();
              if (isMoreMenuOpen) closeMenu();
              else {
                setMoreAnchorEl(event.currentTarget as HTMLElement);
                setIsMoreMenuOpen(true);
              }
            }}
            variant="secondary"
            size="sm"
            title={isVi ? "Thao tác khác" : "More actions"}
            className="border border-slate-200 h-9 w-9 flex items-center justify-center p-0 rounded-xl animate-fade-in"
          >
            <MoreHorizontal size={14} />
          </IconButton>

          <RowActionPortal open={isMoreMenuOpen} anchorEl={moreAnchorEl} onClose={closeMenu} width={240}>
            <div className="w-full max-h-[calc(100vh-96px)] overflow-y-auto crm-scroll-y rounded-xl border border-slate-200 bg-white p-1.5 text-left text-xs shadow-2xl space-y-0.5 font-sans animate-fade-in block">
              <MenuSection title={isVi ? "Nghiệp vụ" : "Business actions"} />
              <MenuItemButton disabled={isArchived} onClick={() => run(onCreateQuoteClick)} icon={<FileText size={14} />}>{isVi ? "Tạo báo giá" : "Create quote"}</MenuItemButton>
              <MenuItemButton disabled={isArchived} onClick={() => run(onCreateOrderClick)} icon={<ShoppingBag size={14} />}>{isVi ? "Tạo đơn hàng" : "Create order"}</MenuItemButton>
              <MenuItemButton disabled={isArchived} onClick={() => run(onCreateCareClick)} icon={<HeartHandshake size={14} />}>{isVi ? "Tạo phiếu hỗ trợ" : "Create support ticket"}</MenuItemButton>
              <MenuItemButton disabled={isArchived} onClick={() => run(onAddTaskClick)} icon={<CheckSquare size={14} />}>{isVi ? "Thêm công việc" : "Add task"}</MenuItemButton>
              <MenuDivider />
              <MenuSection title={isVi ? "Quan hệ & dữ liệu nguồn" : "Relationship & source data"} />
              <MenuItemButton onClick={() => run(onOpenSourceClick)} icon={<BriefcaseBusiness size={14} />}>{isVi ? "Mở hồ sơ nguồn" : "Open source record"}</MenuItemButton>
              {!isArchived && (
                <>
                  <MenuDivider />
                  <MenuItemButton onClick={() => run(onArchiveClick)} icon={<Archive size={14} />} danger>{isVi ? "Lưu trữ khách hàng" : "Archive customer"}</MenuItemButton>
                </>
              )}
            </div>
          </RowActionPortal>
        </div>
      </div>
    </div>
  );
};
