import React from "react";
import type { LeadCampaign, LeadSource } from "../../domain/model/lead.types";
import { LeadWorkState, QualificationOutcome } from "../../domain/model/leadLifecycle.canonical";

import { getLeadWorkStateLabel, getQualificationOutcomeLabel } from "../leadLifecyclePresentation";
import { useI18n } from "@/i18n";
import { Select, Input, Checkbox } from "@/shared/components/ui";
import { ListFilterGrid, ListFilterPopover } from "@/components/crm/list-archetype";
import type { LeadSortState } from "../hooks/useLeadFilters";

interface LeadFilterOwnerOption {
  memberId: string;
  displayName: string;
}

interface LeadFilterPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  owners: LeadFilterOwnerOption[];
  sources: LeadSource[];
  campaigns: LeadCampaign[];
  sort: LeadSortState;
  setSort: (sort: LeadSortState) => void;
  filterStatus: string;
  setFilterStatus: (val: string) => void;
  filterOwner: string;
  setFilterOwner: (val: string) => void;
  filterSource: string;
  setFilterSource: (val: string) => void;
  filterCampaign: string;
  setFilterCampaign: (val: string) => void;
  filterNextFollowUpAt: string;
  setFilterNextFollowUpAt: (val: string) => void;
  filterOverdue: boolean | null;
  setFilterOverdue: (val: boolean | null) => void;
  filterQualificationOutcome: string;
  setFilterQualificationOutcome: (val: string) => void;
  filterRecontactAt: string;
  setFilterRecontactAt: (val: string) => void;
  filterConverted: string;
  setFilterConverted: (val: string) => void;
  filterDuplicate: boolean | null;
  setFilterDuplicate: (val: boolean | null) => void;
  onResetAll: () => void;
}

