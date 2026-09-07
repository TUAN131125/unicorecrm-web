import React from "react";
import { Archive, Eye, Phone, CheckSquare, Clock, CheckCircle2, ArrowUpRight, Unlock, X } from "lucide-react";
import type { Lead } from "../../domain/model/lead.types";
import { LeadWorkState, QualificationOutcome } from "../../domain/model/leadLifecycle.canonical";

import { MenuItemButton } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { evaluateLeadContactPolicy, getLeadContactPolicyMessage, LeadContactChannel } from "../../domain/rules/leadContactPolicy";

interface LeadActionMenuProps {
  lead: Lead;
  onClose: () => void;
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

export const LeadActionMenu: React.FC<LeadActionMenuProps> = ({
  lead,
  onClose,
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
  const { tx, locale } = useI18n();
  const callPolicy = evaluateLeadContactPolicy(lead, LeadContactChannel.CALL);

  return (
    <div className="lead-action-menu w-full bg-white rounded-xl border border-slate-200 outline-none shadow-xl p-1.5 font-sans text-left space-y-0.5 max-h-[380px] overflow-y-auto crm-scroll-y">
      <MenuItemButton 
        onClick={(e) => {
          e.stopPropagation();
          onClose();
          if (onViewDetails) onViewDetails(lead.id);
        }}
        icon={<Eye size={14} className="text-slate-500" />}
      >
        {tx("leads.actionMenu.view", "Xem chi tiết")}
      </MenuItemButton>

      {(lead.leadWorkState === LeadWorkState.NEW || lead.leadWorkState === LeadWorkState.CONTACTING) && lead.phone && onCall && (
        <MenuItemButton 
          disabled={!callPolicy.allowed}
          tooltip={!callPolicy.allowed ? getLeadContactPolicyMessage(callPolicy.reason, locale) : undefined}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
            onCall(lead);
          }}
          icon={<Phone size={14} className="text-teal-600" />}
        >
          {tx("leads.actionMenu.call", "Thực hiện cuộc gọi")}
        </MenuItemButton>
      )}

      {lead.leadWorkState === LeadWorkState.NEW && (
        <>
          {onMarkContacted && (
            <MenuItemButton 
              onClick={(e) => {
                e.stopPropagation();
                onClose();
                onMarkContacted(lead.id);
              }}
              icon={<CheckSquare size={14} className="text-amber-500" />}
            >
              {tx("leads.actionMenu.markContacted", "Đánh dấu đã liên hệ")}
            </MenuItemButton>
          )}
          {onFollowUp && (
            <MenuItemButton 
              onClick={(e) => {
                e.stopPropagation();
                onClose();
                onFollowUp(lead.id);
              }}
              icon={<Clock size={14} className="text-indigo-600" />}
            >
              {tx("leads.actionMenu.scheduleOutreach", "Đặt lịch chăm sóc")}
            </MenuItemButton>
          )}
        </>
      )}

      {lead.leadWorkState === LeadWorkState.CONTACTING && (
        <>
          {onQualify && (
            <MenuItemButton 
              onClick={(e) => {
                e.stopPropagation();
                onClose();
                onQualify(lead.id);
              }}
              icon={<CheckCircle2 size={14} className="text-emerald-600" />}
            >
              {tx("leads.actionMenu.startVerifying", "Bắt đầu xác minh")}
            </MenuItemButton>
          )}
          {onFollowUp && (
            <MenuItemButton 
              onClick={(e) => {
                e.stopPropagation();
                onClose();
                onFollowUp(lead.id);
              }}
              icon={<Clock size={14} className="text-indigo-600" />}
            >
              {tx("leads.actionMenu.scheduleContact", "Đặt lịch liên hệ lại")}
            </MenuItemButton>
          )}
        </>
      )}

      {lead.leadWorkState === LeadWorkState.VERIFYING && onConvert && (
        <MenuItemButton 
          onClick={(e) => {
            e.stopPropagation();
            onClose();
            onConvert(lead.id);
          }}
          variant="primary"
          icon={<ArrowUpRight size={14} />}
        >
          {tx("leads.actionMenu.resolveOutcome", "Chốt kết quả")}
        </MenuItemButton>
      )}

      {lead.qualificationOutcome === QualificationOutcome.DISQUALIFIED && (
        <>
          {onReopen && (
            <MenuItemButton 
              onClick={(e) => {
                e.stopPropagation();
                onClose();
                onReopen(lead.id);
              }}
              icon={<Unlock size={14} className="text-indigo-600" />}
            >
              {tx("leads.actionMenu.reopen", "Mở lại Lead")}
            </MenuItemButton>
          )}
        </>
      )}

      {(lead.leadWorkState === LeadWorkState.NEW || lead.leadWorkState === LeadWorkState.CONTACTING || lead.leadWorkState === LeadWorkState.VERIFYING) && onDisqualify && (
        <MenuItemButton 
          onClick={(e) => {
            e.stopPropagation();
            onClose();
            onDisqualify(lead.id);
          }}
          icon={<X size={14} className="text-rose-500" />}
        >
          {tx("leads.actionMenu.disqualify", "Không đạt")}
        </MenuItemButton>
      )}

      {(!lead.qualificationOutcome || lead.qualificationOutcome === QualificationOutcome.DISQUALIFIED) && onArchive && (
        <MenuItemButton 
          variant="danger"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
            onArchive(lead.id);
          }}
          icon={<Archive size={14} />}
        >
          {locale === "vi" ? "Lưu trữ Lead" : "Archive Lead"}
        </MenuItemButton>
      )}
    </div>
  );
};
