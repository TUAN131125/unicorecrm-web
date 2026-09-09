import React from "react";
import { ContactRound, UsersRound } from "lucide-react";
import { Button } from "@/shared/components/ui";
import {
  RelationshipModuleActions,
  RelationshipWorkspaceHeader,
} from "@/components/crm/relationship-detail";
import { useI18n } from "@/i18n";
import type { Contact } from "../../../domain/model/contact.types";
import type { Customer } from "@/modules/customers";
import { getActiveContactOrganizationRelationships } from "../../../domain/model/contactOrganizationRelationships";
import { ContactOrganizationRelationshipsPanel } from "../ContactOrganizationRelationshipsPanel";
import { ContactCustomerRelationshipsPanel } from "../ContactCustomerRelationshipsPanel";

interface ContactRelationshipsTabProps {
  contact: Contact;
  customer?: Customer;
  customerName?: string;
  onOpenCustomer?(): void;
  onOpenCustomerRelationship?(customerId: string): void;
  onOpenOrganization?(organizationId: string): void;
  onOpenCustomerDirectory(): void;
}

export const ContactRelationshipsTab: React.FC<ContactRelationshipsTabProps> = ({
  contact,
  customer,
  customerName,
  onOpenCustomer,
  onOpenCustomerRelationship,
  onOpenOrganization,
  onOpenCustomerDirectory,
}) => {
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const text = (vi: string, en: string) => (isVi ? vi : en);
  const organizationRelationships = getActiveContactOrganizationRelationships(contact);
  const hasOrganization = organizationRelationships.length > 0;

  return (
    <div className="space-y-4">
      <RelationshipWorkspaceHeader
        title={text("Liên kết hồ sơ quan hệ", "Relationship connections")}
        actions={
          <RelationshipModuleActions
            secondaryLabel={text("Mở danh sách khách hàng", "Open customer directory")}
            onSecondary={onOpenCustomerDirectory}
            primaryLabel={customer ? text("Mở Customer 360", "Open Customer 360") : undefined}
            onPrimary={customer ? onOpenCustomer : undefined}
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {customer ? (
          <button
            type="button"
            onClick={onOpenCustomer}
            className="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-violet-200 hover:shadow-sm"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <UsersRound size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block crm-text-wrap text-xs font-semibold text-slate-900">{customerName || customer.customerCode}</span>
              <span className="mt-1 block crm-text-wrap text-[10px] text-slate-500">
                {text("Chủ thể tài khoản Customer (tách biệt với vai trò stakeholder)", "Customer account subject (separate from stakeholder roles)")}
              </span>
            </span>
          </button>
        ) : null}
        {onOpenOrganization ? (
          <div className="sm:col-span-2">
            <ContactOrganizationRelationshipsPanel contact={contact} onOpenOrganization={onOpenOrganization} />
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <ContactCustomerRelationshipsPanel contact={contact} onOpenCustomer={onOpenCustomerRelationship} />
        </div>
        {!customer && !hasOrganization && !onOpenOrganization ? (
          <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-8 text-center sm:col-span-2">
            <ContactRound size={22} className="text-slate-300" />
            <p className="mt-3 text-xs font-medium text-slate-600">
              {text("Người liên hệ chưa được nối với Customer 360 hoặc tổ chức.", "This contact is not connected to Customer 360 or an organization.")}
            </p>
            <Button size="sm" variant="secondary" className="mt-4" onClick={onOpenCustomerDirectory}>
              {text("Tìm hồ sơ liên kết", "Find a relationship record")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
