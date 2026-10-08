import { ApplicationError, normalizeApplicationError } from "@/shared/domain";
import type { AuthoritativePage } from "@/shared/application";
import type { LeadKanbanColumn, LeadListQuery } from "../ports/LeadApiRuntime";
import type { Lead } from "../../domain/model/lead.types";

export interface LeadKanbanWindow {
  items: Lead[];
  loadedCount: number;
  totalCount?: number;
  nextCursor?: string;
  hasNextPage: boolean;
  loading: boolean;
  error?: ApplicationError;
}

export function leadKanbanColumns(activeView: string): LeadKanbanColumn[] {
  if (activeView === "nurture") return ["NURTURE"];
  if (activeView === "disqualified") return ["DISQUALIFIED"];
  return ["NEW", "CONTACTING", "VERIFYING", "POSITIVE_OUTCOME"];
}

const emptyWindow = (): LeadKanbanWindow => ({ items: [], loadedCount: 0, hasNextPage: false, loading: false });

// A column snapshot belongs to one workspace/query lifetime; it never publishes a collection projection.
export class LeadKanbanWindows {
  private windows: Partial<Record<LeadKanbanColumn, LeadKanbanWindow>> = {};
  private requests = new Map<LeadKanbanColumn, AbortController>();
  private listeners = new Set<() => void>();
  constructor(readonly columns: readonly LeadKanbanColumn[], private readonly query: LeadListQuery,
    private readonly load: (column: LeadKanbanColumn, query: LeadListQuery, signal: AbortSignal) => Promise<AuthoritativePage<Lead>>) {
    for (const column of columns) this.windows[column] = emptyWindow();
  }
  snapshot = () => this.windows;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(column: LeadKanbanColumn, columnState: LeadKanbanWindow) {
    this.windows = { ...this.windows, [column]: columnState };
    for (const listener of this.listeners) listener();
  }
  cancel = () => {
    for (const [column, request] of this.requests) {
      request.abort();
      const current = this.windows[column];
      if (current) this.publish(column, { ...current, loading: false });
    }
    this.requests.clear();
  };
  refresh = async () => { await Promise.all(this.columns.map(column => this.loadWindow(column, false))); };
  retry = async (column: LeadKanbanColumn) => { await this.loadWindow(column, Boolean(this.windows[column]?.nextCursor)); };
  loadMore = async (column: LeadKanbanColumn) => {
    const current = this.windows[column];
    if (current?.hasNextPage && current.nextCursor && !current.loading) await this.loadWindow(column, true);
  };
  private async loadWindow(column: LeadKanbanColumn, append: boolean) {
    const current = this.windows[column];
    if (!current) return;
    this.requests.get(column)?.abort();
    const controller = new AbortController();
    this.requests.set(column, controller);
    const { error: _error, ...retained } = current;
    this.publish(column, { ...retained, loading: true });
    try {
      const page = await this.load(column, { ...this.query, limit: 50,
        ...(append && current.nextCursor ? { cursor: current.nextCursor } : {}) }, controller.signal);
      if (controller.signal.aborted || this.requests.get(column) !== controller) return;
      if (page.pageInfo.hasNextPage && (!page.pageInfo.nextCursor || append && page.pageInfo.nextCursor === current.nextCursor)) {
        throw new ApplicationError({ code: "LEAD_KANBAN_CURSOR_REQUIRED", category: "INFRASTRUCTURE", retryable: false, message: "Kanban cursor did not advance." });
      }
      const records = new Map((append ? current.items : []).map(item => [item.id, item]));
      for (const item of page.items) records.set(item.id, item);
      const items = [...records.values()];
      this.publish(column, { items, loadedCount: items.length, hasNextPage: page.pageInfo.hasNextPage, loading: false,
        ...(page.pageInfo.totalCount === undefined ? {} : { totalCount: page.pageInfo.totalCount }),
        ...(page.pageInfo.nextCursor === undefined ? {} : { nextCursor: page.pageInfo.nextCursor }) });
    } catch (cause) {
      if (controller.signal.aborted || this.requests.get(column) !== controller) return;
      const error = normalizeApplicationError(cause);
      const evict = error.status === 403 || error.status === 404 || error.category === "AUTHORIZATION" || error.category === "NOT_FOUND";
      // Failed refreshes must restart from the first page; failed Load More keeps its cursor.
      const retained = append ? current : { ...current, hasNextPage: false, nextCursor: undefined };
      const { nextCursor, ...rest } = retained;
      this.publish(column, { ...(evict ? emptyWindow() : rest), loading: false, error,
        ...(!evict && nextCursor !== undefined ? { nextCursor } : {}) });
    } finally {
      if (this.requests.get(column) === controller) this.requests.delete(column);
    }
  }
}
