import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShoppingBag, Plus, Trash2, FileText, ChevronRight, AlertCircle, Phone, Mail, User, Check, X, MessageCircle, MessageSquare, Calendar, Trophy, TrendingUp, Users, Activity, Sparkles, RefreshCw, CheckCircle, XCircle, Settings, Download, ShieldCheck } from "lucide-react";
import { Badge, Button, Input, Modal, SectionHeader, Select, Textarea, Table, TableHeader, TableBody, TableRow, TableCell, getQuoteStatusBadgeVariant } from "@/shared/components/ui";
import { formatCurrency } from "@/shared/lib/format/currency";
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

export function DealDetailPipelineWorkspace({ controller }: { controller: DealDetailController }) {
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
          <DealForecastHistoryPanel deal={deal} />

          {/* AI Deal Risk & Predictive Forecast Panel */}
          <div data-deal-detail-ai-assessment="balanced" className="animate-fade-in rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/20 via-white to-violet-50/15 p-4 text-left text-xs shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Sparkles className="w-4 h-4 text-violet-500 animate-pulse" />
                <span>{locale === "vi" ? "AI Đánh Giá & Dự Đoán Cơ Hội" : "AI Deal Assessment"}</span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                new Date(deal.expectedCloseDate) < new Date() && !isTerminal
                  ? "bg-rose-50 text-rose-700 border border-rose-100"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-100"
              }`}>
                {new Date(deal.expectedCloseDate) < new Date() && !isTerminal
                  ? (locale === "vi" ? "Rủi ro: Quá Hạn" : "Risk: Overdue")
                  : (locale === "vi" ? "Khỏe mạnh" : "Healthy Pipeline")
                }
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3 text-slate-600 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
              <div>
                <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-500">{locale === "vi" ? "Doanh số Thô" : "Unweighted Amount"}</span>
                <span className="font-semibold text-slate-700">{formatCurrency(deal.amount, deal.currency || "VND", locale)}</span>
              </div>
              <div>
                <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-500">{locale === "vi" ? "Dự Đoán Doanh Số Trọng Số" : "Weighted AI Prediction"}</span>
                <span className="font-semibold text-indigo-700">{formatCurrency(deal.amount * ((deal.opportunityScore || 50) / 100), deal.currency || "VND", locale)}</span>
              </div>
            </div>

            <p className="text-slate-600 mb-3.5 leading-relaxed">
              {new Date(deal.expectedCloseDate) < new Date() && !isTerminal
                ? (locale === "vi" 
                    ? "Cảnh báo: Ngày dự kiến đóng hợp đồng đã quá hạn. Nhân viên cần liên hệ ngay với người đại diện của doanh nghiệp để rà soát điều khoản thương mại hoặc kéo dài ngày thầu chính thức."
                    : "Alert: Expected close date of this deal has surpassed the schedule. Instantly initiate follow-up terms review or postpone closure timeline to maintain forecast health."
                  )
                : (locale === "vi"
                    ? "Cơ hội đang có tín hiệu tích cực dựa trên thời gian phản hồi và giá trị báo giá hiện tại."
                    : "No major risks identified. Deal parameters such as negotiation speed indicators list perfectly within normal thresholds."
                  )
              }
            </p>

            <div className="flex flex-wrap gap-2 pt-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const draft = `Chào Anh/Chị,\n\nTôi gửi thông tin cập nhật lộ trình triển khai cơ hội hợp tác "${deal.name}". Chúng tôi đã thiết kế chi tiết phương án và sẵn sàng chuẩn bị báo giá chính thức trong tuần tới.\n\nVui lòng sắp xếp thời gian trao đổi ngắn để chúng tôi làm rõ các điều khoản thương mại.\n\nTrân trọng,\nChuyên viên Kinh doanh UnicoreCRM`;
                  navigator.clipboard.writeText(draft);
                  triggerToast("success", locale === "vi" ? "Đã sao chép thư đề xuất hành động tiếp theo!" : "Next-step draft copied into clipboard successfully!");
                }}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-2 font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{locale === "vi" ? "Soạn nháp bước tiếp theo" : "Draft Next-step Action"}</span>
              </button>
            </div>
          </div>

          {/* Giai đoạn phễu: Step Workflow Map */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-800">
              <Activity size={13} className="text-indigo-600" />
              <span>{t("deals.detail.pipelineMap")}</span>
            </h3>

            {/* Stages Grid Timeline */}
            <div data-deal-detail-stage-map="responsive" className="overflow-x-auto pb-1 crm-scroll-x">
              <div className="relative grid min-w-[560px] grid-flow-col auto-cols-fr items-start pt-1">
                {/* Connecting background Line */}
                <div className="absolute left-6 right-6 top-3 h-0.5 bg-slate-100 z-0" />
              
                {stageConfigs.filter(s => s.isActive && s.category !== "lost").sort((a,b) => a.order - b.order).map(s => s.code).map((stg, idx, arr) => {
                  const isCompleted = isWonStage(deal.stage, stageConfigs) || (arr.indexOf(deal.stage) !== -1 && idx < arr.indexOf(deal.stage));
                  const isActive = deal.stage === stg;
                  const label = getDealStageLabel(stg);

                  return (
                    <div key={stg} className="relative z-10 flex min-w-0 flex-col items-center px-1 text-center">
                      <div className={`relative flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold transition-all ${
                        isCompleted
                          ? "border-indigo-600 bg-indigo-600 text-white shadow-3xs"
                          : isActive
                          ? "border-2 border-indigo-600 bg-white text-indigo-600 shadow-sm"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}>
                        {isCompleted ? <Check size={10} /> : idx + 1}
                      </div>
                      <span className={`mt-1.5 max-w-24 crm-text-wrap text-[9px] leading-snug ${
                        isActive ? "font-semibold text-indigo-700" : "font-medium text-slate-500"
                      }`}>
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Locked Terminal State Banner */}
            {isTerminal && (
              <div className={`p-3 rounded-lg border flex items-center gap-2 mt-4 text-[11px] ${
                isWonStage(deal.stage, stageConfigs) 
                  ? "bg-emerald-50/50 border-emerald-200 text-emerald-800" 
                  : "bg-red-50/50 border-red-200 text-red-800"
              }`}>
                {isWonStage(deal.stage, stageConfigs) ? (
                  <>
                    <Trophy size={14} className="text-emerald-600 shrink-0" />
                    <span className="font-semibold">{t("deals.detail.terminal.wonMessage")}</span>
                  </>
                ) : (
                  <>
                    <XCircleSelector size={14} className="text-red-500 shrink-0 align-top mt-0.5" />
                    <div className="flex flex-col">
                      <span className="font-semibold">
                        {t("deals.detail.terminal.lostMessage")}
                        {deal.lostReason ? ` (${t("deals.lostModal.reasonLabel")}: ${getLostReasonLabel(deal.lostReason)})` : ""}
                      </span>
                      {getLostReasonNoteHelper(deal) && (
                        <span className="text-[10px] text-red-700/80 mt-1 font-semibold leading-relaxed">
                          {t("deals.lostModal.notesLabel")}: {getLostReasonNoteHelper(deal)}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Line Items Inventory Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <SectionHeader
              className="mb-0"
              icon={<ShoppingBag size={13} />}
              title={t("deals.lineItems.title")}
              actions={!isTerminal ? (
                <Button
                  id="add-sample-product-btn"
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<Plus size={12} />}
                  onClick={() => setIsProductPickerOpen(true)}
                  className="h-9 whitespace-nowrap rounded-xl"
                >
                  {t("deals.detail.addLineItem")}
                </Button>
              ) : undefined}
            />

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{t("deals.lineItems.product")}</TableCell>
                    <TableCell className="w-20 text-center text-[10px] font-medium uppercase tracking-wide text-slate-500">{t("deals.lineItems.quantity")}</TableCell>
                    <TableCell className="text-right text-[10px] font-medium uppercase tracking-wide text-slate-500">{t("deals.lineItems.unitPrice")}</TableCell>
                    <TableCell className="w-24 text-center text-[10px] font-medium uppercase tracking-wide text-slate-500">{t("deals.lineItems.discount")}</TableCell>
                    <TableCell className="text-right text-[10px] font-medium uppercase tracking-wide text-slate-500">{t("deals.lineItems.total")}</TableCell>
                    {!isTerminal && <TableCell className="w-16 text-center text-[10px] font-medium uppercase tracking-wide text-slate-500">{t("common.actions")}</TableCell>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deal.lineItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isTerminal ? 5 : 6} className="text-center py-8 text-slate-400 font-semibold italic">
                        {t("deals.detail.emptyLineItems")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    deal.lineItems.map(item => {
                      const rowDiscounted = (item.unitPrice ?? item.unitPriceSnapshot ?? 0) * (1 - item.discountPercent / 100);
                      const rowTotal = rowDiscounted * item.quantity;
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <p className="font-semibold leading-snug text-slate-900">{item.productName}</p>
                            <span className="text-[10px] leading-snug text-slate-500">{item.description}</span>
                          </TableCell>
                          
                          <TableCell className="text-center">
                            {isTerminal ? (
                              <span className="font-semibold text-slate-800">{item.quantity}</span>
                            ) : (
                              <input 
                                type="number" min="1"
                                value={item.quantity}
                                onChange={(e) => handleUpdateLineItem(item.id, "quantity", Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-14 bg-slate-50 border border-slate-200 focus:bg-white focus:outline-indigo-500 rounded px-1.5 py-1 text-center font-bold"
                              />
                            )}
                          </TableCell>

                          <TableCell className="text-right text-slate-800 font-mono font-semibold">
                            {formatCurrency(item.unitPrice ?? item.unitPriceSnapshot ?? 0, deal.currency || "VND", locale)}
                          </TableCell>

                          <TableCell className="text-center">
                            {isTerminal ? (
                              <span className="font-semibold text-indigo-700">{item.discountPercent}%</span>
                            ) : (
                              <input 
                                type="number" min="0" max="100"
                                value={item.discountPercent}
                                onChange={(e) => handleUpdateLineItem(item.id, "discountPercent", Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                                className="w-14 bg-slate-50 border border-slate-200 focus:bg-white focus:outline-indigo-500 rounded px-1.5 py-1 text-center font-semibold text-indigo-700"
                              />
                            )}
                          </TableCell>

                          <TableCell className="text-right font-mono font-semibold text-indigo-950">
                            {formatCurrency(rowTotal, deal.currency || "VND", locale)}
                          </TableCell>

                          {!isTerminal && (
                            <TableCell className="text-center">
                              <button
                                onClick={() => handleDeleteLineItem(item.id)}
                                className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                              >
                                <Trash2 size={12} />
                              </button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Subtotal summary calculations */}
            <div className="flex flex-col items-end gap-1.5 rounded-xl border border-slate-200 bg-slate-50/55 p-3.5 text-xs">
              <div className="flex w-full max-w-72 justify-between gap-4">
                <span className="font-semibold text-slate-400">{t("deals.detail.subtotal")}:</span>
                <span className="font-semibold text-slate-800">
                  {formatCurrency(deal.lineItems.reduce((sum, item) => sum + ((item.unitPrice ?? item.unitPriceSnapshot ?? 0) * item.quantity), 0), deal.currency || "VND", locale)}
                </span>
              </div>
              <div className="flex w-full max-w-72 justify-between gap-4 border-b border-slate-200 pb-1.5 font-semibold text-indigo-700">
                <span>{t("deals.detail.discountAdjustment")}:</span>
                <span>
                  - {formatCurrency(deal.lineItems.reduce((sum, item) => sum + (((item.unitPrice ?? item.unitPriceSnapshot ?? 0) * item.quantity) * (item.discountPercent / 100)), 0), deal.currency || "VND", locale)}
                </span>
              </div>
              <div className="flex w-full max-w-72 justify-between gap-4 pt-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-800">{t("deals.detail.finalValue")}:</span>
                <strong className="text-xs font-semibold text-indigo-700">
                  {formatCurrency(deal.amount, deal.currency || "VND", locale)}
                </strong>
              </div>
            </div>
          </div>
    </>
  );
}
