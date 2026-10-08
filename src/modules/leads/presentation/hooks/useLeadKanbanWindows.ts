import React from "react";
import { useI18n } from "@/i18n";
import { ApplicationError } from "@/shared/domain";
import { subscribeModuleQueryInvalidation } from "@/shared/application";
import type { LeadListQuery } from "../../application/ports/LeadApiRuntime";
import { LeadKanbanWindows, leadKanbanColumns } from "../../application/queries/leadKanbanWindows";
import { getLeadApiRuntime, isLeadConnectedApiRuntime } from "../../application/composition/leadApplicationServices";

export function useLeadKanbanWindows(options: { scopeKey: string; enabled: boolean; activeView: string; query: LeadListQuery; unavailable?: boolean }) {
  const { locale } = useI18n();
  const localeRef = React.useRef(locale);
  localeRef.current = locale;
  const connected = isLeadConnectedApiRuntime();
  const key = JSON.stringify([options.scopeKey, options.activeView, options.query, options.unavailable]);
  const store = React.useMemo(() => new LeadKanbanWindows(leadKanbanColumns(options.activeView), options.query,
    (column, query, signal) => {
      const locale = localeRef.current;
      if (options.unavailable) throw new ApplicationError({ code: "LEAD_KANBAN_FILTER_UNAVAILABLE", category: "VALIDATION",
        retryable: false, message: locale === "vi" ? "Chế độ xem đã lưu chứa bộ lọc hoặc cách sắp xếp không được hỗ trợ trên Kanban." : "The saved view contains unsupported Kanban filters or ordering." });
      const port = getLeadApiRuntime().queries;
      if (!port.kanbanColumn) throw new ApplicationError({ code: "LEAD_KANBAN_UNAVAILABLE", category: "INFRASTRUCTURE", retryable: false, message: locale === "vi" ? "Không thể tải bảng Kanban Lead." : "Lead Kanban query is unavailable." });
      return port.kanbanColumn(column, query, signal);
    }), [key]);
  const windows = React.useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  React.useEffect(() => {
    if (!connected || !options.enabled) return;
    void store.refresh();
    const unsubscribe = subscribeModuleQueryInvalidation("leads", store.refresh);
    return () => { unsubscribe(); store.cancel(); };
  }, [store, connected, options.enabled]);
  const items = Object.values(windows).flatMap(window => window.items);
  return { connected, windows, items, loadMore: store.loadMore, retry: store.retry, refresh: store.refresh,
    cancel: store.cancel, loading: false, refreshing: false, stale: false };
}
