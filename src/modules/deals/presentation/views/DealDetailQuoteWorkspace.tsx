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

const QuoteMeta: React.FC<{ label: string; value: React.ReactNode; emphasis?: boolean }> = ({ label, value, emphasis }) => (
  <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
    <div className="text-[9px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
    <div className={`mt-1 break-words text-xs font-semibold ${emphasis ? "text-slate-950" : "text-slate-600"}`}>{value}</div>
  </div>
);

export function DealDetailQuoteWorkspace({ controller }: { controller: DealDetailController }) {
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
          {/* Quotes & Proposals Section */}
          {isQuoteEnabled && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <SectionHeader
                className="mb-0"
                icon={<FileText size={13} />}
                title={t("deals.quotes.sectionTitle")}
                actions={!isTerminal ? (
                  <Button
                    type="button"
                    actionIntent="create"
                    size="sm"
                    icon={<Plus size={12} />}
                    onClick={() => navigate(`/quotes/new?dealId=${deal?.id}`)}
                    className="h-9 whitespace-nowrap rounded-xl"
                  >
                    {t("deals.quotes.addQuote")}
                  </Button>
                ) : undefined}
              />

              {relatedQuotes.length === 0 ? (
                <div className="text-center py-6 text-slate-400 font-semibold italic text-xs animate-fade-in">
                  {t("deals.quotes.empty")}
                </div>
              ) : (
                <div data-deal-quote-workspace="responsive-cards" className="space-y-3">
                  {relatedQuotes.map((quote) => (
                    <article key={quote.id} className="rounded-2xl border border-slate-200 bg-slate-50/55 p-4 transition hover:border-violet-200 hover:bg-white hover:shadow-sm">
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(120px,0.7fr)_minmax(110px,0.65fr)_minmax(110px,0.65fr)] xl:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <button type="button" onClick={() => navigate(`/quotes/${quote.id}`)} className="crm-text-wrap text-sm font-semibold text-slate-950 hover:text-violet-700">
                              {quote.quoteNumber}
                            </button>
                            <Badge
                              variant={getQuoteStatusBadgeVariant(quote.status)}
                              className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-wide"
                            >
                              {t(`quote.status.${quote.status.toLowerCase()}` as any)}
                            </Badge>
                          </div>
                          <div className="mt-1 crm-text-wrap break-words text-[11px] font-medium leading-relaxed text-slate-500 [overflow-wrap:anywhere]">{quote.title}</div>
                        </div>

                        <QuoteMeta label={t("deals.quotes.total")} value={formatCurrency(quote.grandTotal, quote.currency || deal.currency || "VND", locale)} emphasis />
                        <QuoteMeta label={t("deals.quotes.validUntil")} value={quote.validUntil || quote.expiryDate || t("common.notAvailable")} />
                        <QuoteMeta label={t("deals.quotes.createdAt")} value={quote.createdAt} />
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
                        {quote.status === QuoteStatus.DRAFT && (
                          <>
                            <Button
                              type="button"
                              actionIntent="navigate"
                              size="xs"
                              onClick={() => navigate(`/quotes/${quote.id}/edit?dealId=${deal?.id}`)}
                            >
                              {locale === "vi" ? "Sửa" : "Edit"}
                            </Button>
                            {quote.approvalRequired && quote.approvalStatus !== QuoteApprovalStatus.APPROVED ? (
                              <Button
                                type="button"
                                actionIntent="retry"
                                size="xs"
                                icon={<ShieldCheck size={12} />}
                                onClick={() => navigate(`/quotes/${quote.id}`)}
                              >
                                {quote.approvalRequestedAt ? (locale === "vi" ? "Xem phê duyệt" : "View approval") : (locale === "vi" ? "Gửi duyệt" : "Request approval")}
                              </Button>
                            ) : (
                              <>
                                <Button
                                  type="button"
                                  actionIntent="navigate"
                                  size="xs"
                                  icon={<Mail size={12} />}
                                  onClick={() => navigate(`/quotes/${quote.id}/edit?action=gmail`)}
                                >
                                  {locale === "vi" ? "Gửi Gmail" : "Send Gmail"}
                                </Button>
                                <Button
                                  type="button"
                                  actionIntent="confirm"
                                  size="xs"
                                  icon={<MessageCircle size={12} />}
                                  onClick={() => navigate(`/quotes/${quote.id}/edit?action=confirm`)}
                                >
                                  {locale === "vi" ? "Xác nhận đã gửi" : "Confirm sent"}
                                </Button>
                                <Button
                                  type="button"
                                  actionIntent="navigate"
                                  size="xs"
                                  icon={<Download size={12} />}
                                  onClick={() => navigate(`/quotes/${quote.id}/edit?action=pdf`)}
                                >
                                  PDF
                                </Button>
                              </>
                            )}
                          </>
                        )}
                        {quote.status === QuoteStatus.REVIEW && (
                          <Button
                            type="button"
                            actionIntent="retry"
                            size="xs"
                            icon={<ShieldCheck size={12} />}
                            onClick={() => navigate(`/quotes/${quote.id}`)}
                          >
                            {locale === "vi" ? "Mở phê duyệt" : "Open approval"}
                          </Button>
                        )}
                        {quote.status === QuoteStatus.SENT && (
                          <>
                            <Button
                              type="button"
                              actionIntent="navigate"
                              size="xs"
                              icon={<MessageCircle size={12} />}
                              onClick={() => navigate(`/quotes/${quote.id}?action=confirm`)}
                            >
                              {locale === "vi" ? "Thêm kênh đã gửi" : "Add delivery channel"}
                            </Button>
                            <Button
                              type="button"
                              actionIntent="confirm"
                              size="xs"
                              onClick={() => handleUpdateQuoteStatus(quote.id, QuoteStatus.ACCEPTED)}
                            >
                              {locale === "vi" ? "Khách chấp nhận" : "Customer accepted"}
                            </Button>
                            <Button
                              type="button"
                              actionIntent="destructive"
                              size="xs"
                              onClick={() => handleUpdateQuoteStatus(quote.id, QuoteStatus.REJECTED)}
                            >
                              {locale === "vi" ? "Khách từ chối" : "Customer rejected"}
                            </Button>
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
    </>
  );
}
