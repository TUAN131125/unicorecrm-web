import React from "react";
import { GripVertical, Mail, MoreHorizontal, Phone } from "lucide-react";
import type { Lead } from "../../domain/model/lead.types";
import { LeadWorkState, QualificationOutcome } from "../../domain/model/leadLifecycle.canonical";

import { isPositiveQualificationOutcome } from "../../domain/model/leadLifecycle.canonical";
import { useI18n } from "@/i18n";
import { localizeBusinessDescriptor } from "@/shared/lib/i18n/businessDescriptorLabels";
import { Avatar, Badge, IconButton, RowActionPortal } from "@/shared/components/ui";
import { formatPhone } from "@/shared/lib/format/phone";
import { LeadActionMenu } from "./LeadActionMenu";
import type { WorkspaceMemberDirectoryEntry } from "@/platform/member-directory";
import { getLeadMemberDisplay } from "../hooks/useLeadReferenceData";

export type LeadKanbanDropTarget =
  | typeof LeadWorkState.NEW
  | typeof LeadWorkState.CONTACTING
  | typeof LeadWorkState.VERIFYING
  | "POSITIVE_OUTCOME";

type LeadKanbanColumnStatus = LeadKanbanDropTarget | QualificationOutcome;

interface LeadKanbanBoardProps {
  filteredLeads: Lead[];
  activeView: string;
  openRowActionId: string | null;
  setOpenRowActionId: (id: string | null) => void;
  getReturnToUrl: (mode: "table" | "kanban") => string;
  memberById: ReadonlyMap<string, WorkspaceMemberDirectoryEntry>;
  onMoveLead?: (leadId: string, target: LeadKanbanDropTarget) => void;
  onCall?: (lead: Lead) => void;
  onMarkContacted?: (leadId: string) => void;
  onQualify?: (leadId: string) => void;
  onDisqualify?: (leadId: string) => void;
  onReopen?: (leadId: string) => void;
  onFollowUp?: (leadId: string) => void;
  onConvert?: (leadId: string) => void;
  onDelete?: (leadId: string) => void;
  onViewDetails?: (leadId: string) => void;
}

const isDropTarget = (status: LeadKanbanColumnStatus): status is LeadKanbanDropTarget =>
  status === LeadWorkState.NEW
  || status === LeadWorkState.CONTACTING
  || status === LeadWorkState.VERIFYING
  || status === "POSITIVE_OUTCOME";

const nextTargetFor = (lead: Lead): LeadKanbanDropTarget | null => {
  if (lead.leadWorkState === LeadWorkState.NEW) return LeadWorkState.CONTACTING;
  if (lead.leadWorkState === LeadWorkState.CONTACTING) return LeadWorkState.VERIFYING;
  if (lead.leadWorkState === LeadWorkState.VERIFYING) return "POSITIVE_OUTCOME";
  return null;
};

