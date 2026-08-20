import { AuthoritativeQueryNotice, formatApplicationError } from "@/shared/operations";
import React, { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Plus, UserRound } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ListPageFrame, ListPageHeader, ListPaginationBar, ListStatePanel, ListToolbar, useListPagination } from "@/components/crm/list-archetype";
import { Button, SearchableSelect } from "@/shared/components/ui";
import { OperationFilterPopover, OperationSavedViews } from "@/components/crm/operations";
import { useI18n } from "@/i18n";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { resolveWorkspaceMemberName } from "@/platform/member-directory";
import { getCustomerCareCategoryLabel, getCustomerCarePolicy, useWorkspaceConfigSnapshot } from "@/platform/workspace-config";
import { transitionSupportCaseCommand } from "../../public/cases";
import { getAllowedSupportCaseTransitions } from "../../domain/rules/supportCaseLifecycle";
import { SUPPORT_CASE_CATEGORY_CONFIG, SUPPORT_CASE_PRIORITY_CONFIG, SUPPORT_CASE_STATUS_CONFIG } from "../../domain/rules/supportCase.config";
import type { SupportCase, SupportCaseCategory, SupportCasePriority, SupportCaseStatus } from "../../domain/model/supportCase.types";
import { querySupportCases } from "../../application/queries/supportCaseQueries";
import { useSupportCases } from "../hooks/useSupportCases";
import { resolveSupportCustomerName } from "../model/supportCustomerPresentation";

type CareView = "all" | "active" | "mine" | "waiting_customer" | "waiting_internal" | "follow_up" | "resolved";
type DisplayMode = "cards" | "table";

interface SupportCaseListPageProps {
  customers?: any[];
  contacts?: any[];
  products?: any[];
  orders?: any[];
}

const activeStatuses: SupportCaseStatus[] = ["new", "in_progress", "waiting_customer", "waiting_internal", "reopened"];
const currentCategories: SupportCaseCategory[] = ["request", "consultation", "complaint", "follow_up", "onboarding", "usage_issue", "post_purchase"];

const statusLabel = (status: SupportCaseStatus, vi: boolean) => {
  const config = SUPPORT_CASE_STATUS_CONFIG[status];
  return config ? (vi ? config.labelVi : config.labelEn) : status.replaceAll("_", " ");
};
const priorityLabel = (priority: SupportCasePriority, vi: boolean) => {
  const config = SUPPORT_CASE_PRIORITY_CONFIG[priority];
  return config ? (vi ? config.labelVi : config.labelEn) : priority;
};
const categoryLabel = (category: SupportCaseCategory, vi: boolean) => {
  const config = SUPPORT_CASE_CATEGORY_CONFIG[category];
  return config ? (vi ? config.labelVi : config.labelEn) : category.replaceAll("_", " ");
};
const priorityTone = (priority: SupportCasePriority) => priority === "critical" ? "border-rose-200 bg-rose-50 text-rose-700" : priority === "high" ? "border-amber-200 bg-amber-50 text-amber-700" : priority === "low" ? "border-slate-200 bg-slate-50 text-slate-600" : "border-indigo-200 bg-indigo-50 text-indigo-700";
const statusTone = (status: SupportCaseStatus) => status === "resolved" || status === "closed" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "cancelled" ? "border-slate-200 bg-slate-50 text-slate-600" : status === "waiting_customer" || status === "waiting_internal" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-violet-200 bg-violet-50 text-violet-700";
const followUpDue = (item: SupportCase) => {
  const nextFollowUpAt = item.nextFollowUpAt;
  if (!nextFollowUpAt) return false;
  return !["resolved", "closed", "cancelled"].includes(item.status) && new Date(nextFollowUpAt).getTime() <= Date.now() + 24 * 60 * 60 * 1000;
};

