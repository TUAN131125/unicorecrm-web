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
import { RecordHeaderActionMenu } from "@/components/crm/RecordHeaderActionMenu";
import { formatDateTime } from "@/shared/lib/format/date";
import type { DealDetailController, DealDetailProductCatalog } from "./dealDetailView.types";

export function DealDetailHeaderSection({ controller }: { controller: DealDetailController }) {
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
      {/* Toast Alert */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl border shadow-lg flex items-center gap-3 ${
              toast.type === "success" 
                ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            {toast.type === "success" ? <CheckCircle size={18} className="text-emerald-500" /> : <AlertCircle size={18} className="text-rose-500" />}
            <span className="text-sm font-medium">{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Shared CRM record detail header contract */}
      <RecordDetailHeader
        id="deal-detail-header"
        backLabel={t("deals.detail.backToPipeline")}
        onBack={() => navigate(returnTo)}
        identityIcon={<TrendingUp size={20} />}
        identityToneClassName="border-violet-200 bg-violet-50 text-violet-700"
        title={deal.name}
        titleOverflow="wrap-mobile"
        accessibleTitle={deal.name}
        status={
          <Badge variant="info" className="whitespace-nowrap text-[9px] font-semibold tracking-wide">
            {getDealStageLabel(deal.stage)}
          </Badge>
        }
        metadata={
          <>
            <span className="font-semibold text-slate-700">{deal.customerName || deal.organizationAccountName || deal.contactName || deal.buyerRef.id}</span>
            <span className="text-slate-300" aria-hidden="true">•</span>
            <span className="crm-text-wrap">ID: {deal.id}</span>
          </>
        }
        actions={(
          <div className="flex items-center gap-2">
            {!isTerminal && isQuoteEnabled ? (
              <Button
                type="button"
                onClick={() => navigate(`/quotes/new?dealId=${deal.id}`)}
                variant="primary"
                size="sm"
                icon={<FileText size={12} />}
                className={recordDetailHeaderActionButtonClassName}
              >
                {t("deals.quotes.createDocument", { document: quoteDocumentLabel })}
              </Button>
            ) : null}
            <RecordHeaderActionMenu
              sections={[]}
              label={locale === "vi" ? "Thao tác khác" : "More actions"}
              audit={{
                resourceKey: "deals",
                recordId: deal.id,
                title: locale === "vi" ? "Kiểm toán Cơ hội" : "Opportunity audit",
                label: locale === "vi" ? "Xem lịch sử kiểm toán" : "View audit history",
                sectionTitle: locale === "vi" ? "KIỂM SOÁT" : "GOVERNANCE",
                closeLabel: locale === "vi" ? "Đóng" : "Close",
              }}
            />
          </div>
        )}
      />

      {/* 2. Top-level Business Profile Card */}
      <div data-deal-detail-summary="balanced" className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`rounded-full border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide shadow-3xs ${(() => {
              const conf = stageConfigs.find(s => s.code === deal.stage);
              const color = conf?.color || "indigo";
              switch (color) {
                case "blue": return "bg-blue-50 border-blue-200 text-blue-700";
                case "yellow": return "bg-yellow-50 border-yellow-200 text-yellow-700";
                case "orange": return "bg-orange-50 border-orange-200 text-orange-700";
                case "purple": return "bg-purple-50 border-purple-200 text-purple-700";
                case "green": return "bg-emerald-50 border-emerald-200 text-emerald-700";
                case "red": return "bg-red-50 border-red-200 text-red-700";
                case "slate": return "bg-slate-50 border-slate-200 text-slate-700";
                case "teal": return "bg-teal-50 border-teal-200 text-teal-700";
                default: return "bg-indigo-50 border-indigo-100 text-indigo-700";
              }
            })()}`}>
              {getDealStageLabel(deal.stage)}
            </span>

            {isQuoteEnabled && (
              <span className={`rounded-full border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide shadow-3xs ${
                quoteState === "accepted"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : quoteState === "sent"
                  ? "bg-sky-50 border-sky-200 text-sky-700"
                  : quoteState === "draft"
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : quoteState === "rejected"
                  ? "bg-rose-50 border-rose-200 text-rose-700"
                  : quoteState === "expired"
                  ? "bg-slate-100 border-slate-300 text-slate-600"
                  : "bg-slate-50 border-slate-200 text-slate-500"
              }`}>
                {t(`deals.quoteState.${quoteState}`)}
              </span>
            )}
          </div>
        </div>

        {/* Multi-metrics Header Line */}
        <div className="mt-2 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4">
          <div className="space-y-0.5">
            <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">{t("deals.columns.amount")}</span>
            <span className="text-sm font-semibold text-indigo-700">
              {formatCurrency(deal.amount, deal.currency || "VND", locale)}
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">{t("deals.columns.probability")}</span>
            <span className="text-sm font-semibold text-slate-800">{deal.opportunityScore}%</span>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">{t("deals.columns.expectedClose")}</span>
            <span className="text-sm font-medium text-slate-700">
              {new Date(deal.expectedCloseDate).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US")}
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">{t("deals.columns.owner")}</span>
            <span className="inline-block text-sm font-medium text-slate-800">
              {resolveWorkspaceMemberLabel(deal.ownerId, locale)}
            </span>
          </div>
        </div>
        <div className="border-t border-slate-100 pt-4">
          <DealPipelineHealthBadges deal={deal} />
        </div>
      </div>
    </>
  );
}