export const LeadKanbanBoard: React.FC<LeadKanbanBoardProps> = ({
  filteredLeads,
  activeView,
  openRowActionId,
  setOpenRowActionId,
  memberById,
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
}) => {
  const { t, locale } = useI18n();
  const [draggedLeadId, setDraggedLeadId] = React.useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = React.useState<LeadKanbanDropTarget | null>(null);
  const [rowActionAnchorEl, setRowActionAnchorEl] = React.useState<HTMLElement | null>(null);
  const didDragRef = React.useRef(false);
  const activeMenuLead = React.useMemo(
    () => filteredLeads.find((lead) => lead.id === openRowActionId) ?? null,
    [filteredLeads, openRowActionId],
  );

  const columns = React.useMemo<Array<{ status: LeadKanbanColumnStatus; title: string }>>(() => {
    if (activeView === "nurture") {
      return [{ status: QualificationOutcome.NURTURE, title: locale === "vi" ? "Chăm sóc" : "Nurture" }];
    }
    if (activeView === "disqualified") {
      return [{ status: QualificationOutcome.DISQUALIFIED, title: locale === "vi" ? "Không phù hợp" : "Disqualified" }];
    }
    return [
      { status: LeadWorkState.NEW, title: locale === "vi" ? "Mới" : "New" },
      { status: LeadWorkState.CONTACTING, title: locale === "vi" ? "Đang liên hệ" : "Contacting" },
      { status: LeadWorkState.VERIFYING, title: locale === "vi" ? "Đang xác minh" : "Verifying" },
      { status: "POSITIVE_OUTCOME", title: locale === "vi" ? "Đã chốt hướng đi" : "Positive outcome" },
    ];
  }, [activeView, locale]);

  const lifecycleBoard = columns.every(({ status }) => isDropTarget(status));
  const dragInstructions = locale === "vi"
    ? "Kéo Lead sang cột kế tiếp. Có thể dùng Alt và phím mũi tên phải để chuyển bằng bàn phím."
    : "Drag the Lead to its next column. You can also press Alt and Arrow Right to move it with the keyboard.";

  const moveLead = React.useCallback((leadId: string, target: LeadKanbanDropTarget) => {
    onMoveLead?.(leadId, target);
  }, [onMoveLead]);

  return (
    <>
    <div
      id="kanban-scroll-viewport"
      data-data-surface="list"
      className="overflow-x-auto p-4 font-sans crm-scroll-x"
    >
      <p id="lead-kanban-drag-instructions" className="sr-only">{dragInstructions}</p>
      <div
        className={`grid w-full gap-4 pb-2.5 ${columns.length > 1 ? "min-w-[1040px]" : "min-w-0"}`}
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(250px, 1fr))` }}
        data-kanban-responsive-columns="true"
      >
        {columns.map(({ status, title }) => {
          const isOutcomeColumn = Object.values(QualificationOutcome).includes(status as QualificationOutcome);
          const columnLeads = filteredLeads.filter((lead) => isOutcomeColumn
            ? lead.qualificationOutcome === status
            : status === "POSITIVE_OUTCOME"
              ? isPositiveQualificationOutcome(lead.qualificationOutcome)
              : lead.leadWorkState === status);
          const acceptsDrop = lifecycleBoard && isDropTarget(status);
          const isDragOver = acceptsDrop && dragOverStatus === status;

          return (
            <section
              key={status}
              data-kanban-column={status}
              aria-label={title}
              onDragEnter={(event) => {
                if (!acceptsDrop || !draggedLeadId) return;
                event.preventDefault();
                setDragOverStatus(status);
              }}
              onDragOver={(event) => {
                if (!acceptsDrop || !draggedLeadId) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDragOverStatus(status);
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                if (dragOverStatus === status) setDragOverStatus(null);
              }}
              onDrop={(event) => {
                if (!acceptsDrop) return;
                event.preventDefault();
                const leadId = event.dataTransfer.getData("text/plain") || draggedLeadId;
                setDragOverStatus(null);
                setDraggedLeadId(null);
                if (leadId) moveLead(leadId, status);
              }}
              className={`relative flex w-full min-w-0 flex-col overflow-visible rounded-2xl border p-3.5 shadow-sm transition-[background-color,border-color,box-shadow,transform] duration-150 ${
                isDragOver
                  ? "border-violet-400 bg-violet-50/80 shadow-md ring-2 ring-violet-200"
                  : "border-slate-200/70 bg-slate-50/70"
              }`}
              style={{ minHeight: "500px", maxHeight: "720px" }}
            >
              <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-1.5">
                  {status === LeadWorkState.NEW && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                  {status === LeadWorkState.CONTACTING && <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />}
                  {status === LeadWorkState.VERIFYING && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />}
                  {status === "POSITIVE_OUTCOME" && <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
                  {status === QualificationOutcome.NURTURE && <span className="h-2 w-2 shrink-0 rounded-full bg-teal-500" />}
                  {status === QualificationOutcome.DISQUALIFIED && <span className="h-2 w-2 shrink-0 rounded-full bg-red-400" />}
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-800">{title}</span>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-800">
                  {columnLeads.length}
                </span>
              </div>

              <div className="flex-1 space-y-2.5 overflow-y-auto pr-1 crm-scroll-y">
                {columnLeads.map((lead) => {
                  const ownerName = getLeadMemberDisplay(memberById, lead.ownerId, locale);
                  const canDrag = lifecycleBoard && lead.leadWorkState !== LeadWorkState.CLOSED && Boolean(onMoveLead);
                  const nextTarget = nextTargetFor(lead);
                  const dragging = draggedLeadId === lead.id;

                  return (
                    <article
                      key={lead.id}
                      data-kanban-card="lead"
                      draggable={canDrag}
                      aria-describedby={canDrag ? "lead-kanban-drag-instructions" : undefined}
                      aria-roledescription={canDrag ? (locale === "vi" ? "Thẻ Lead có thể kéo" : "Draggable Lead card") : undefined}
                      tabIndex={0}
                      style={{ contentVisibility: "auto", containIntrinsicSize: "210px" }}
                      className={`group relative space-y-2.5 overflow-visible rounded-xl border bg-white p-3.5 text-left shadow-sm transition-[border-color,box-shadow,opacity,transform] ${
                        canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                      } ${dragging ? "scale-[0.98] border-violet-300 opacity-45" : "border-slate-200 hover:border-slate-300 hover:shadow-md"}`}
                      onDragStart={(event) => {
                        if (!canDrag) {
                          event.preventDefault();
                          return;
                        }
                        setOpenRowActionId(null);
                        setRowActionAnchorEl(null);
                        didDragRef.current = true;
                        setDraggedLeadId(lead.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", lead.id);
                      }}
                      onDragEnd={() => {
                        setDraggedLeadId(null);
                        setDragOverStatus(null);
                        window.setTimeout(() => { didDragRef.current = false; }, 0);
                      }}
                      onClick={() => {
                        if (didDragRef.current) return;
                        onViewDetails?.(lead.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.altKey && event.key === "ArrowRight" && nextTarget && canDrag) {
                          event.preventDefault();
                          moveLead(lead.id, nextTarget);
                          return;
                        }
                        if ((event.key === "Enter" || event.key === " ") && !event.altKey) {
                          event.preventDefault();
                          onViewDetails?.(lead.id);
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          {canDrag && <GripVertical size={13} className="shrink-0 text-slate-400" aria-hidden="true" />}
                          <h5 className="crm-text-wrap text-xs font-medium text-slate-950">{lead.name}</h5>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
                          <Badge variant="neutral" className="border-slate-200 bg-slate-50 text-[9px] font-medium normal-case">
                            {lead.source}
                          </Badge>
                          <div className="relative">
                            <IconButton
                              onClick={(event) => {
                                event.stopPropagation();
                                if (openRowActionId === lead.id) {
                                  setOpenRowActionId(null);
                                  setRowActionAnchorEl(null);
                                } else {
                                  setOpenRowActionId(lead.id);
                                  setRowActionAnchorEl(event.currentTarget);
                                }
                              }}
                              variant="ghost"
                              size="sm"
                              title={t("common.moreActions", "Thêm thao tác")}
                              className="row-more-btn p-1 text-slate-500 hover:text-slate-900"
                            >
                              <MoreHorizontal size={12} />
                            </IconButton>
                          </div>
                        </div>
                      </div>

                      {lead.companyName && <p className="-mt-1 block text-[10px] font-medium text-slate-950">{lead.companyName}</p>}
                      {lead.title && <p className="-mt-2 block text-[10px] text-slate-950">{localizeBusinessDescriptor(lead.title, locale)}</p>}

                      {(lead.phone || lead.email) && (
                        <div className="space-y-0.5 pt-1 text-[9px] text-slate-950">
                          {lead.phone && (
                            <p className="flex items-center gap-1 font-mono font-normal text-slate-950">
                              <Phone size={9} className="text-slate-500" />
                              {formatPhone(lead.phone)}
                            </p>
                          )}
                          {lead.email && <p className="flex items-center gap-1 crm-text-wrap"><Mail size={9} className="text-slate-500" />{lead.email}</p>}
                        </div>
                      )}

                      <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-[9px] text-slate-950">
                        <div className="flex min-w-0 items-center gap-1.5" title={`${locale === "vi" ? "Chủ sở hữu" : "Owner"}: ${ownerName}`}>
                          <Avatar name={ownerName} className="h-[18px] w-[18px]" />
                          <span className="crm-text-wrap text-[10px] font-medium text-slate-950">{ownerName}</span>
                        </div>
                        <span className="font-mono text-slate-950">{new Date(lead.createdAt).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US")}</span>
                      </div>
                    </article>
                  );
                })}
                {columnLeads.length === 0 && (
                  <div className={`rounded-xl border border-dashed py-10 text-center text-[10px] font-normal ${isDragOver ? "border-violet-300 bg-violet-50 text-slate-950" : "border-slate-200 bg-white/70 text-slate-950"}`}>
                    {isDragOver
                      ? (locale === "vi" ? "Thả Lead vào đây" : "Drop Lead here")
                      : t("leads.queueEmpty", "Cột này trống")}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
    <RowActionPortal
      open={Boolean(activeMenuLead && rowActionAnchorEl)}
      anchorEl={rowActionAnchorEl}
      onClose={() => {
        setOpenRowActionId(null);
        setRowActionAnchorEl(null);
      }}
      width={220}
    >
      {activeMenuLead && (
        <LeadActionMenu
          lead={activeMenuLead}
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
          onDelete={onDelete}
          onViewDetails={onViewDetails}
        />
      )}
    </RowActionPortal>
    </>
  );
};