export const SupportCaseListPage: React.FC<SupportCaseListPageProps> = () => {
  const { cases, query: supportQuery } = useSupportCases();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { locale } = useI18n();
  const vi = locale === "vi";
  const workspaceConfig = useWorkspaceConfigSnapshot();
  const carePolicy = useMemo(() => getCustomerCarePolicy(workspaceConfig), [workspaceConfig]);
  const categoryLabelFor = (value: SupportCaseCategory) => getCustomerCareCategoryLabel(carePolicy, value, locale) || categoryLabel(value, vi);
  const access = useEffectiveAccess();
  const reduceMotion = useReducedMotion();
  const canCreate = access.canPerform("support", "create");
  const canTransition = (status: SupportCaseStatus) => access.can(
    status === "resolved" || status === "closed"
      ? CAPABILITIES.SUPPORT_COMPLETE
      : CAPABILITIES.SUPPORT_UPDATE,
  );
  const currentMemberId = getAuthSessionSnapshot()?.principal.memberId || access.memberId || "";
  const customerIdParam = searchParams.get("customerId");
  const [view, setView] = useState<CareView>("active");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("cards");
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [priority, setPriority] = useState<SupportCasePriority | "all">("all");
  const [category, setCategory] = useState<SupportCaseCategory | "all">("all");
  const [owner, setOwner] = useState("all");
  const [toast, setToast] = useState<string | null>(null);
  const [busyCaseId, setBusyCaseId] = useState<string | null>(null);

  const owners = useMemo(() => Array.from(new Set(cases.map((item) => item.ownerId).filter(Boolean) as string[])).sort(), [cases]);
  const queryFiltered = useMemo(() => querySupportCases(cases, { customerId: customerIdParam || undefined, search, priority, category, owner }), [cases, customerIdParam, search, priority, category, owner]);
  const filteredCases = useMemo(() => queryFiltered.filter((item) => {
    if (view === "all") return true;
    if (view === "active") return activeStatuses.includes(item.status);
    if (view === "mine") return item.ownerId === currentMemberId;
    if (view === "waiting_customer") return item.status === "waiting_customer";
    if (view === "waiting_internal") return item.status === "waiting_internal";
    if (view === "follow_up") return followUpDue(item);
    if (view === "resolved") return ["resolved", "closed"].includes(item.status);
    return true;
  }), [queryFiltered, view, currentMemberId]);

  const pagination = useListPagination(filteredCases, 25);

  const savedViews = useMemo(() => [
    { key: "all", label: vi ? "Tất cả" : "All", count: cases.length, tone: "slate" as const },
    { key: "active", label: vi ? "Đang xử lý" : "Active", count: cases.filter((item) => activeStatuses.includes(item.status)).length, tone: "violet" as const },
    { key: "mine", label: vi ? "Của tôi" : "Mine", count: cases.filter((item) => item.ownerId === currentMemberId).length, tone: "sky" as const },
    { key: "waiting_customer", label: vi ? "Chờ khách" : "Waiting customer", count: cases.filter((item) => item.status === "waiting_customer").length, tone: "amber" as const },
    { key: "waiting_internal", label: vi ? "Chờ nội bộ" : "Waiting internal", count: cases.filter((item) => item.status === "waiting_internal").length, tone: "amber" as const },
    { key: "follow_up", label: vi ? "Cần theo dõi" : "Follow-up due", count: cases.filter(followUpDue).length, tone: "rose" as const },
    { key: "resolved", label: vi ? "Đã giải quyết" : "Resolved", count: cases.filter((item) => ["resolved", "closed"].includes(item.status)).length, tone: "emerald" as const },
  ], [cases, currentMemberId, vi]);

  const applyTransition = async (supportCase: SupportCase, nextStatus: SupportCaseStatus) => {
    if (busyCaseId) return;
    setBusyCaseId(supportCase.id);
    try {
      await transitionSupportCaseCommand(supportCase.id, nextStatus, {
        actorName: getAuthSessionSnapshot()?.principal.displayName || currentMemberId,
        locale,
        resolutionSummary: nextStatus === "resolved" ? (vi ? "Đã hoàn tất xử lý yêu cầu chăm sóc." : "Care request completed.") : undefined,
      });
      setToast(vi ? "Đã cập nhật trạng thái phiếu." : "Support ticket status updated.");
    } catch (error) {
      setToast(formatApplicationError(error, { locale }));
    } finally {
      setBusyCaseId(null);
    }
  };

  const clearCustomerFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("customerId");
    setSearchParams(next);
  };

  const renderCard = (item: SupportCase) => {
    const allowed = getAllowedSupportCaseTransitions(item.status).filter(canTransition);
    return (
      <motion.article key={item.id} layout initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -8 }} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button type="button" onClick={() => navigate(item.id)} className="block max-w-full break-words text-left text-sm font-semibold text-slate-950 hover:text-indigo-700 [overflow-wrap:anywhere]">{item.caseNumber} · {item.title}</button>
            <div className="mt-1 text-[11px] text-slate-500">{resolveSupportCustomerName(item)} • {categoryLabelFor(item.category)}</div>
          </div>
          <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium ${priorityTone(item.priority)}`}>{priorityLabel(item.priority, vi)}</span>
        </div>
        <p className="mt-3 crm-text-wrap text-xs leading-5 text-slate-500">{item.description || (vi ? "Chưa có mô tả." : "No description.")}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Field label={vi ? "Trạng thái" : "Status"} value={statusLabel(item.status, vi)} />
          <Field label={vi ? "Phụ trách" : "Owner"} value={resolveWorkspaceMemberName(item.ownerId)} />
          <Field label={vi ? "Hẹn tiếp theo" : "Next follow-up"} value={item.nextFollowUpAt ? new Date(item.nextFollowUpAt).toLocaleString(vi ? "vi-VN" : "en-US") : "—"} alert={followUpDue(item)} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <span className={`rounded-full border px-2 py-1 text-[10px] font-medium ${statusTone(item.status)}`}>{statusLabel(item.status, vi)}</span>
          {allowed.length > 0 && (
            <select aria-label={vi ? `Chuyển trạng thái ${item.caseNumber}` : `Change status for ${item.caseNumber}`} disabled={Boolean(busyCaseId)} value="" onChange={(event) => { if (event.target.value) void applyTransition(item, event.target.value as SupportCaseStatus); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-700">
              <option value="">{vi ? "Chuyển trạng thái..." : "Change status..."}</option>
              {allowed.map((status) => <option key={status} value={status}>{statusLabel(status, vi)}</option>)}
            </select>
          )}
        </div>
      </motion.article>
    );
  };

  return (
    <><AuthoritativeQueryNotice connected={supportQuery.connected} loading={supportQuery.loading} refreshing={supportQuery.refreshing} stale={supportQuery.stale} loadedAt={supportQuery.loadedAt} error={supportQuery.error} onRefresh={() => void supportQuery.refresh()} compact /><ListPageFrame id="support-case-list-page">
      <ListPageHeader
        title={vi ? "Phiếu hỗ trợ" : "Support Tickets"}
        count={filteredCases.length}
        context={vi ? "Theo dõi yêu cầu, tư vấn, khiếu nại và các hoạt động chăm sóc khách hàng. Công việc chỉ được tạo khi có hành động cụ thể cần giao." : "Track customer requests, consultations, complaints and care activities. Tasks are created only for concrete assigned actions."}
        icon={<UserRound size={20} />}
        actions={canCreate ? <Button type="button" actionIntent="create" size="sm" icon={<Plus size={15} />} className="h-9 rounded-xl" onClick={() => navigate("new")}>{vi ? "Tạo phiếu" : "Create case"}</Button> : undefined}
      />

      {toast && <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs font-medium text-indigo-800">{toast}</div>}
      {customerIdParam && <div className="flex items-center justify-between rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs font-medium text-sky-800"><span>{vi ? "Đang lọc theo khách hàng được liên kết." : "Filtered by linked customer."}</span><button type="button" onClick={clearCustomerFilter} className="font-medium underline">{vi ? "Bỏ lọc" : "Clear"}</button></div>}

      <OperationSavedViews items={savedViews} activeKey={view} onChange={(key) => setView(key as CareView)} title={vi ? "Hàng đợi chăm sóc" : "Care queues"} />

      <ListToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={vi ? "Tìm theo mã phiếu, chủ đề, khách hàng, người liên hệ..." : "Search by case, subject, customer, contact..."}
        viewMode={displayMode === "cards" ? "card" : "table"}
        onViewModeChange={(mode) => setDisplayMode(mode === "card" ? "cards" : "table")}
        viewOptions={[
          { value: "table", label: vi ? "Dạng bảng" : "Table view" },
          { value: "card", label: vi ? "Dạng thẻ" : "Card view" },
        ]}
        showFilters
        onOpenFilters={() => setFilterOpen((open) => !open)}
        onCloseFilters={() => setFilterOpen(false)}
        filtersOpen={filterOpen}
        activeFilterCount={(priority !== "all" ? 1 : 0) + (category !== "all" ? 1 : 0) + (owner !== "all" ? 1 : 0)}
        hasActiveFilters={priority !== "all" || category !== "all" || owner !== "all"}
        filtersLabel={vi ? "Bộ lọc" : "Filters"}
        filtersPanel={(
          <OperationFilterPopover
            isOpen={filterOpen}
            onClose={() => setFilterOpen(false)}
            onReset={() => { setPriority("all"); setCategory("all"); setOwner("all"); }}
            title={vi ? "Bộ lọc Phiếu hỗ trợ" : "Support ticket filters"}
            resetLabel={vi ? "Đặt lại" : "Reset"}
            doneLabel={vi ? "Hoàn tất" : "Done"}
          >
            <label className="block">
              <span className="text-[10px] font-medium uppercase text-slate-400">{vi ? "Ưu tiên" : "Priority"}</span>
              <select value={priority} onChange={(event) => setPriority(event.target.value as SupportCasePriority | "all")} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="all">{vi ? "Tất cả" : "All"}</option>
                {Object.keys(SUPPORT_CASE_PRIORITY_CONFIG).map((key) => <option key={key} value={key}>{priorityLabel(key as SupportCasePriority, vi)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-medium uppercase text-slate-400">{vi ? "Loại chăm sóc" : "Care type"}</span>
              <select value={category} onChange={(event) => setCategory(event.target.value as SupportCaseCategory | "all")} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="all">{vi ? "Tất cả" : "All"}</option>
                {currentCategories.map((key) => <option key={key} value={key}>{categoryLabel(key, vi)}</option>)}
              </select>
            </label>
            <SearchableSelect label={vi ? "Người phụ trách" : "Owner"} value={owner} onChange={setOwner} clearable={false} placeholder={vi ? "Tất cả" : "All"} searchPlaceholder={vi ? "Tìm nhân viên..." : "Search members..."} options={[{ value: "all", label: vi ? "Tất cả" : "All" }, { value: "unassigned", label: vi ? "Chưa giao" : "Unassigned" }, ...owners.map((ownerId) => ({ value: ownerId, label: resolveWorkspaceMemberName(ownerId) || ownerId }))]} />
          </OperationFilterPopover>
        )}
      />

      {filteredCases.length === 0 ? <ListStatePanel kind="empty" title={vi ? "Không có phiếu phù hợp" : "No support tickets match"} /> : displayMode === "cards" ? (
        <div className="grid gap-4 xl:grid-cols-2"><AnimatePresence>{pagination.pageItems.map(renderCard)}</AnimatePresence></div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">{vi ? "Phiếu" : "Case"}</th><th className="px-4 py-3">{vi ? "Khách hàng" : "Customer"}</th><th className="px-4 py-3">{vi ? "Loại" : "Type"}</th><th className="px-4 py-3">{vi ? "Phụ trách" : "Owner"}</th><th className="px-4 py-3">{vi ? "Trạng thái" : "Status"}</th><th className="px-4 py-3">{vi ? "Hẹn tiếp" : "Follow-up"}</th></tr></thead><tbody className="divide-y divide-slate-100">{pagination.pageItems.map((item) => <tr key={item.id} className="hover:bg-slate-50/70"><td className="px-4 py-3"><button type="button" onClick={() => navigate(item.id)} className="font-medium text-slate-900 hover:text-indigo-700">{item.caseNumber}</button><div className="mt-1 max-w-xs crm-text-wrap text-[11px] text-slate-500">{item.title}</div></td><td className="px-4 py-3 text-slate-600">{resolveSupportCustomerName(item)}</td><td className="px-4 py-3 text-slate-600">{categoryLabelFor(item.category)}</td><td className="px-4 py-3 text-slate-600">{resolveWorkspaceMemberName(item.ownerId)}</td><td className="px-4 py-3"><span className={`rounded-full border px-2 py-1 font-medium ${statusTone(item.status)}`}>{statusLabel(item.status, vi)}</span></td><td className={`px-4 py-3 font-medium ${followUpDue(item) ? "text-rose-600" : "text-slate-600"}`}>{item.nextFollowUpAt ? new Date(item.nextFollowUpAt).toLocaleString(vi ? "vi-VN" : "en-US") : "—"}</td></tr>)}</tbody></table></div></div>
      )}
      {filteredCases.length > 0 ? <ListPaginationBar {...pagination} itemLabelVi="phiếu hỗ trợ" itemLabelEn="support tickets" /> : null}

    </ListPageFrame>
  </>);
};

const Field: React.FC<{ label: string; value: string; alert?: boolean }> = ({ label, value, alert }) => <div className={`rounded-xl px-3 py-2 ${alert ? "bg-rose-50" : "bg-slate-50"}`}><div className="text-[9px] font-medium uppercase text-slate-400">{label}</div><div className={`mt-1 crm-text-wrap text-[11px] font-medium ${alert ? "text-rose-700" : "text-slate-700"}`}>{value}</div></div>;
