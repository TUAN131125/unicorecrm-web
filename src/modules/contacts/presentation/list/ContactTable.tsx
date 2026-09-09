import React from "react";
import { AlertCircle, Phone, Mail, Clock, MoreHorizontal, MessageSquare } from "lucide-react";
import { Contact, ContactStatus, ContactDecisionRole, ContactRelationshipLevel } from "../../domain/model/contact.types";
import { TableResizeHeader } from "@/components/crm/TableResizeHeader";
import { useI18n } from "@/i18n";
import { localizeBusinessDescriptor } from "@/shared/lib/i18n/businessDescriptorLabels";
import { 
  Table, TableHeader, TableBody, TableRow, TableCell, Badge, IconButton, RowActionPortal, Checkbox 
} from "@/shared/components/ui";
import { ContactActionMenu } from "./ContactActionMenu";
import { findCustomerForContact, getCustomerDisplayNameForContact } from "../model/contactCustomerLookup";
import { getWorkspaceMemberOptions } from "@/platform/member-directory";

interface ContactTableProps {
  contacts: Contact[];
  visibleColumns: string[];
  columnWidths: Record<string, number>;
  selectedContactIds: string[];
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onColumnResize: (e: React.MouseEvent, colKey: string) => void;
  onColumnReset: (colKey: string) => void;
  openRowActionId: string | null;
  setOpenRowActionId: (id: string | null) => void;
  onCall: (c: Contact) => void;
  onEmail: (c: Contact) => void;
  onOpenOpportunityWizard?: (c: Contact) => void;
  onOpenDeleteConfirm?: (c: Contact) => void;
  onViewDetails: (contactId: string) => void;
  onArchive?: (contact: Contact) => void;
}

