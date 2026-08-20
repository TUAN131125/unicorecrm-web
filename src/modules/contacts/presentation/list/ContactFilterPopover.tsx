import React from "react";
import { Checkbox, Input, Select } from "@/shared/components/ui";
import { ListFilterGrid, ListFilterPopover } from "@/components/crm/list-archetype";
import { useI18n } from "@/i18n";
import { getWorkspaceMemberOptions } from "@/platform/member-directory";

interface ContactFilterPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  ownerFilter: string;
  setOwnerFilter: (val: string) => void;
  sourceFilter: string;
  setSourceFilter: (val: string) => void;
  linkFilter: string;
  setLinkFilter: (val: string) => void;
  priorityFilter: string;
  setPriorityFilter: (val: string) => void;
  relationshipLevelFilter: string;
  setRelationshipLevelFilter: (val: string) => void;
  decisionRoleFilter: string;
  setDecisionRoleFilter: (val: string) => void;
  nextFollowUpAtFilter: string;
  setNextFollowUpAtFilter: (val: string) => void;
  lastInteractionAtFilter: string;
  setLastInteractionAtFilter: (val: string) => void;
  doNotContactFilter: boolean | null;
  setDoNotContactFilter: (val: boolean | null) => void;
  onResetAll: () => void;
}

export const ContactFilterPopover: React.FC<ContactFilterPopoverProps> = ({
  isOpen,
  onClose,
  statusFilter,
  setStatusFilter,
  ownerFilter,
  setOwnerFilter,
  sourceFilter,
  setSourceFilter,
  linkFilter,
  setLinkFilter,
  priorityFilter,
  setPriorityFilter,
  relationshipLevelFilter,
  setRelationshipLevelFilter,
  decisionRoleFilter,
  setDecisionRoleFilter,
  nextFollowUpAtFilter,
  setNextFollowUpAtFilter,
  lastInteractionAtFilter,
  setLastInteractionAtFilter,
  doNotContactFilter,
  setDoNotContactFilter,
  onResetAll,
}) => {
  const { t, tx, locale } = useI18n();
  const isVi = locale === "vi";
  const allLabel = tx("contactList.filters.all", isVi ? "Tất cả" : "All");

  return (
    <ListFilterPopover
      isOpen={isOpen}
      onClose={onClose}
      onReset={onResetAll}
      ariaLabel={isVi ? "Bộ lọc liên hệ" : "Contact filters"}
      resetLabel={tx("contactList.filters.clear", isVi ? "Đặt lại" : "Reset")}
      doneLabel={tx("common.done", isVi ? "Hoàn tất" : "Done")}
    >
      <ListFilterGrid>
        <Select label={tx("contactList.filters.status", isVi ? "Trạng thái" : "Status")} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">{allLabel}</option>
          <option value="active">{t("contactStatus.active")}</option>
          <option value="needs_follow_up">{t("contactStatus.needs_follow_up")}</option>
          <option value="in_consulting">{t("contactStatus.in_consulting")}</option>
          <option value="has_open_opportunity">{t("contactStatus.has_open_opportunity")}</option>
          <option value="inactive">{t("contactStatus.inactive")}</option>
          <option value="do_not_contact">{t("contactStatus.do_not_contact")}</option>
          <option value="archived">{t("contactStatus.archived")}</option>
        </Select>

        <Select label={tx("contactList.filters.owner", isVi ? "Người phụ trách" : "Owner")} value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
          <option value="all">{allLabel}</option>
          {getWorkspaceMemberOptions().map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
        </Select>

        <Select label={tx("contactList.filters.customerLink", isVi ? "Liên kết khách hàng" : "Customer link")} value={linkFilter} onChange={(event) => setLinkFilter(event.target.value)}>
          <option value="all">{allLabel}</option>
          <option value="linked">{t("contactList.filters.linked")}</option>
          <option value="unlinked">{t("contactList.filters.unlinked")}</option>
        </Select>

        <Select label={tx("contactList.filters.priority", isVi ? "Mức độ ưu tiên" : "Priority")} value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
          <option value="all">{allLabel}</option>
          <option value="LOW">{t("contactList.priority.low")}</option>
          <option value="MEDIUM">{t("contactList.priority.medium")}</option>
          <option value="HIGH">{t("contactList.priority.high")}</option>
          <option value="URGENT">{t("contactList.priority.urgent")}</option>
        </Select>

        <Select label={tx("contactForm.relationshipLevel", isVi ? "Mức độ quan hệ" : "Relationship level")} value={relationshipLevelFilter} onChange={(event) => setRelationshipLevelFilter(event.target.value)}>
          <option value="all">{allLabel}</option>
          <option value="cold">{tx("contactRelationshipLevel.cold", isVi ? "Mới" : "Cold")}</option>
          <option value="warm">{tx("contactRelationshipLevel.warm", isVi ? "Đang phát triển" : "Warm")}</option>
          <option value="good">{tx("contactRelationshipLevel.good", isVi ? "Tốt" : "Good")}</option>
          <option value="strong">{tx("contactRelationshipLevel.strong", isVi ? "Bền chặt" : "Strong")}</option>
          <option value="vip">VIP</option>
        </Select>

        <Select label={tx("contactForm.decisionRole", isVi ? "Vai trò quyết định" : "Decision role")} value={decisionRoleFilter} onChange={(event) => setDecisionRoleFilter(event.target.value)}>
          <option value="all">{allLabel}</option>
          <option value="decision_maker">{tx("contactDecisionRole.decisionDetail", isVi ? "Người quyết định" : "Decision maker")}</option>
          <option value="influencer">{tx("contactDecisionRole.influencer", isVi ? "Người ảnh hưởng" : "Influencer")}</option>
          <option value="user">{tx("contactDecisionRole.user", isVi ? "Người sử dụng" : "User")}</option>
          <option value="buyer">{tx("contactDecisionRole.buyer", isVi ? "Người mua" : "Buyer")}</option>
          <option value="technical">{tx("contactDecisionRole.technical", isVi ? "Kỹ thuật" : "Technical")}</option>
          <option value="finance">{tx("contactDecisionRole.finance", isVi ? "Tài chính" : "Finance")}</option>
          <option value="other">{tx("contactDecisionRole.other", isVi ? "Khác" : "Other")}</option>
        </Select>

        <Select label={tx("contactList.filters.source", isVi ? "Nguồn liên hệ" : "Source")} value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
          <option value="all">{allLabel}</option>
          <option value="Website">Website</option>
          <option value="Hội thảo / Webinar">{isVi ? "Hội thảo / Webinar" : "Event / Webinar"}</option>
          <option value="Giới thiệu / Referral">{isVi ? "Giới thiệu" : "Referral"}</option>
          <option value="Facebook">Facebook</option>
          <option value="Google Search">Google Search</option>
        </Select>

        <Input label={tx("contactForm.nextFollowUpAt", isVi ? "Ngày chăm sóc tiếp" : "Next follow-up date")} type="date" value={nextFollowUpAtFilter} onChange={(event) => setNextFollowUpAtFilter(event.target.value)} />
        <Input label={tx("contactList.preview.lastOutreach", isVi ? "Ngày tương tác gần nhất" : "Last interaction date")} type="date" value={lastInteractionAtFilter} onChange={(event) => setLastInteractionAtFilter(event.target.value)} />
      </ListFilterGrid>

      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
        <Checkbox
          id="filter-popover-dnc-checkbox"
          checked={doNotContactFilter === true}
          onChange={(event) => setDoNotContactFilter(event.target.checked ? true : null)}
          label={<span className="text-xs font-medium text-slate-700">{tx("contactForm.doNotContact", isVi ? "Không liên hệ" : "Do not contact")}</span>}
        />
      </div>
    </ListFilterPopover>
  );
};
