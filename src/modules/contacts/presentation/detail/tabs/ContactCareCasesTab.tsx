import React from "react";
import { ArrowRight, HeartHandshake, Plus } from "lucide-react";
import { useI18n } from "@/i18n";
import type { SupportCase } from "@/modules/support";
import { DetailTabActionButton } from "@/shared/components/ui";
import { RelationshipModuleActions, RelationshipWorkspaceHeader } from "@/components/crm/relationship-detail";
import { resolveWorkspaceMemberName } from "@/platform/member-directory";

interface ContactCareCasesTabProps {
  cases: SupportCase[];
  onCreateCase: () => void;
  onOpenCase: (caseId: string) => void;
  onOpenModule: () => void;
  isArchived?: boolean;
}

const statusLabel = (status: SupportCase["status"], vi: boolean) => ({
  new: vi ? "Mới" : "New",
  in_progress: vi ? "Đang xử lý" : "In progress",
  waiting_customer: vi ? "Chờ khách hàng" : "Waiting customer",
  waiting_internal: vi ? "Chờ nội bộ" : "Waiting internal",
  resolved: vi ? "Đã giải quyết" : "Resolved",
  closed: vi ? "Đã đóng" : "Closed",
  reopened: vi ? "Mở lại" : "Reopened",
  cancelled: vi ? "Đã hủy" : "Cancelled",
})[status];

export const ContactCareCasesTab: React.FC<ContactCareCasesTabProps> = ({ cases, onCreateCase, onOpenCase, onOpenModule, isArchived = false }) => {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const activeCount = cases.filter((item) => !["resolved", "closed", "cancelled"].includes(item.status)).length;

  return (
    <div id="contact-care-cases-tab" className="space-y-5 text-left text-xs text-slate-700">
      <RelationshipWorkspaceHeader
        title={`${vi ? "Phiếu hỗ trợ" : "Support tickets"} (${activeCount} ${vi ? "đang mở" : "active"})`}
        actions={<RelationshipModuleActions secondaryLabel={vi ? "Mở Hỗ trợ" : "Open Support"} primaryLabel={!isArchived ? (vi ? "Tạo phiếu hỗ trợ" : "Create support ticket") : undefined} onSecondary={onOpenModule} onPrimary={!isArchived ? onCreateCase : undefined} />}
      />

      {cases.length === 0 ? (
        <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
          <HeartHandshake size={26} className="text-slate-300" />
          <div className="mt-3 text-xs font-semibold text-slate-500">{vi ? "Chưa có phiếu hỗ trợ liên quan." : "No related support tickets yet."}</div>
          {!isArchived && <DetailTabActionButton actionIntent="create" onClick={onCreateCase} icon={<Plus size={14} />} className="mt-3">{vi ? "Tạo phiếu hỗ trợ" : "Create support ticket"}</DetailTabActionButton>}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {cases.map((item) => (
            <button type="button" key={item.id} onClick={() => onOpenCase(item.id)} className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-violet-200 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-600">{item.caseNumber}</div>
                  <div className="mt-1 crm-text-wrap break-words text-xs font-semibold text-slate-900 [overflow-wrap:anywhere]">{item.title}</div>
                </div>
                <ArrowRight size={14} className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-violet-500" />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[9px] font-semibold">
                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{statusLabel(item.status, vi)}</span>
                <span className="rounded-full bg-violet-50 px-2 py-1 text-violet-700">{item.category}</span>
                <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">{item.priority}</span>
              </div>
              <div className="mt-3 text-[10px] text-slate-500">
                {vi ? "Phụ trách" : "Owner"}: <span className="font-semibold text-slate-700">{item.ownerId ? resolveWorkspaceMemberName(item.ownerId) : (item.ownerName || "—")}</span>
              </div>
              {item.nextFollowUpAt && <div className="mt-1 text-[10px] text-slate-400">{vi ? "Hẹn tiếp theo" : "Next follow-up"}: {new Date(item.nextFollowUpAt).toLocaleString(vi ? "vi-VN" : "en-US")}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