export const ContactTable: React.FC<ContactTableProps> = ({
  contacts,
  visibleColumns,
  columnWidths,
  selectedContactIds,
  onSelectAll,
  onSelectRow,
  onColumnResize,
  onColumnReset,
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
    return contacts.find((c) => c.id === openRowActionId) || null;
  }, [contacts, openRowActionId]);

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

  const getPriorityBadgeVariant = (priority?: string) => {
    switch (priority) {
      case "LOW":
        return "neutral";
      case "MEDIUM":
        return "indigo";
      case "HIGH":
        return "warning";
      case "URGENT":
        return "error";
      default:
        return "neutral";
    }
  };

  const selectionWidth = columnWidths.selection || 48;
  const actionsWidth = columnWidths.actions || 120;
  const defaultColWidth = 150;
  const tableMinWidth = selectionWidth + actionsWidth + visibleColumns.reduce((sum, key) => sum + (columnWidths[key] || defaultColWidth), 0);

  return (
    <div className="overflow-x-auto crm-scroll-x font-sans rounded-2xl border border-slate-200 shadow-sm">
      <Table style={{ tableLayout: "fixed", width: "100%", minWidth: tableMinWidth }} className="min-w-full bg-white">
        <TableHeader>
          <TableRow className="bg-slate-50/70 border-b border-slate-200">
            {/* Selection Column Checklist */}
            <TableCell 
              style={{ 
                width: selectionWidth,
                minWidth: selectionWidth,
                maxWidth: selectionWidth
              }} 
              className="text-center select-none sticky left-0 bg-slate-50 z-20 p-2.5 border-r border-slate-100"
            >
              <div className="flex justify-center items-center">
                <Checkbox
                  checked={contacts.length > 0 && selectedContactIds.length === contacts.length}
                  onChange={(e) => onSelectAll(e.target.checked)}
                />
              </div>
            </TableCell>
            
            {/* Custom Resizable Columns */}
            {visibleColumns.map((colKey) => (
              <TableResizeHeader
                key={colKey}
                colKey={colKey}
                width={columnWidths[colKey] || 150}
                label={tx(`contacts.columnSettings.fields.${colKey}`, colKey)}
                onResize={onColumnResize}
                onReset={onColumnReset}
                tooltip={tx("contacts.columnSettings.columnResizeTooltip", "Drag to resize, double-click to restore")}
              />
            ))}
            
            {/* Action Column */}
            <TableCell 
              style={{ 
                width: actionsWidth,
                minWidth: actionsWidth,
                maxWidth: actionsWidth
              }} 
              className="font-medium text-slate-700 text-[11px] uppercase tracking-wider text-center sticky right-0 bg-slate-50 py-2 px-3 whitespace-nowrap z-20 border-l border-slate-100"
            >
              {tx("common.actions", "Thao tác")}
            </TableCell>
          </TableRow>
        </TableHeader>

        <TableBody>
          {contacts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={visibleColumns.length + 2} className="text-center py-10 text-slate-400 font-sans">
                <AlertCircle className="mx-auto text-slate-300 mb-2" size={24} />
                <p className="font-medium text-xs">{tx("contactList.empty.filteredTitle", "Không tìm thấy liên hệ nào khớp với điều kiện lọc.")}</p>
              </TableCell>
            </TableRow>
          ) : (
            contacts.map((contact) => {
              const isSelected = selectedContactIds.includes(contact.id);
              const owner = getWorkspaceMemberOptions().find(u => u.id === contact.ownerId) || getWorkspaceMemberOptions()[0];
              const customerName = getCustomerDisplayNameForContact(contact);

              return (
                <TableRow 
                  key={contact.id} 
                  className={`hover:bg-indigo-50/10 border-b border-indigo-50/40 transition-colors ${
                    isSelected ? "bg-indigo-50/20" : ""
                  }`}
                >
                  {/* Selection Checkbox Cell */}
                  <TableCell 
                    style={{ 
                      width: columnWidths.selection || 48,
                      minWidth: columnWidths.selection || 48,
                      maxWidth: columnWidths.selection || 48
                    }} 
                    className="text-center p-2.5 sticky left-0 bg-white/95 select-none z-10 border-r border-slate-100"
                  >
                    <div className="flex justify-center items-center">
                      <Checkbox
                        checked={isSelected}
                        onChange={(e) => onSelectRow(contact.id, e.target.checked)}
                      />
                    </div>
                  </TableCell>

                  {/* Rendering Dynamic Cells based on visible columns */}
                  {visibleColumns.map((colKey) => {
                    let content: React.ReactNode = "-";

                    switch (colKey) {
                      case "code":
                        content = (
                          <span className="font-mono text-[10.5px] font-medium text-slate-500 bg-slate-100/70 px-1.5 py-0.5 rounded">
                            {contact.contactCode || `CN${contact.id.substring(0, 5).toUpperCase()}`}
                          </span>
                        );
                        break;

                      case "fullName":
                        content = (
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 bg-indigo-600/10 text-indigo-700 flex items-center justify-center font-medium text-[10px] uppercase shrink-0 border border-indigo-600/20">
                              {(contact.fullName || contact.name || "C").substring(0, 1)}
                            </div>
                            <span 
                              onClick={() => onViewDetails(contact.id)}
                              className="font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer text-xs whitespace-nowrap crm-text-wrap block"
                            >
                              {contact.fullName || contact.name}
                            </span>
                          </div>
                        );
                        break;

                      case "title":
                        content = <span className="font-medium text-slate-700">{localizeBusinessDescriptor(contact.title, locale) || "-"}</span>;
                        break;

                      case "mobilePhone":
                      case "workPhone": {
                        const ph = colKey === "mobilePhone" ? contact.mobilePhone || contact.phone : contact.workPhone;
                        content = ph ? (
                          <button
                            onClick={() => onCall(contact)}
                            className="font-mono font-medium text-slate-700 hover:text-indigo-600 whitespace-nowrap hover:underline cursor-pointer flex items-center gap-1 focus:outline-none"
                          >
                            <Phone size={11} className="text-slate-400" />
                            <span>{ph}</span>
                          </button>
                        ) : "-";
                        break;
                      }

                      case "workEmail":
                      case "personalEmail": {
                        const em = colKey === "workEmail" ? contact.workEmail || contact.email : contact.personalEmail;
                        content = em ? (
                          <button
                            onClick={() => onEmail(contact)}
                            className="font-mono text-xs text-indigo-600 hover:text-indigo-800 hover:underline crm-text-wrap block text-left w-full focus:outline-none"
                          >
                            {em}
                          </button>
                        ) : "-";
                        break;
                      }

                      case "zalo":
                        content = <span className="font-mono text-slate-500 select-all">{contact.zaloId || contact.zalo || "-"}</span>;
                        break;

                      case "companyName":
                        content = <span className="font-medium text-slate-700">{contact.companyName || getCustomerDisplayNameForContact(contact) || "-"}</span>;
                        break;

                      case "status": {
                        const stStr = contact.status || "active";
                        content = (
                          <Badge variant={getContactStatusBadgeVariant(stStr)} size="sm">
                            {t(`contactStatus.${stStr}`)}
                          </Badge>
                        );
                        break;
                      }

                      case "relationshipLevel":
                        content = contact.relationshipLevel ? (
                          <span className="font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {tx(`contactRelationshipLevel.${contact.relationshipLevel}`, contact.relationshipLevel)}
                          </span>
                        ) : "-";
                        break;

                      case "decisionRole":
                        content = contact.decisionRole ? (
                          <span className="text-[10.5px] text-slate-600 font-medium">
                            {tx(`contactDecisionRole.${contact.decisionRole}`, contact.decisionRole)}
                          </span>
                        ) : "-";
                        break;

                      case "ownerId":
                        content = (
                          <span className="font-medium text-slate-700">
                            {owner?.name || tx("contactList.preview.unassigned", "Chưa phân công")}
                          </span>
                        );
                        break;

                      case "source":
                        content = contact.source ? <span className="text-slate-500 font-medium">{contact.source}</span> : "-";
                        break;

                      case "lastInteractionAt": {
                        const dt = contact.lastInteractionAt || contact.lastContactedAt;
                        content = dt ? (
                          <span className="font-mono text-slate-500">{new Date(dt).toLocaleDateString()}</span>
                        ) : "-";
                        break;
                      }

                      case "nextFollowUpAt": {
                        const dt = contact.nextFollowUpAt;
                        const isOverdue = dt && new Date(dt) < new Date();
                        content = dt ? (
                          <span className={`font-mono font-medium flex items-center gap-1 ${isOverdue ? "text-rose-600 font-semibold shrink-0" : "text-emerald-600"}`}>
                            <Clock size={11} />
                            <span>{new Date(dt).toLocaleDateString()}</span>
                          </span>
                        ) : "-";
                        break;
                      }

                      case "openOpportunityCount": {
                        const cnt = contact.openOpportunityCount || 0;
                        content = (
                          <span className="font-mono font-medium font-semibold text-slate-800">
                            {cnt}
                          </span>
                        );
                        break;
                      }

                      case "tags":
                        content = contact.tags && contact.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[150px]">
                            {contact.tags.map(tg => (
                              <span key={tg} className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-medium px-1.5 py-0.5 rounded">
                                {tg}
                              </span>
                            ))}
                          </div>
                        ) : "-";
                        break;
                    }

                    return (
                      <TableCell 
                        key={colKey}
                        style={{ 
                          width: columnWidths[colKey] || 150,
                          minWidth: columnWidths[colKey] || 150,
                          maxWidth: columnWidths[colKey] || 150
                        }} 
                        className="crm-text-wrap py-2.5 px-3 whitespace-nowrap text-xs text-slate-700 relative text-left"
                      >
                        {content}
                      </TableCell>
                    );
                  })}

                  {/* Actions Column Cell (Dropdown Trigger) */}
                  <TableCell 
                    style={{ 
                      width: actionsWidth,
                      minWidth: actionsWidth,
                      maxWidth: actionsWidth
                    }} 
                    className="p-2 text-center sticky right-0 bg-white/95 z-10 border-l border-slate-100"
                  >
                    <div>
                      <IconButton 
                        variant="secondary" 
                        size="xs"
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
                        title={tx("common.actions", "Thao tác")}
                        aria-label={tx("common.actions", "Thao tác")}
                      >
                        <MoreHorizontal size={14} className="text-slate-500" />
                      </IconButton>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

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
    </div>
  );
};
