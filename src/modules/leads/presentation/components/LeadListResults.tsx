import type { MouseEvent } from "react";
import type { Lead, LeadCampaign } from "../../domain/model/lead.types";
import type { ColumnKeyType } from "../model/leadTable.types";

import type { WorkspaceMemberDirectoryEntry } from "@/platform/member-directory";
import type { Product } from "@/modules/products";
import { ListStatePanel } from "@/components/crm/list-archetype";
import { useI18n } from "@/i18n";
import { LeadTable } from "./LeadTable";
import { LeadMobileCardList } from "./LeadMobileCardList";
import { LeadKanbanBoard, type LeadKanbanDropTarget } from "./LeadKanbanBoard";
import { LeadPaginationBar } from "./LeadPaginationBar";

interface LeadListResultsProps {
  leads: Lead[];
  viewMode: "table" | "kanban";
  activeView: string;
  selectedLeadIds: string[];
  visibleColumns: ColumnKeyType[];
  columnWidths: Record<string, number>;
  openRowActionId: string | null;
  campaigns: LeadCampaign[];
  memberById: ReadonlyMap<string, WorkspaceMemberDirectoryEntry>;
  productById: ReadonlyMap<string, Product>;
  canDelete: boolean;
  page: number;
  pageCount: number;
  pageSize: number;
  totalItems: number;
  rangeStart: number;
  rangeEnd: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpenCreate: () => void;
  onSelectAll: (leadIds: string[], checked: boolean) => void;
  onSelectRow: (leadId: string, checked: boolean) => void;
  onColumnResize: (event: MouseEvent, columnKey: string) => void;
  onColumnReset: (columnKey: string) => void;
  setOpenRowActionId: (leadId: string | null) => void;
  getReturnToUrl: (mode: "table" | "kanban") => string;
  onMoveLead: (leadId: string, target: LeadKanbanDropTarget) => void;
  onCall: (lead: Lead) => void;
  onMarkContacted: (leadId: string) => void;
  onQualify: (leadId: string) => void;
  onDisqualify: (leadId: string) => void;
  onReopen: (leadId: string) => void;
  onFollowUp: (leadId: string) => void;
  onConvert: (leadId: string) => void;
  onDelete: (leadId: string) => void;
  onViewDetails: (leadId: string) => void;
}

export function LeadListResults({
  leads,
  viewMode,
  activeView,
  selectedLeadIds,
  visibleColumns,
  columnWidths,
  openRowActionId,
  campaigns,
  memberById,
  productById,
  canDelete,
  page,
  pageCount,
  pageSize,
  totalItems,
  rangeStart,
  rangeEnd,
  onPageChange,
  onPageSizeChange,
  onOpenCreate,
  onSelectAll,
  onSelectRow,
  onColumnResize,
  onColumnReset,
  setOpenRowActionId,
  getReturnToUrl,
  onMoveLead,
  onCall,
  onMarkContacted,
  onQualify,
  onDisqualify,
  onReopen,
  onFollowUp,
  onConvert,
  onDelete,
  onViewDetails,
}: LeadListResultsProps) {
  const { t, locale } = useI18n();

  if (totalItems === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <ListStatePanel
          kind="empty"
          title={locale === "vi" ? "Không có Lead phù hợp" : "No matching Leads"}
          action={(
            <button type="button" onClick={onOpenCreate} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700">
              {t("leads.addLead")}
            </button>
          )}
        />
      </div>
    );
  }

  const sharedActions = {
    onCall,
    onMarkContacted,
    onQualify,
    onDisqualify,
    onReopen,
    onFollowUp,
    onConvert,
    onDelete: canDelete ? onDelete : undefined,
    onViewDetails,
  };

  return (
    <div data-data-surface="list" className="overflow-hidden rounded-xl border border-slate-200 bg-white font-sans shadow-sm">
      {viewMode === "table" ? (
        <>
          <div className="hidden md:block">
            <LeadTable
              filteredLeads={leads}
              selectedLeadIds={selectedLeadIds}
              onSelectAll={(checked) => onSelectAll(leads.map((lead) => lead.id), checked)}
              visibleColumns={visibleColumns}
              columnWidths={columnWidths}
              onColumnResize={onColumnResize}
              onColumnReset={onColumnReset}
              openRowActionId={openRowActionId}
              setOpenRowActionId={setOpenRowActionId}
              campaigns={campaigns}
              memberById={memberById}
              productById={productById}
              getReturnToUrl={getReturnToUrl}
              onSelectRow={onSelectRow}
              {...sharedActions}
            />
          </div>
          <div className="block md:hidden">
            <LeadMobileCardList
              filteredLeads={leads}
              selectedLeadIds={selectedLeadIds}
              onSelectRow={onSelectRow}
              openRowActionId={openRowActionId}
              setOpenRowActionId={setOpenRowActionId}
              campaigns={campaigns}
              memberById={memberById}
              productById={productById}
              {...sharedActions}
            />
          </div>
        </>
      ) : (
        <LeadKanbanBoard
          filteredLeads={leads}
          activeView={activeView}
          openRowActionId={openRowActionId}
          setOpenRowActionId={setOpenRowActionId}
          getReturnToUrl={getReturnToUrl}
          memberById={memberById}
          onMoveLead={onMoveLead}
          {...sharedActions}
        />
      )}
      <LeadPaginationBar
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        totalItems={totalItems}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
