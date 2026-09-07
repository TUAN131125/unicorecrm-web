import React from "react";
import { AlertCircle, Phone, Mail, Clock, RefreshCw, Eye, MoreHorizontal } from "lucide-react";
import type { Lead, LeadCampaign } from "../../domain/model/lead.types";
import type { ColumnKeyType } from "../model/leadTable.types";

import { TableResizeHeader } from "@/components/crm/TableResizeHeader";
import { useI18n } from "@/i18n";
import { localizeBusinessDescriptor } from "@/shared/lib/i18n/businessDescriptorLabels";
import { 
  Avatar, Table, TableHeader, TableBody, TableRow, TableCell, Badge, IconButton, RowActionPortal 
} from "@/shared/components/ui";
import { formatPhone } from "@/shared/lib/format/phone";
import { formatDate } from "@/shared/lib/format/date";
import { LeadActionMenu } from "./LeadActionMenu";
import { getLeadBadgeVariant, getLeadLifecycleLabel } from "../leadLifecyclePresentation";
import { resolveWorkspaceMemberLabel, type WorkspaceMemberDirectoryEntry } from "@/platform/member-directory";
import type { Product } from "@/modules/products";
import { getLeadMemberDisplay } from "../hooks/useLeadReferenceData";
import { useConfigurationRuntime } from "@/platform/configuration-runtime";

interface LeadTableProps {
  filteredLeads: Lead[];
  visibleColumns: ColumnKeyType[];
  columnWidths: Record<string, number>;
  selectedLeadIds: string[];
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  onColumnResize: (e: React.MouseEvent, colKey: string) => void;
  onColumnReset: (colKey: string) => void;
  openRowActionId: string | null;
  setOpenRowActionId: (id: string | null) => void;
  campaigns: LeadCampaign[];
  memberById: ReadonlyMap<string, WorkspaceMemberDirectoryEntry>;
  productById: ReadonlyMap<string, Product>;
  getReturnToUrl: (mode: "table" | "kanban") => string;
  onCall?: (lead: Lead) => void;
  onMarkContacted?: (leadId: string) => void;
  onQualify?: (leadId: string) => void;
  onDisqualify?: (leadId: string) => void;
  onReopen?: (leadId: string) => void;
  onFollowUp?: (leadId: string) => void;
  onConvert?: (leadId: string) => void;
  onArchive?: (leadId: string) => void;
  onViewDetails?: (leadId: string) => void;
}

