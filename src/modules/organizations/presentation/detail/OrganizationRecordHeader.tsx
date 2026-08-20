import React, { useState } from "react";
import {
  ArrowLeft,
  Building2,
  Edit3,
  ExternalLink,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  UsersRound,
} from "lucide-react";
import { Button, IconButton, MenuItemButton, MenuSection, RowActionPortal } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import type { Contact } from "@/modules/contacts";
import type { OrganizationAccount } from "../../domain/model/organizationAccount.types";
import {
  getOrganizationStatus,
  getOrganizationStatusBadgeClass,
  getOrganizationStatusLabel,
} from "../model/organizationAccountView";

interface OrganizationRecordHeaderProps {
  account: OrganizationAccount;
  primaryContact?: Contact;
  representativeCount: number;
  customerId?: string;
  onOpenCustomer: () => void;
  onBack: () => void;
  onEdit: () => void;
  onAddRepresentative: () => void;
  canEdit: boolean;
  canAddRepresentative: boolean;
}

export const OrganizationRecordHeader: React.FC<OrganizationRecordHeaderProps> = ({
  account,
  primaryContact,
  representativeCount,
  customerId,
  onOpenCustomer,
  onBack,
  onEdit,
  onAddRepresentative,
  canEdit,
  canAddRepresentative,
}) => {
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const text = (vi: string, en: string) => isVi ? vi : en;
  const status = getOrganizationStatus(account);
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const phone = primaryContact?.phone || primaryContact?.mobilePhone || account.phone;
  const email = primaryContact?.workEmail || primaryContact?.email || account.email;

  const closeMenu = () => {
    setMenuOpen(false);
    setAnchorEl(null);
  };

  return (
    <header
      data-organization-record-header="customer-pattern"
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <IconButton
            type="button"
            onClick={onBack}
            variant="secondary"
            size="sm"
            className="shrink-0"
            title={text("Quay lại danh sách tổ chức", "Back to organizations")}
          >
            <ArrowLeft size={15} />
          </IconButton>

          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-violet-700 shadow-inner">
            <Building2 size={21} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="crm-text-wrap text-base font-semibold leading-6 text-slate-950 sm:text-lg">
                {account.displayName}
              </h1>
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[9px] font-medium uppercase text-indigo-700">B2B</span>
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-medium ${getOrganizationStatusBadgeClass(status)}`}>
                {getOrganizationStatusLabel(status)}
              </span>
              {customerId ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-medium text-emerald-700">
                  {text("Đã là khách hàng", "Customer established")}
                </span>
              ) : null}
            </div>

            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-normal leading-5 text-slate-500 sm:text-xs">
              <span>{account.taxCode ? `${text("MST", "Tax ID")} ${account.taxCode}` : account.legalName || account.id}</span>
              <span aria-hidden="true" className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1">
                <UsersRound size={11} />
                {representativeCount} {text("cá nhân liên kết", "linked representative(s)")}
              </span>
              {primaryContact ? (
                <>
                  <span aria-hidden="true" className="text-slate-300">•</span>
                  <span className="crm-text-wrap">
                    {text("Đại diện chính", "Primary representative")}: <span className="font-medium text-slate-700">{primaryContact.fullName || primaryContact.name}</span>
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
          {canEdit ? (
            <IconButton type="button" onClick={onEdit} variant="secondary" size="sm" title={text("Chỉnh sửa tổ chức", "Edit organization")}>
              <Edit3 size={14} />
            </IconButton>
          ) : null}

          {canAddRepresentative ? (
            <Button type="button" onClick={onAddRepresentative} variant="primary" size="sm" icon={<Plus size={13} />}>
              {text("Thêm đại diện", "Add representative")}
            </Button>
          ) : null}

          <IconButton
            type="button"
            variant="secondary"
            size="sm"
            title={text("Thao tác khác", "More actions")}
            onClick={(event) => {
              event.stopPropagation();
              if (menuOpen) closeMenu();
              else {
                setAnchorEl(event.currentTarget as HTMLElement);
                setMenuOpen(true);
              }
            }}
          >
            <MoreHorizontal size={14} />
          </IconButton>

          <RowActionPortal open={menuOpen} anchorEl={anchorEl} onClose={closeMenu} width={240}>
            <div className="w-full space-y-0.5 rounded-xl border border-slate-200 bg-white p-1.5 text-left text-xs shadow-2xl">
              <MenuSection title={text("Quan hệ và liên hệ", "Relationship and contact")} />
              {customerId ? (
                <MenuItemButton onClick={() => { onOpenCustomer(); closeMenu(); }} icon={<ExternalLink size={14} />}>
                  {text("Mở Customer 360", "Open Customer 360")}
                </MenuItemButton>
              ) : null}
              {phone ? (
                <MenuItemButton onClick={() => { window.location.href = `tel:${phone}`; closeMenu(); }} icon={<Phone size={14} />}>
                  {text("Gọi đại diện", "Call representative")}
                </MenuItemButton>
              ) : null}
              {email ? (
                <MenuItemButton onClick={() => { window.location.href = `mailto:${email}`; closeMenu(); }} icon={<Mail size={14} />}>
                  {text("Gửi email", "Send email")}
                </MenuItemButton>
              ) : null}
            </div>
          </RowActionPortal>
        </div>
      </div>
    </header>
  );
};
