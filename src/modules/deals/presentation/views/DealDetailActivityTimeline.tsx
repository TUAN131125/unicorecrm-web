import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShoppingBag, Plus, Trash2, FileText, ChevronRight, AlertCircle, Phone, Mail, User, Check, X, MessageCircle, MessageSquare, Calendar, Trophy, TrendingUp, Users, Activity, Sparkles, RefreshCw, CheckCircle, XCircle, Settings, Download, ShieldCheck } from "lucide-react";
import { Badge, Button, Input, Modal, SectionHeader, Select, Textarea, Table, TableHeader, TableBody, TableRow, TableCell, getQuoteStatusBadgeVariant } from "@/shared/components/ui";
import { formatVnd } from "@/shared/lib/format/currency";
import type { DealLineItem } from "../../domain/model/deal.types";
import { DealStage } from "../../domain/model/deal.types";
import { isWonStage } from "../../domain/rules/dealStages";
import { QuoteApprovalStatus, QuoteStatus } from "@/modules/quotes";
import { getPaymentSummaryForOrder } from "@/modules/payments";
import { ProductPickerModal, type Product } from "@/modules/products";
import { resolveWorkspaceMemberLabel } from "@/platform/member-directory";
import { NoteActivityCreateModal } from "@/modules/tasks";
import { XCircleSelector } from "../components/XCircleSelector";
import { DealForecastHistoryPanel, DealPipelineHealthBadges } from "../components/DealPipelineHealth";
import {
  RecordDetailHeader,
  recordDetailHeaderActionButtonClassName,
} from "@/components/crm/detail-archetype";
import { formatDateTime } from "@/shared/lib/format/date";
import type { DealDetailController, DealDetailProductCatalog } from "./dealDetailView.types";

