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
import { XCircleSelector } from "../components/XCircleSelector";
import { DealForecastHistoryPanel, DealPipelineHealthBadges } from "../components/DealPipelineHealth";
import {
  RecordDetailHeader,
  recordDetailHeaderActionButtonClassName,
} from "@/components/crm/detail-archetype";
import { formatDateTime } from "@/shared/lib/format/date";
import type { DealDetailController, DealDetailProductCatalog } from "./dealDetailView.types";

export function DealDetailSidebarActions({ controller }: { controller: DealDetailController }) {
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
          {/* Quick Actions Panel */}
          <div data-deal-detail-actions="balanced" className="space-y-3.5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <TrendingUp size={13} className="text-indigo-600" />
              <span>{t("deals.detail.actionsTitle")}</span>
            </h3>

            {hasLinkedOrder ? (
              <div className="bg-emerald-50/80 border border-emerald-200 text-emerald-800 p-4 rounded-xl space-y-3 text-left">
                <p className="font-semibold text-xs flex items-center gap-1.5 text-emerald-950 uppercase tracking-wide">
                  <CheckCircle className="text-emerald-600 shrink-0" size={14} />
                  <span>{locale === "vi" ? "Đã tạo đơn hàng" : "Order created"}</span>
                </p>
                <div className="text-[11px] text-slate-700 font-medium space-y-1">
                  <p>
                    {locale === "vi"
                      ? `Đơn hàng ${latestLinkedOrder.orderNumber || latestLinkedOrder.id} đã được liên kết với cơ hội này.`
                      : `Order ${latestLinkedOrder.orderNumber || latestLinkedOrder.id} is linked to this opportunity.`}
                  </p>
                </div>
                <div className="space-y-1.5 pt-1">
                  <button
                    onClick={() => navigate(`/orders/${latestLinkedOrder.id}`)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer text-xs"
                  >
                    <ShoppingBag size={13} />
                    <span>{locale === "vi" ? "Xem đơn hàng" : "View order"}</span>
                  </button>

                  {linkedOrders.length > 1 && (
                    <button
                      onClick={() => navigate(`/orders?dealId=${deal.id}`)}
                      className="w-full bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer text-[10px]"
                    >
                      <span>
                        {locale === "vi"
                          ? "Xem tất cả đơn hàng liên quan"
                          : "View all linked orders"}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            ) : isTerminal ? (
              <div className="bg-slate-50 border border-slate-200 text-center p-3 rounded-xl space-y-1">
                <p className="text-slate-400 text-[10px] uppercase font-semibold tracking-wider">
                  {t("deals.detail.recordLocked")}
                </p>
                <p className="font-semibold text-slate-600">
                  {deal.stage === DealStage.WON 
                    ? t("deals.detail.lockedWon")
                    : t("deals.detail.lockedLost")}
                </p>
                {deal.stage === DealStage.WON && (
                  hasAcceptedQuote && acceptedQuote ? (
                    <button
                      onClick={() => {
                        if (hasLinkedOrder) {
                          navigate(`/orders/${latestLinkedOrder.id}`);
                        } else {
                          navigate(`/orders/new?quoteId=${acceptedQuote.id}`);
                        }
                      }}
                      className="w-full mt-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer text-xs"
                    >
                      <ShoppingBag size={13} />
                      <span>{locale === "vi" ? "Tạo đơn hàng từ báo giá" : "Create order from quote"}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (hasLinkedOrder) {
                          navigate(`/orders/${latestLinkedOrder.id}`);
                        } else {
                          navigate(`/orders/new?dealId=${deal.id}`);
                        }
                      }}
                      className="w-full mt-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer text-xs"
                    >
                      <ShoppingBag size={13} />
                      <span>{t("orders.actions.createFromDeal")}</span>
                    </button>
                  )
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Quote acceptance closes the linked Deal through the canonical workflow. */}
                {hasAcceptedQuote && acceptedQuote && (
                  <div className="mb-2.5 space-y-2 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-left">
                    <p className="flex items-center gap-1 text-xs font-semibold text-amber-950">
                      <Check className="shrink-0 text-emerald-600" size={14} />
                      <span>{locale === "vi" ? "Khách hàng đã chấp nhận báo giá" : "The customer accepted the Quote"}</span>
                    </p>
                    <p className="text-[11px] font-medium leading-relaxed text-slate-600">
                      {locale === "vi"
                        ? `Báo giá #${acceptedQuote.quoteNumber} đã được chấp nhận nhưng trạng thái Cơ hội chưa đồng bộ. Luồng chuẩn tự động Chốt thắng Cơ hội khi chấp nhận báo giá.`
                        : `Quote #${acceptedQuote.quoteNumber} is accepted but the Deal state is not synchronized. The canonical acceptance workflow closes the Deal as Won automatically.`}
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate(`/quotes/${acceptedQuote.id}`)}
                      className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-emerald-700"
                    >
                      <Check size={13} />
                      <span>{locale === "vi" ? "Mở báo giá để kiểm tra" : "Open Quote to review"}</span>
                    </button>
                  </div>
                )}

                {/* 1. Next Stage Action / Smart Proposal Stage workflow block */}
                {deal.stage === DealStage.PROPOSAL ? (
                  <div className="space-y-2.5 animate-fade-in text-left">
                    {relatedQuotes.length === 0 ? (
                      <div className="space-y-2">
                        <div className="p-3 bg-amber-50/50 text-slate-600 rounded-lg border border-amber-200 text-[11px] font-semibold leading-relaxed">
                          {t("deals.quotes.noQuoteYet")}
                        </div>
                        <button
                          onClick={() => navigate(`/quotes/new?dealId=${deal.id}`)}
                          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                        >
                          <Plus size={14} />
                          <span>{t("deals.actions.createQuote")}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {quoteState === "draft" && (
                          <>
                            <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-100 text-[11px] font-semibold">
                              <AlertCircle size={13} className="text-amber-500 shrink-0" />
                              <span>{t("deals.quoteState.draft")}</span>
                            </div>
                            <button
                              onClick={() => {
                                const q = relatedQuotes.find(r => r.status === QuoteStatus.DRAFT);
                                if (q) {
                                  navigate(`/quotes/${q.id}/edit?dealId=${deal.id}`);
                                } else {
                                  navigate(`/quotes/new?dealId=${deal.id}`);
                                }
                              }}
                              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer text-center text-xs"
                            >
                              <FileText size={14} />
                              <span>{t("deals.actions.continueQuoteDraft")}</span>
                            </button>
                          </>
                        )}
                        
                        {quoteState === "sent" && (
                          <>
                            <div className="flex items-center gap-1.5 text-sky-700 bg-sky-50 p-2.5 rounded border border-sky-200 text-[11px] font-semibold">
                              <Activity size={13} className="text-sky-500 shrink-0" />
                              <span>{t("deals.quoteState.sent")}</span>
                            </div>
                            <div className="p-3 bg-indigo-50 border border-indigo-100/50 rounded-lg text-slate-600 text-[11px] leading-relaxed text-center font-semibold">
                              <span>{t("deals.actions.trackCustomerResponse")}</span>
                            </div>
                          </>
                        )}

                        {quoteState === "accepted" && (
                          <>
                            <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 p-2.5 rounded border border-emerald-100 text-[11px] font-semibold">
                              <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                              <span>{t("deals.quoteState.accepted")}</span>
                            </div>
                            <button
                              onClick={() => {
                                if (hasLinkedOrder) {
                                  navigate(`/orders/${latestLinkedOrder.id}`);
                                } else {
                                  navigate(`/orders/new?quoteId=${acceptedQuote?.id}`);
                                }
                              }}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                            >
                              <ShoppingBag size={14} />
                              <span>{locale === "vi" ? "Tạo đơn hàng từ báo giá" : "Create order from quote"}</span>
                            </button>
                          </>
                        )}

                        {quoteState === "rejected" && (
                          <div className="flex items-center gap-1.5 text-rose-700 bg-rose-50 p-2.5 rounded border border-rose-100 text-[11px] font-semibold">
                            <XCircle size={13} className="text-rose-500 shrink-0" />
                            <span>{t("deals.quoteState.rejected")}</span>
                          </div>
                        )}

                        {quoteState === "expired" && (
                          <div className="flex items-center gap-1.5 text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200 text-[11px] font-semibold">
                            <AlertCircle size={13} className="text-slate-400 shrink-0" />
                            <span>{t("deals.quoteState.expired")}</span>
                          </div>
                        )}
                        
                        {/* Always show negotiation bypass option of stage timeline */}
                        <button
                          onClick={handleNextStage}
                          className="w-full mt-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer text-[10px]"
                        >
                          <ChevronRight size={12} />
                          <span>{t("deals.detail.advanceNextStage")}</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : getNextDealStage(deal.stage) ? (
                  <button
                    onClick={handleNextStage}
                    className="w-full bg-slate-950 text-white font-semibold py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer hover:bg-slate-800"
                  >
                    <ChevronRight size={14} />
                    <span>
                      {t("deals.detail.advanceNextStage")}
                    </span>
                  </button>
                ) : (
                  // Negotiation can be marked WON
                  deal.stage === DealStage.NEGOTIATION && acceptedQuote && (
                     <button
                      onClick={() => navigate(`/quotes/${acceptedQuote.id}`)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      <Trophy size={14} />
                      <span>{t("deals.detail.markWon")}</span>
                    </button>
                  )
                )}

                {/* 2. Mark Lost Action */}
                <button
                  onClick={() => setIsLostModalOpen(true)}
                  className="w-full bg-white hover:bg-red-50 text-red-600 border border-red-200 font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <X size={14} />
                  <span>{t("deals.detail.markLost")}</span>
                </button>
              </div>
            )}
          </div>
    </>
  );
}
