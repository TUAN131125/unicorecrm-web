import React from "react";
import { Phone, Mail, Clock, MoreHorizontal, AlertCircle } from "lucide-react";
import { Contact } from "../../domain/model/contact.types";
import { useI18n } from "@/i18n";
import { localizeBusinessDescriptor } from "@/shared/lib/i18n/businessDescriptorLabels";
import { Avatar, Badge, IconButton, RowActionPortal, Checkbox } from "@/shared/components/ui";
import { ContactActionMenu } from "./ContactActionMenu";
import { findCustomerForContact, getCustomerDisplayNameForContact } from "../model/contactCustomerLookup";
import { getWorkspaceMemberOptions } from "@/platform/member-directory";

interface ContactCardListProps {
  filteredContacts: Contact[];
  selectedContactIds: string[];
  onSelectRow: (id: string, checked: boolean) => void;
  openRowActionId: string | null;
  setOpenRowActionId: (id: string | null) => void;
  onCall: (contact: Contact) => void;
  onEmail: (contact: Contact) => void;
  onOpenOpportunityWizard: (contact: Contact) => void;
  onOpenDeleteConfirm: (contact: Contact) => void;
  onViewDetails: (contactId: string) => void;
  onArchive?: (contact: Contact) => void;
}

export const ContactCardList: React.FC<ContactCardListProps> = ({
  filteredContacts,
  selectedContactIds,
  onSelectRow,
  openRowActionId,
  setOpenRowActionId,
  onCall,
  onEmail,
  onOpenOpportunityWizard,
  onOpenDeleteConfirm,
  onViewDetails,
  onArchive
}) => {
  const { t, tx, locale } = useI18n();
  const [rowActionAnchorEl, setRowActionAnchorEl] = React.useState<HTMLElement | null>(null);

  const activeContact = React.useMemo(() => {
    return filteredContacts.find((c) => c.id === openRowActionId) || null;
  }, [filteredContacts, openRowActionId]);

  React.useEffect(() => {
    if (!openRowActionId) {
      setRowActionAnchorEl(null);
    }
  }, [openRowActionId]);

  const getContactStatusBadgeVariant = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "info";
      case "needs_follow_up":
        return "warning";
      case "in_consulting":
        return "info";
      case "has_open_opportunity":
        return "indigo";
      case "inactive":
        return "neutral";
      case "do_not_contact":
        return "danger";
      case "archived":
        return "neutral";
      default:
        return "neutral";
    }
  };

  return (
    <>
      <div data-data-surface="list" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-3 font-sans">
      {filteredContacts.map((contact) => {
        const isSelected = selectedContactIds.includes(contact.id);
        const owner = getWorkspaceMemberOptions().find(u => u.id === contact.ownerId) || getWorkspaceMemberOptions()[0];
        const ownerName = owner?.name || "System Owner";
        const phoneVal = contact.mobilePhone || contact.phone;
        const emailVal = contact.workEmail || contact.email;

        return (
          <div 
            key={contact.id}
            className={`border rounded-2xl p-4 space-y-3 bg-white shadow-sm transition-all ${
              isSelected ? "border-indigo-400 ring-1 ring-indigo-400 bg-indigo-50/10" : "border-slate-100"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`card-checkbox-${contact.id}`}
                  checked={isSelected}
                  onChange={(e) => onSelectRow(contact.id, e.target.checked)}
                  className="mt-0"
                />
                <div>
                  <h4 
                    onClick={() => onViewDetails(contact.id)}
                    className="font-medium text-sm text-indigo-600 hover:underline cursor-pointer"
                  >
                    {contact.fullName || contact.name}
                  </h4>
                  {contact.title && <span className="text-[10px] text-slate-400 font-medium">{localizeBusinessDescriptor(contact.title, locale)}</span>}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 select-none">
                <Badge variant={getContactStatusBadgeVariant(contact.status)} className="text-[9px] font-semibold px-1.5 py-0.5 uppercase border">
                  {t(`contactStatus.${contact.status || "active"}`)}
                </Badge>
                
                <div>
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      const target = e.currentTarget as HTMLElement;
                      if (openRowActionId === contact.id) {
                        setOpenRowActionId(null);
                        setRowActionAnchorEl(null);
                      } else {
                        setOpenRowActionId(contact.id);
                        setRowActionAnchorEl(target);
                      }
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-slate-700 p-1"
                  >
                    <MoreHorizontal size={14} className="text-slate-500" />
                  </IconButton>
                </div>
              </div>
            </div>

            {/* Entity parent description if exists */}
            {(contact.companyName || getCustomerDisplayNameForContact(contact)) && (
              <div className="text-xs font-medium text-slate-700">
                🏢 {contact.companyName || getCustomerDisplayNameForContact(contact)}
              </div>
            )}

            {/* Quick Contacts details */}
            <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-50 text-[10px] text-slate-500">
              {phoneVal && (
                <div className="flex items-center gap-1">
                  <Phone size={10} className="text-teal-500 shrink-0" />
                  <span className="font-mono whitespace-nowrap">{phoneVal}</span>
                </div>
              )}
              {emailVal && (
                <div className="flex items-center gap-1 crm-text-wrap">
                  <Mail size={10} className="text-slate-400 shrink-0" />
                  <span className="crm-text-wrap">{emailVal}</span>
                </div>
              )}
              {contact.nextFollowUpAt && (
                <div className="col-span-2 flex items-center gap-1 text-slate-600 font-medium">
                  <Clock size={10} className="text-indigo-400" />
                  <span>{tx("contactForm.nextFollowUpAt", "Chăm sóc tiếp")}: {new Date(contact.nextFollowUpAt).toLocaleDateString()}</span>
                </div>
              )}
              {contact.relationshipLevel && (
                <div className="col-span-2 text-slate-400">
                  {tx("contactForm.relationshipLevel", "Mức độ mật thiết")}: <span className="font-semibold text-slate-600">{t(`contactRelationshipLevel.${contact.relationshipLevel}`)}</span>
                </div>
              )}
            </div>

            {/* Owner signature and dates */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-50">
              <div className="flex items-center gap-1">
                <Avatar src={owner?.avatarUrl} name={ownerName} className="h-4 w-4" />
                <span className="font-medium text-slate-600">{ownerName}</span>
              </div>
              <span className="font-mono">{new Date(contact.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        );
      })}

      {filteredContacts.length === 0 && (
        <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <AlertCircle className="mx-auto text-slate-300 mb-2" size={24} />
          <p className="text-xs font-medium">{tx("contactList.empty.filteredTitle", "Không tìm thấy liên hệ nào khớp với bộ lọc.")}</p>
        </div>
      )}
    </div>

      <RowActionPortal
        open={Boolean(openRowActionId && activeContact)}
        anchorEl={rowActionAnchorEl}
        onClose={() => {
          setOpenRowActionId(null);
          setRowActionAnchorEl(null);
        }}
        width={256}
      >
        {activeContact && (
          <ContactActionMenu
            contact={activeContact}
            onClose={() => {
              setOpenRowActionId(null);
              setRowActionAnchorEl(null);
            }}
            onViewDetails={onViewDetails}
            onCall={onCall}
            onEmail={onEmail}
            onOpenOpportunityWizard={onOpenOpportunityWizard}
            onOpenDeleteConfirm={onOpenDeleteConfirm}
            onArchive={onArchive}
          />
        )}
      </RowActionPortal>
    </>
  );
};