export function DealDetailActivityTimeline({ controller }: { controller: DealDetailController }) {
  const {
    customers,
    setCustomers,
    contacts,
    setContacts,
    quotes,
    setQuotes,
    crmConfig,
    orders,
    deals,
    setDeals,
    stageConfigs,
    dealId,
    navigate,
    location,
    t,
    locale,
    deal,
    isWonModalOpen,
    setIsWonModalOpen,
    isProductPickerOpen,
    setIsProductPickerOpen,
    isLostModalOpen,
    setIsLostModalOpen,
    lostReason,
    setLostReason,
    lostNotes,
    setLostNotes,
    lostRecycleDecision,
    setLostRecycleDecision,
    lostRevisitAt,
    setLostRevisitAt,
    lostError,
    setLostError,
    toast,
    setToast,
    triggerToast,
    newNoteText,
    setNewNoteText,
    noteError,
    setNoteError,
    isDirectNoteModalOpen,
    setIsDirectNoteModalOpen,
    activeFilter,
    setActiveFilter,
    activeTab,
    setActiveTab,
    relatedQuotes,
    hasAcceptedQuote,
    acceptedQuote,
    linkedOrders,
    hasLinkedOrder,
    latestLinkedOrder,
    getOpportunityQuoteState,
    quoteState,
    handleUpdateQuoteStatus,
    getDealStageLabel,
    customer,
    contact,
    isQuoteEnabled,
    quoteDocumentLabel,
    customerDisplayName,
    customerSecondaryInfo,
    customerTypeLabel,
    getNextDealStage,
    isTerminal,
    handleNextStage,
    handleUpdateLineItem,
    handleAddSampleItem,
    handleDeleteLineItem,
    getLostReasonLabel,
    getLostReasonNoteHelper,
    handleConfirmWon,
    handleConfirmLost,
    handleAddDirectNote,
    state,
    returnTo,
    rawActivities,
    filteredActivities,
    activitiesList,
  } = controller;


  return (
    <>
          {/* Activities Workspace & Timeline */}
          <div data-deal-detail-activity="balanced" className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <MessageSquare size={13} className="text-indigo-600" />
              <span>{t("deals.detail.activitiesTitle")}</span>
            </h3>

            {/* Canonical note form shared with relationship modules. */}
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => setIsDirectNoteModalOpen(true)}>
                <Plus size={13} />
                {t("deals.detail.saveNote")}
              </Button>
            </div>
            <NoteActivityCreateModal
              isOpen={isDirectNoteModalOpen}
              onClose={() => setIsDirectNoteModalOpen(false)}
              formId="deal-timeline-note-form"
              defaults={{ title: locale === "vi" ? `Ghi chú ${deal.name}` : `Deal note: ${deal.name}` }}
              onSubmit={handleAddDirectNote}
            />

            {/* Filter chips */}
            <div id="timeline-filters" className="flex flex-wrap gap-1.5 py-1 border-b pb-3 border-dashed border-slate-200">
              {(["all", "note", "stage", "quote", "outcome"] as const).map((filter) => {
                const isActive = activeFilter === filter;
                let labelKey = "";
                if (filter === "all") labelKey = "all";
                else if (filter === "note") labelKey = "notes";
                else if (filter === "stage") labelKey = "stage";
                else if (filter === "quote") labelKey = "quotes";
                else labelKey = "outcomes";

                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setActiveFilter(filter)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wide transition-all border cursor-pointer ${
                      isActive
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {t(`deals.activities.filters.${labelKey}`)}
                  </button>
                );
              })}
            </div>

            {/* Timeline scroll */}
            <div className="space-y-3 pt-2">
              {activitiesList.length === 0 ? (
                <p className="text-slate-500 italic py-3 text-center">
                  {t("deals.detail.emptyActivities")}
                </p>
              ) : (
                <div className="relative border-l border-slate-200 pl-6 ml-2.5 space-y-4 pt-1.5 pb-2">
                  {activitiesList.map((act) => {
                    const getStyleAndIcon = () => {
                      switch (act.type) {
                        case "note":
                          return {
                            container: "border-amber-200 text-amber-600 bg-amber-50",
                            icon: <MessageSquare size={10} />
                          };
                        case "stage":
                          return {
                            container: "border-purple-200 text-purple-600 bg-purple-50",
                            icon: <RefreshCw size={10} />
                          };
                        case "quote":
                          return {
                            container: "border-blue-200 text-blue-600 bg-blue-50",
                            icon: <FileText size={10} />
                          };
                        case "won":
                          return {
                            container: "border-emerald-200 text-emerald-600 bg-emerald-50",
                            icon: <CheckCircle size={10} />
                          };
                        case "lost":
                          return {
                            container: "border-red-200 text-red-600 bg-red-50",
                            icon: <XCircle size={10} />
                          };
                        default:
                          return {
                            container: "border-slate-200 text-slate-500 bg-slate-50",
                            icon: <Settings size={10} />
                          };
                      }
                    };

                    const badge = getStyleAndIcon();

                    return (
                      <div key={act.id} className="relative space-y-1 pl-1">
                        {/* Expressive Badge Icon */}
                        <div className={`absolute -left-[35px] top-[1px] w-5 h-5 rounded-full border bg-white flex items-center justify-center shadow-sm ${badge.container}`}>
                          {badge.icon}
                        </div>
                        
                        <div className="flex items-center justify-between gap-2 leading-none">
                          <p className="font-semibold text-slate-900 text-[11px]">{act.title}</p>
                          <span className="text-[9px] text-slate-500 font-semibold">
                            {act.createdAt.includes("T") 
                              ? new Date(act.createdAt).toLocaleString(locale === "vi" ? "vi-VN" : "en-US") 
                              : act.createdAt}
                          </span>
                        </div>
                        
                        <p className="text-slate-600 leading-relaxed font-medium">{act.description}</p>

                        {/* Metadata stage changed details */}
                        {act.type === "stage" && act.metadata?.fromStage && act.metadata?.toStage && (
                          <div className="mt-1 text-[10px] bg-slate-50 border border-slate-200 rounded-md px-2 py-1 inline-flex items-center gap-1.5 font-semibold text-slate-600">
                            <span>{getDealStageLabel(act.metadata.fromStage)}</span>
                            <ChevronRight size={10} className="text-slate-500" />
                            <span>{getDealStageLabel(act.metadata.toStage)}</span>
                          </div>
                        )}

                        {/* Metadata key connected quote */}
                        {act.metadata?.quoteNumber && (
                          <div className="mt-1 text-[10px] bg-blue-50/50 border border-blue-100 rounded-md px-2 py-1 inline-flex items-center gap-1 font-semibold text-blue-700">
                            <FileText size={10} />
                            <span>#{act.metadata.quoteNumber}</span>
                          </div>
                        )}

                        {/* Metadata lost details rendering */}
                        {act.type === "lost" && act.metadata?.lostReason && (
                          <div className="mt-1 space-y-1 text-[10px] bg-red-50/40 border border-red-100 rounded-lg p-2 font-medium text-slate-600 leading-relaxed max-w-sm">
                            <p className="font-semibold text-red-700 flex items-center gap-1">
                              <AlertCircle size={10} />
                              <span>{t("deals.lostModal.reasonLabel")}: {getLostReasonLabel(act.metadata.lostReason)}</span>
                            </p>
                            {act.metadata.lostReasonNote && (
                              <p className="italic text-slate-500 border-t border-slate-100 pt-1 mt-1 font-medium">"{act.metadata.lostReasonNote}"</p>
                            )}
                          </div>
                        )}
                        
                        <div className="text-[9px] text-slate-500 font-bold tracking-wide pt-0.5">
                          {t("deals.detail.by")}: <span className="text-slate-500">{act.author}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
    </>
  );
}
