import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShoppingBag, Plus, Trash2, FileText, ChevronRight, AlertCircle, Phone, Mail, User, Check, X, MessageCircle, MessageSquare, Calendar, Trophy, TrendingUp, Users, Activity, Sparkles, RefreshCw, CheckCircle, XCircle, Settings, Download, ShieldCheck } from "lucide-react";
import { Badge, Button, Input, Modal, SectionHeader, Select, Textarea, Table, TableHeader, TableBody, TableRow, TableCell, getQuoteStatusBadgeVariant } from "@/shared/components/ui";
import { formatCurrency, formatVnd } from "@/shared/lib/format/currency";
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

export function DealDetailRelatedRecords({ controller }: { controller: DealDetailController }) {
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
          {/* Related Customer Card */}
          <div data-deal-detail-related-records="balanced" className="space-y-3.5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Users size={13} className="text-indigo-600" />
              <span>{t("deals.detail.customerCard")}</span>
            </h3>

            {customer ? (
              <div className="space-y-2.5">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p 
                      onClick={() => navigate(`/customers/${customer.id}`)}
                      className="font-semibold text-slate-900 border-b border-transparent hover:border-slate-800 hover:text-indigo-700 duration-150 inline cursor-pointer leading-wide text-[11px]"
                    >
                      {customerDisplayName}
                    </p>
                    <span className={`text-[9px] uppercase font-semibold px-1.5 py-0.5 rounded-full border ${
                      customer.type === "INDIVIDUAL"
                        ? "bg-violet-50 text-violet-700 border-violet-100"
                        : "bg-slate-50 text-slate-600 border-slate-200"
                    }`}>
                      {customerTypeLabel}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-1 leading-relaxed">{customerSecondaryInfo}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-100 font-medium">
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase font-bold">{t("customers.columnSegment")}</span>
                    <span className="text-slate-800 font-bold text-[10px]">{customer.segment || t("common.notAvailable")}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block uppercase font-bold">{t("customers.columnHealth")}</span>
                    <span className={`font-semibold text-[10px] ${
                      customer.health === "Tốt" 
                        ? "text-emerald-600" 
                        : customer.health === "Trung bình" 
                        ? "text-amber-600" 
                        : "text-red-600"
                    }`}>{customer.health}</span>
                  </div>
                  <div className="col-span-2 mt-1">
                    <span className="text-[9px] text-slate-500 block uppercase font-bold">{t("customers.mrrValue")}</span>
                    <span className="text-indigo-600 font-semibold text-[11px] block">{formatVnd(customer.mrr, locale)}</span>
                  </div>
                  <div className="col-span-2 mt-1">
                    <span className="text-[9px] text-slate-500 block uppercase font-bold">{t("customer360.totalProductsOwned")}:</span>
                    <span className="text-slate-800 font-bold block">{t("customer360.streamProductsOwned").replace("{{count}}", (customer.productsOwned || []).length.toString())}</span>
                  </div>
                </div>

                {hasLinkedOrder && latestLinkedOrder && (
                  <div className="mt-3.5 pt-3.5 border-t border-dashed border-slate-200 space-y-2">
                    <p className="font-semibold text-[10px] uppercase text-indigo-950 flex items-center gap-1">
                      <ShoppingBag size={12} className="text-indigo-600" />
                      <span>{locale === "vi" ? "Đơn hàng liên kết" : "Linked Order"}</span>
                    </p>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[10.5px] text-slate-700 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-900 font-mono">#{latestLinkedOrder.orderNumber || latestLinkedOrder.id}</span>
                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full ${
                          latestLinkedOrder.state === "COMPLETED" 
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : "bg-amber-50 text-amber-700 border border-amber-100"
                        }`}>{latestLinkedOrder.state}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-semibold space-y-0.5">
                        <div className="flex justify-between">
                          <span>{locale === "vi" ? "Thanh toán:" : "Payment:"}</span>
                          <span className="text-slate-700 font-bold uppercase">{getPaymentSummaryForOrder(latestLinkedOrder.id, latestLinkedOrder.grandTotal ?? latestLinkedOrder.totalAmount ?? 0, latestLinkedOrder.currency ?? "VND").state}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>{locale === "vi" ? "Tổng tiền:" : "Total amount:"}</span>
                          <span className="text-indigo-600 font-bold">{formatCurrency(latestLinkedOrder.totalAmount, latestLinkedOrder.currency ?? "VND", locale)}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => navigate(`/orders/${latestLinkedOrder.id}`)}
                        className="w-full mt-1 px-2 py-1 text-center font-bold text-[10px] text-indigo-700 hover:text-white bg-indigo-50 hover:bg-indigo-600 rounded-md border border-indigo-200 transition-all cursor-pointer"
                      >
                        {locale === "vi" ? "Xem chi tiết đơn hàng" : "View Order details"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2.5" data-deal-buyer-state="pre-customer">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900 text-[11px]">
                    {deal.organizationAccountName || deal.contactName || deal.customerName || deal.buyerRef.id}
                  </p>
                  <span className="rounded-full border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-indigo-700">
                    {deal.buyerRef.type === "ORGANIZATION_ACCOUNT"
                      ? (locale === "vi" ? "Tổ chức" : "Organization")
                      : (locale === "vi" ? "Liên hệ" : "Contact")}
                  </span>
                </div>
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[10px] font-semibold leading-relaxed text-slate-600">
                  {locale === "vi"
                    ? "Đây là bên mua đang được theo dõi. Hồ sơ Customer 360 chỉ xuất hiện sau khi có bằng chứng mua hàng hoàn tất."
                    : "This is the buyer relationship being pursued. Customer 360 appears only after completed-purchase evidence exists."}
                </p>
              </div>
            )}
          </div>

          {/* Related Contact Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <User size={13} className="text-indigo-600" />
              <span>{t("deals.detail.contactCard")}</span>
            </h3>

            {deal.contactName ? (
              <div className="space-y-2.5">
                <div>
                  <h4 className="font-bold text-slate-800 text-xs">{deal.contactName}</h4>
                  <span className="text-[10px] text-slate-500 block leading-tight">{deal.contactTitle}</span>
                </div>
                
                <div className="space-y-1.5 text-[10px] font-semibold text-slate-600 pt-1.5 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Phone size={10} className="text-slate-500" />
                    <span>{deal.contactPhone}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail size={10} className="text-slate-500" />
                    <span className="crm-text-wrap">{deal.contactEmail}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 font-bold italic">{t("common.notAvailable")}</p>
            )}
          </div>

          {/* Next Follow Up Date / Risk Activity details */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Calendar size={13} className="text-indigo-600" />
              <span>{t("deals.detail.nextPlan")}</span>
            </h3>

            <div className="space-y-2.5 text-[11px]">
              {(deal.nextActionAt || deal.nextActionSummary) ? (
                <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-2.5 space-y-1">
                  <p className="text-amber-800 font-semibold uppercase tracking-wide text-[9px]">{t("deals.card.nextActivity")}:</p>
                  <p className="text-slate-800 font-bold leading-tight">{deal.nextActionSummary}</p>
                  <p className="text-amber-700 font-bold text-[9px]">{formatDateTime(deal.nextActionAt, locale)}</p>
                </div>
              ) : (
                <p className="text-slate-500 font-medium italic">{t("deals.detail.noNextPlan")}</p>
              )}

              {/* Overdue/Risk notifications */}
              {deal.riskBadge && (
                <div className="bg-red-50/50 border border-red-100 text-red-700 rounded-lg p-2.5 flex items-start gap-1.5 font-bold">
                  <AlertCircle size={12} className="shrink-0 mt-0.5" />
                  <span className="leading-snug">{deal.riskBadge}</span>
                </div>
              )}
            </div>
          </div>
    </>
  );
}
