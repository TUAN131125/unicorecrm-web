import React from "react";
import { Phone, Mail, Clock, CheckSquare, Sparkles } from "lucide-react";
import type { Lead, LeadCampaign } from "../../domain/model/lead.types";

import { useI18n } from "@/i18n";
import { localizeBusinessDescriptor } from "@/shared/lib/i18n/businessDescriptorLabels";
import { Avatar, Badge, IconButton } from "@/shared/components/ui";
import { formatPhone } from "@/shared/lib/format/phone";
import { formatDate } from "@/shared/lib/format/date";
import { LeadActionMenu } from "./LeadActionMenu";
import { getLeadBadgeVariant, getLeadLifecycleLabel } from "../leadLifecyclePresentation";
import type { WorkspaceMemberDirectoryEntry } from "@/platform/member-directory";
import type { Product } from "@/modules/products";
import { getLeadMemberDisplay } from "../hooks/useLeadReferenceData";

interface LeadMobileCardListProps {
  filteredLeads: Lead[];
  selectedLeadIds: string[];
  onSelectRow: (id: string, checked: boolean) => void;
  openRowActionId: string | null;
  setOpenRowActionId: (id: string | null) => void;
  campaigns: LeadCampaign[];
  memberById: ReadonlyMap<string, WorkspaceMemberDirectoryEntry>;
  productById: ReadonlyMap<string, Product>;
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

export const LeadMobileCardList: React.FC<LeadMobileCardListProps> = ({
  filteredLeads,
  selectedLeadIds,
  onSelectRow,
  openRowActionId,
  setOpenRowActionId,
  campaigns,
  memberById,
  productById,
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
  const { t, locale } = useI18n();


  return (
    <div data-data-surface="list" className="space-y-3 p-3 font-sans md:hidden">
      {filteredLeads.map((lead) => {
        const isSelected = selectedLeadIds.includes(lead.id);
        const ownerName = getLeadMemberDisplay(memberById, lead.ownerId, locale);
        const productsText = (lead.interestedProducts || [])
          .map(p => {
            const pId = typeof p === "string" ? p : p?.productId;
            return productById.get(pId)?.name || (typeof p === "string" ? p : p?.productNameSnapshot) || pId;
          })
          .join(", ");

        return (
          <div 
            key={lead.id}
            style={{ contentVisibility: "auto", containIntrinsicSize: "240px" }}
            className={`border rounded-xl p-4 space-y-3 bg-white shadow-sm transition-all ${
              isSelected ? "border-indigo-400 ring-1 ring-indigo-400 bg-indigo-50/10" : "border-slate-100"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => onSelectRow(lead.id, e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4"
                />
                <div>
                  <h4 
                    onClick={() => onViewDetails && onViewDetails(lead.id)}
                    className="font-medium text-sm text-indigo-600 hover:underline cursor-pointer"
                  >
                    {lead.name}
                  </h4>
                  {lead.title && <span className="text-[10px] text-slate-400 font-medium">{localizeBusinessDescriptor(lead.title, locale)}</span>}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 select-none">
                <Badge variant={getLeadBadgeVariant(lead)} className="text-[9px] font-semibold px-1.5 py-0.5 uppercase border">
                  {getLeadLifecycleLabel(lead, locale)}
                </Badge>
                
                <div className="relative">
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenRowActionId(openRowActionId === lead.id ? null : lead.id);
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-slate-700 p-1"
                  >
                    <Sparkles size={13} />
                  </IconButton>
                  {openRowActionId === lead.id && (
                    <LeadActionMenu
                      lead={lead}
                      onClose={() => setOpenRowActionId(null)}
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
                </div>
              </div>
            </div>

            {lead.companyName && (
              <div className="text-xs font-medium text-slate-700">
                🏢 {lead.companyName}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-50 text-[10px] text-slate-500">
              {lead.phone && (
                <div className="flex items-center gap-1">
                  <Phone size={10} className="text-teal-500 shrink-0" />
                  <span className="font-mono">{formatPhone(lead.phone)}</span>
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-1 crm-text-wrap">
                  <Mail size={10} className="text-slate-400 shrink-0" />
                  <span className="crm-text-wrap">{lead.email}</span>
                </div>
              )}
              {lead.nextFollowUpAt && (
                <div className="col-span-2 flex items-center gap-1 text-slate-600 font-medium">
                  <Clock size={10} className="text-indigo-400" />
                  <span>{t("leads.columnNextFollowUp", "Lịch liên hệ tiếp theo")}: {formatDate(lead.nextFollowUpAt, locale)}</span>
                </div>
              )}
              {productsText && (
                <div className="col-span-2 text-slate-400 crm-text-wrap">
                  {t("leads.columnSettings.fields.interestedProducts", "Sản phẩm")}: <span className="font-semibold text-slate-600">{productsText}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-50">
              <div className="flex items-center gap-1">
                <Avatar name={ownerName} className="h-4 w-4" />
                <span className="font-medium text-slate-600">{ownerName}</span>
              </div>
              <span className="font-mono">{new Date(lead.createdAt).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US")}</span>
            </div>
          </div>
        );
      })}

      {filteredLeads.length === 0 && (
        <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <p className="text-xs font-medium">{t("leads.noLeadsFound", "Không tìm thấy cơ hội tiềm năng nào.")}</p>
        </div>
      )}
    </div>
  );
};