export const LeadFilterPopover: React.FC<LeadFilterPopoverProps> = ({
  isOpen,
  onClose,
  owners,
  sources,
  campaigns,
  sort,
  setSort,
  filterStatus,
  setFilterStatus,
  filterOwner,
  setFilterOwner,
  filterSource,
  setFilterSource,
  filterCampaign,
  setFilterCampaign,
  filterNextFollowUpAt,
  setFilterNextFollowUpAt,
  filterOverdue,
  setFilterOverdue,
  filterQualificationOutcome,
  setFilterQualificationOutcome,
  filterRecontactAt,
  setFilterRecontactAt,
  filterConverted,
  setFilterConverted,
  filterDuplicate,
  setFilterDuplicate,
  onResetAll,
}) => {
  const { tx, locale } = useI18n();
  const allLabel = tx("leads.filterPanel.allLabel", locale === "vi" ? "Tất cả" : "All");
  if (!isOpen) return null;

  const sortValue = `${sort.field}:${sort.direction}`;

  return (
    <ListFilterPopover
      isOpen={isOpen}
      onClose={onClose}
      onReset={onResetAll}
      ariaLabel={locale === "vi" ? "Bộ lọc khách hàng tiềm năng" : "Lead filters"}
      resetLabel={locale === "vi" ? "Đặt lại" : "Reset"}
      doneLabel={tx("common.done", locale === "vi" ? "Hoàn tất" : "Done")}
    >
      <ListFilterGrid>
          <Select
            label={locale === "vi" ? "Sắp xếp" : "Sort"}
            value={sortValue}
            onChange={(event) => {
              const [field, direction] = event.target.value.split(":") as [LeadSortState["field"], LeadSortState["direction"]];
              setSort({ field, direction });
            }}
          >
            <option value="createdAt:desc">{locale === "vi" ? "Mới tạo gần nhất" : "Newest created"}</option>
            <option value="name:asc">{locale === "vi" ? "Tên A–Z" : "Name A–Z"}</option>
            <option value="score:desc">{locale === "vi" ? "Điểm cao nhất" : "Highest score"}</option>
            <option value="nextFollowUpAt:asc">{locale === "vi" ? "Chăm sóc gần nhất" : "Next follow-up"}</option>
          </Select>

          <Select label={tx("leads.columnStatus", locale === "vi" ? "Trạng thái" : "Status")} value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}>
            <option value="">{allLabel}</option>
            {Object.values(LeadWorkState).map((state) => <option key={state} value={state}>{getLeadWorkStateLabel(state, locale)}</option>)}
            {Object.values(QualificationOutcome).map((outcome) => <option key={outcome} value={outcome}>{getQualificationOutcomeLabel(outcome, locale)}</option>)}
          </Select>

          <Select label={tx("leads.columnOwner", locale === "vi" ? "Chủ sở hữu" : "Owner")} value={filterOwner} onChange={(event) => setFilterOwner(event.target.value)}>
            <option value="">{allLabel}</option>
            {owners.map((owner) => <option key={owner.memberId} value={owner.memberId}>{owner.displayName}</option>)}
          </Select>

          <Select label={tx("leads.columnSource", locale === "vi" ? "Nguồn" : "Source")} value={filterSource} onChange={(event) => setFilterSource(event.target.value)}>
            <option value="">{allLabel}</option>
            {sources.map((source) => <option key={source.id} value={source.name}>{source.name}</option>)}
          </Select>

          <Select label={tx("leads.campaignLabel", locale === "vi" ? "Chiến dịch" : "Campaign")} value={filterCampaign} onChange={(event) => setFilterCampaign(event.target.value)}>
            <option value="">{allLabel}</option>
            {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
          </Select>

          <Input label={tx("leads.columnNextFollowUp", locale === "vi" ? "Ngày chăm sóc tiếp" : "Next follow-up date")} type="date" value={filterNextFollowUpAt} onChange={(event) => setFilterNextFollowUpAt(event.target.value)} />

          <Select label={locale === "vi" ? "Kết quả xác minh" : "Qualification outcome"} value={filterQualificationOutcome} onChange={(event) => setFilterQualificationOutcome(event.target.value)}>
            <option value="">{allLabel}</option>
            <option value={QualificationOutcome.NURTURE}>{locale === "vi" ? "Chăm sóc" : "Nurture"}</option>
            <option value={QualificationOutcome.DISQUALIFIED}>{locale === "vi" ? "Không phù hợp" : "Disqualified"}</option>
            <option value={QualificationOutcome.OPPORTUNITY}>{locale === "vi" ? "Cơ hội" : "Opportunity"}</option>
            <option value={QualificationOutcome.DIRECT_SALE}>{locale === "vi" ? "Bán trực tiếp" : "Direct sale"}</option>
          </Select>

          <Input label={tx("leads.filterPanel.recontactDate", locale === "vi" ? "Ngày hẹn liên hệ lại" : "Recontact date")} type="date" value={filterRecontactAt} onChange={(event) => setFilterRecontactAt(event.target.value)} />

          <Select label={tx("leads.filterPanel.convertedState", locale === "vi" ? "Trạng thái chuyển đổi" : "Conversion state")} value={filterConverted} onChange={(event) => setFilterConverted(event.target.value)}>
            <option value="">{allLabel}</option>
            <option value="yes">{tx("leads.filterPanel.convertedStateYes", locale === "vi" ? "Đã chuyển đổi" : "Converted")}</option>
            <option value="no">{tx("leads.filterPanel.convertedStateNo", locale === "vi" ? "Chưa chuyển đổi" : "Not converted")}</option>
          </Select>
      </ListFilterGrid>

      <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:grid-cols-2">
          <Checkbox
            label={tx("leads.filterPanel.overdueLabel", locale === "vi" ? "Quá hạn liên hệ" : "Overdue follow-up")}
            checked={filterOverdue === true}
            onChange={(event) => setFilterOverdue(event.target.checked ? true : null)}
          />
          <Checkbox
            label={tx("leads.filterPanel.dupSuspected", locale === "vi" ? "Có khả năng trùng" : "Possible duplicate")}
            checked={filterDuplicate === true}
            onChange={(event) => setFilterDuplicate(event.target.checked ? true : null)}
          />
      </div>
    </ListFilterPopover>
  );
};