export const LeadTable: React.FC<LeadTableProps> = ({
  filteredLeads,
  visibleColumns,
  columnWidths,
  selectedLeadIds,
  onSelectAll,
  onSelectRow,
  onColumnResize,
  onColumnReset,
  openRowActionId,
  setOpenRowActionId,
  campaigns,
  memberById,
  productById,
  getReturnToUrl,
  onCall,
  onMarkContacted,
  onQualify,
  onDisqualify,
  onReopen,
  onFollowUp,
  onConvert,
  onArchive,
  onViewDetails
}) => {
  const { t, tx, locale } = useI18n();
  const configurationRuntime = useConfigurationRuntime();
  const customFieldByKey = React.useMemo(() => new Map(
    (configurationRuntime.objectSchemas.find((schema) => schema.objectType === "lead")?.fields ?? [])
      .filter((field) => field.origin === "CUSTOM" && field.status === "ACTIVE")
      .map((field) => [field.key, field]),
  ), [configurationRuntime.objectSchemas]);
  const getColumnLabel = React.useCallback((columnKey: string) => {
    const customField = customFieldByKey.get(columnKey);
    if (customField) return customField.labels[locale] || customField.labels.vi || columnKey;
    return tx(`leads.columnSettings.fields.${columnKey}`, columnKey);
  }, [customFieldByKey, locale, tx]);
  const [rowActionAnchorEl, setRowActionAnchorEl] = React.useState<HTMLElement | null>(null);

  const activeLead = React.useMemo(() => {
    return filteredLeads.find((l) => l.id === openRowActionId) || null;
  }, [filteredLeads, openRowActionId]);

  React.useEffect(() => {
    if (!openRowActionId) {
      setRowActionAnchorEl(null);
    }
  }, [openRowActionId]);


  return (
    <div className="overflow-x-auto crm-scroll-x font-sans">
      <Table style={{ tableLayout: "fixed", width: "150%" }} className="min-w-full">
        <TableHeader>
          <TableRow className="bg-slate-50/70 border-b border-slate-200">
            <TableCell 
              style={{ 
                width: columnWidths.selection || 48,
                minWidth: columnWidths.selection || 48,
                maxWidth: columnWidths.selection || 48
              }} 
              className="text-center select-none sticky left-0 bg-slate-50 z-20 p-2.5 border-r border-slate-100"
            >
              <input
                type="checkbox"
                checked={filteredLeads.length > 0 && selectedLeadIds.length === filteredLeads.length}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-3.5 w-3.5"
              />
            </TableCell>
            
            {/* Dynamic Headers */}
            {visibleColumns.map((colKey) => (
              <TableResizeHeader
                key={colKey}
                colKey={colKey}
                width={columnWidths[colKey] || 150}
                label={getColumnLabel(colKey)}
                onResize={onColumnResize}
                onReset={onColumnReset}
                tooltip={tx("leads.columnSettings.columnResizeTooltip", "Kéo để đổi kích thước, nhấp đúp để khôi phục")}
              />
            ))}
            
            {/* Fixed Actions Column */}
            <TableCell 
              style={{ 
                width: columnWidths.actions || 120,
                minWidth: columnWidths.actions || 120,
                maxWidth: columnWidths.actions || 120
              }} 
              className="font-medium text-slate-700 text-[11px] uppercase tracking-wider text-center sticky right-0 bg-slate-50 py-2 px-3 whitespace-nowrap z-20 border-l border-slate-100"
            >
              {tx("common.actions", "Thao tác")}
            </TableCell>
          </TableRow>
        </TableHeader>

        <TableBody>
          {filteredLeads.length === 0 ? (
            <TableRow>
              <TableCell colSpan={visibleColumns.length + 2} className="text-center py-10 text-slate-400">
                <AlertCircle className="mx-auto text-slate-300 mb-2" size={24} />
                <p className="font-medium text-xs">{tx("leads.noLeadsFound", "Không tìm thấy cơ hội tiềm năng nào.")}</p>
              </TableCell>
            </TableRow>
          ) : (
            filteredLeads.map((lead) => {
              const isSelected = selectedLeadIds.includes(lead.id);
              const ownerName = getLeadMemberDisplay(memberById, lead.ownerId, locale);

              return (
                <TableRow 
                  key={lead.id} 
                  style={{ contentVisibility: "auto", containIntrinsicSize: "52px" }}
                  className={`hover:bg-indigo-50/20 border-b border-indigo-50/50 transition-colors ${
                    isSelected ? "bg-indigo-50/30" : ""
                  }`}
                >
                  {/* selection checkbox */}
                  <TableCell 
                    style={{ 
                      width: columnWidths.selection || 48,
                      minWidth: columnWidths.selection || 48,
                      maxWidth: columnWidths.selection || 48
                    }} 
                    className="text-center p-2.5 sticky left-0 bg-white/95 select-none z-10 border-r border-slate-100"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => onSelectRow(lead.id, e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-3.5 w-3.5"
                    />
                  </TableCell>

                  {/* Rendering dynamic columns */}
                  {visibleColumns.map((colKey) => {
                    let content: React.ReactNode = "-";

                    switch (colKey) {
                      case "tags":
                        content = lead.tags && lead.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[150px]">
                            {lead.tags.map(tg => (
                              <span key={tg} className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-medium px-1.5 py-0.5 rounded">
                                {tg}
                              </span>
                            ))}
                          </div>
                        ) : "-";
                        break;

                      case "salutation":
                        content = <span className="font-medium text-slate-700">{lead.salutation || "Anh/Chị"}</span>;
                        break;

                      case "name":
                        content = (
                          <span 
                            onClick={() => onViewDetails && onViewDetails(lead.id)}
                            className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer text-xs whitespace-nowrap block"
                          >
                            {lead.name}
                          </span>
                        );
                        break;

                      case "lastName": {
                        const parts = (lead.name || "").trim().split(/\s+/);
                        content = <span className="text-slate-600 text-[11px]">{parts.length > 1 ? parts.slice(0, parts.length - 1).join(" ") : "-"}</span>;
                        break;
                      }

                      case "firstName": {
                        const pParts = (lead.name || "").trim().split(/\s+/);
                        content = <span className="font-semibold text-slate-800 text-[11px]">{pParts[pParts.length - 1] || "-"}</span>;
                        break;
                      }

                      case "title":
                        content = <span className="text-slate-500 font-medium whitespace-nowrap">{localizeBusinessDescriptor(lead.title, locale)}</span>;
                        break;

                      case "phone":
                        content = lead.phone ? (
                          <a href={`tel:${lead.phone}`} className="hover:underline inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-teal-600 whitespace-nowrap">
                            <Phone size={10} className="text-teal-500 shrink-0" />
                            <span>{formatPhone(lead.phone)}</span>
                          </a>
                        ) : "-";
                        break;

                      case "companyPhone":
                        content = lead.companyPhone ? (
                          <span className="font-mono text-[11px] whitespace-nowrap">{formatPhone(lead.companyPhone)}</span>
                        ) : "-";
                        break;

                      case "email":
                        content = lead.email ? (
                          <a href={`mailto:${lead.email}`} className="text-slate-600 hover:underline hover:text-indigo-600 flex items-center gap-0.5 whitespace-nowrap">
                            <Mail size={10} className="text-slate-400" />
                            {lead.email}
                          </a>
                        ) : "-";
                        break;

                      case "personalEmail":
                        content = lead.personalEmail ? <span className="text-slate-500">{lead.personalEmail}</span> : "-";
                        break;

                      case "companyName":
                        content = <span className="font-semibold text-slate-800 whitespace-nowrap">{lead.companyName || "-"}</span>;
                        break;

                      case "address":
                        content = <span className="text-slate-500 max-w-[120px] crm-text-wrap block" title={lead.address}>{lead.address || "-"}</span>;
                        break;

                      case "city":
                        content = <span className="text-slate-600 font-medium whitespace-nowrap">{lead.city || "-"}</span>;
                        break;

                      case "district":
                        content = <span className="text-slate-500 whitespace-nowrap">{lead.district || "-"}</span>;
                        break;

                      case "ward":
                        content = <span className="text-slate-500 whitespace-nowrap">{lead.ward || "-"}</span>;
                        break;

                      case "source":
                        content = (
                          <Badge variant="neutral" className="border border-slate-100 bg-slate-50 shrink-0 whitespace-nowrap text-[10px] font-medium">
                            {lead.source}
                          </Badge>
                        );
                        break;

                      case "companyType":
                        content = <span className="text-slate-600">{lead.companyType || "-"}</span>;
                        break;

                      case "industry":
                        content = <span className="text-slate-500 font-medium">{lead.industry || "-"}</span>;
                        break;

                      case "description":
                        content = <span className="text-slate-400 max-w-[150px] crm-text-wrap block" title={lead.description || lead.notes}>{lead.description || lead.notes || "-"}</span>;
                        break;

                      case "ownerId":
                        content = (
                          <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
                            <Avatar name={ownerName} className="h-5 w-5" />
                            <span className="font-semibold text-slate-700 text-[11px]">{ownerName}</span>
                          </div>
                        );
                        break;

                      case "createdBy":
                        content = <span className="text-slate-600 font-medium">{lead.createdBy ? resolveWorkspaceMemberLabel(lead.createdBy, locale) : (locale === "vi" ? "Hệ thống" : "System")}</span>;
                        break;

                      case "createdAt":
                        content = <span className="text-slate-500 font-mono text-[10px] whitespace-nowrap">{formatDate(lead.createdAt, locale)}</span>;
                        break;

                      case "updatedBy":
                        content = <span className="text-slate-600">{lead.updatedBy ? resolveWorkspaceMemberLabel(lead.updatedBy, locale) : (locale === "vi" ? "Hệ thống" : "System")}</span>;
                        break;

                      case "updatedAt":
                        content = lead.updatedAt ? <span className="text-slate-500 font-mono text-[10px] whitespace-nowrap">{formatDate(lead.updatedAt, locale)}</span> : "-";
                        break;

                      case "status": {
                        content = (
                          <Badge variant={getLeadBadgeVariant(lead)} className="text-[10px] font-medium px-2 py-0.5 border">
                            {getLeadLifecycleLabel(lead, locale)}
                          </Badge>
                        );
                        break;
                      }

                      case "nextFollowUpAt":
                        content = lead.nextFollowUpAt ? (
                          <div className="flex items-center gap-1 text-slate-500 whitespace-nowrap text-[11px] font-semibold font-mono">
                            <Clock size={11} className="text-indigo-400 shrink-0" />
                            {formatDate(lead.nextFollowUpAt, locale)}
                          </div>
                        ) : (
                          <span className="text-slate-300 italic text-[10px]">{tx("leads.notScheduled", "Chưa đặt lịch")}</span>
                        );
                        break;

                      case "lastInteractionAt":
                        content = lead.lastInteractionAt ? (
                          <span className="text-slate-500 font-mono text-[10px] whitespace-nowrap">{formatDate(lead.lastInteractionAt, locale)}</span>
                        ) : "-";
                        break;

                      case "disqualificationReason":
                        content = <span className="text-red-500 font-medium max-w-[120px] crm-text-wrap block" title={lead.disqualificationReason}>{lead.disqualificationReason || "-"}</span>;
                        break;

                      case "recontactAt":
                        content = lead.recontactAt ? (
                          <div className="flex items-center gap-1 text-teal-600 font-semibold font-mono text-[11px] whitespace-nowrap">
                            <RefreshCw size={11} className="text-teal-400 shrink-0" />
                            {formatDate(lead.recontactAt, locale)}
                          </div>
                        ) : "-";
                        break;

                      case "interestedProducts": {
                        const mappedNames = (lead.interestedProducts || []).map(p => {
                          const pId = typeof p === "string" ? p : p?.productId;
                          return productById.get(pId)?.name || (typeof p === "string" ? p : p?.productNameSnapshot) || pId;
                        }).join(", ");
                        content = mappedNames ? (
                          <span className="text-slate-600 font-medium max-w-[150px] crm-text-wrap block" title={mappedNames}>{mappedNames}</span>
                        ) : "-";
                        break;
                      }

                      case "campaignId": {
                        const cmpName = campaigns.find(c => c.id === lead.campaignId)?.name || "-";
                        content = <span className="text-indigo-600 whitespace-nowrap font-medium">{cmpName}</span>;
                        break;
                      }

                      default: {
                        const value = lead.customFields?.[colKey];
                        const displayValue = Array.isArray(value)
                          ? value.join(", ")
                          : typeof value === "boolean"
                            ? (value ? tx("common.yes", "Có") : tx("common.no", "Không"))
                            : value;
                        content = displayValue === undefined || displayValue === ""
                          ? "-"
                          : <span className="text-slate-600" title={String(displayValue)}>{String(displayValue)}</span>;
                        break;
                      }
                    }

                    return (
                      <TableCell 
                        key={colKey} 
                        style={{ 
                          width: columnWidths[colKey] || 150,
                          minWidth: columnWidths[colKey] || 150,
                          maxWidth: columnWidths[colKey] || 150
                        }}
                        className="py-2.5 px-3 text-slate-700 text-[11px] text-left align-middle border-r border-slate-50 crm-text-wrap"
                      >
                        {content}
                      </TableCell>
                    );
                  })}

                  {/* Sticky Action Column based on status */}
                  <TableCell 
                    style={{ 
                      width: columnWidths.actions || 120,
                      minWidth: columnWidths.actions || 120,
                      maxWidth: columnWidths.actions || 120
                    }} 
                    className="p-2 py-2.5 text-center sticky right-0 bg-white/95 select-none z-20 border-l border-slate-100 flex items-center justify-center gap-1.5"
                  >
                    {/* QUICK VIEW DETAILS */}
                    <IconButton
                      onClick={() => onViewDetails && onViewDetails(lead.id)}
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-indigo-600"
                      title={tx("leads.viewDetailsTooltip", "Xem chi tiết")}
                    >
                      <Eye size={13} />
                    </IconButton>

                    {/* ROW LEVEL MORE ACTIONS DROPDOWN */}
                    <div>
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          const target = e.currentTarget as HTMLElement;
                          if (openRowActionId === lead.id) {
                            setOpenRowActionId(null);
                            setRowActionAnchorEl(null);
                          } else {
                            setOpenRowActionId(lead.id);
                            setRowActionAnchorEl(target);
                          }
                        }}
                        variant="ghost"
                        size="sm"
                        title={tx("common.moreActions", "Thêm thao tác")}
                        className="text-slate-400 hover:text-slate-700 row-more-btn"
                      >
                        <MoreHorizontal size={14} />
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
        open={Boolean(openRowActionId && activeLead)}
        anchorEl={rowActionAnchorEl}
        onClose={() => {
          setOpenRowActionId(null);
          setRowActionAnchorEl(null);
        }}
        width={240}
        role="menu"
        ariaLabel="Lead actions"
        autoFocusFirstMenuItem
      >
        {activeLead && (
          <LeadActionMenu
            lead={activeLead}
            onClose={() => {
              setOpenRowActionId(null);
              setRowActionAnchorEl(null);
            }}
            onCall={onCall}
            onMarkContacted={onMarkContacted}
            onQualify={onQualify}
            onDisqualify={onDisqualify}
            onReopen={onReopen}
            onFollowUp={onFollowUp}
            onConvert={onConvert}
            onArchive={onArchive}
            onViewDetails={onViewDetails}
          />
        )}
      </RowActionPortal>
    </div>
  );
};
