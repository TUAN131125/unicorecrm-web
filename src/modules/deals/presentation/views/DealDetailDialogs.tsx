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
import { createDurableId } from "@/shared/ids";
import type { DealDetailController, DealDetailProductCatalog } from "./dealDetailView.types";

export function DealDetailDialogs({
  controller,
  productCatalog,
}: {
  controller: DealDetailController;
  productCatalog: DealDetailProductCatalog;
}) {
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
    handleApplyLineItems,
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
      {/* 4. MODAL: Mark WON Confirmation */}
      <Modal isOpen={isWonModalOpen} onClose={() => setIsWonModalOpen(false)} title={t("deals.winModal.title")} size="sm">
        <div className="space-y-4 text-xs font-semibold">
              <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 text-[10px] font-bold block uppercase">{t("deals.columns.deal")}:</span>
                  <span className="text-slate-800 font-semibold">{deal.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] font-bold block uppercase">{t("deals.columns.customer")}:</span>
                  <span className="text-slate-800 font-semibold">
                    {deal.customerName || deal.organizationAccountName || deal.contactName || deal.buyerRef.id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] font-bold block uppercase">{t("deals.winModal.contractValue")}:</span>
                  <span className="text-indigo-600 font-semibold text-sm block">{formatCurrency(deal.amount, deal.currency || "VND", locale)}</span>
                </div>
                {/* Product list summary inside win popup */}
                {deal.lineItems.length > 0 && (
                  <div className="pt-1.5 border-t border-slate-200/60">
                    <span className="text-slate-500 text-[9px] font-bold block uppercase">{t("deals.winModal.deliverables")}:</span>
                    <ul className="list-disc list-inside mt-1 font-bold text-slate-700 space-y-0.5">
                      {deal.lineItems.map(item => (
                        <li key={item.id} className="crm-text-wrap">
                          {item.productName} ({t("deals.winModal.quantityShort")}: {item.quantity})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Canonical commitment evidence explainer */}
              <div className="bg-emerald-50/50 border border-emerald-100 p-2.5 rounded text-emerald-800 font-bold leading-snug">
                {locale === "vi"
                  ? "WON chỉ được ghi khi có Quote Accepted hoặc Order Confirmed. Không tạo Customer object và không ghi purchase completion ở bước này."
                  : "WON requires Quote Accepted or Order Confirmed evidence. This action creates no Customer object and records no purchase completion."}
              </div>

              <div className="flex justify-end gap-2 pt-1 border-t border-slate-100 mt-4">
                <Button
                  type="button"
                  onClick={() => setIsWonModalOpen(false)}
                  variant="secondary"
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmWon}
                  variant="primary"
                >
                  {locale === "vi" ? "Xác nhận WON có evidence" : "Confirm WON with evidence"}
                </Button>
              </div>
        </div>
      </Modal>

      {/* 5. MODAL: Mark LOST with Reason Required */}
      <Modal variant="form" isOpen={isLostModalOpen} onClose={() => {
        setIsLostModalOpen(false);
        setLostError("");
        setLostReason("");
        setLostNotes("");
        setLostRecycleDecision("DO_NOT_RECYCLE");
        setLostRevisitAt("");
      }} title={t("deals.lostModal.title")} size="sm">
        <div className="space-y-4 text-xs font-semibold">
              {lostError && (
                <div className="bg-red-50 text-red-700 border border-red-200 p-2.5 rounded-lg flex items-center gap-1">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>{lostError}</span>
                </div>
              )}

              <div className="space-y-4">
                <Select
                  label={t("deals.lostModal.reasonLabel")}
                  value={lostReason}
                  onChange={(e) => setLostReason(e.target.value)}
                  required
                >
                  <option value="">{t("deals.lostModal.reasonPlaceholder")}</option>
                  <option value="PRICE_TOO_HIGH">{t("deals.lostReasons.priceTooHigh")}</option>
                  <option value="NO_BUDGET">{t("deals.lostReasons.noBudget")}</option>
                  <option value="COMPETITOR_SELECTED">{t("deals.lostReasons.competitorSelected")}</option>
                  <option value="NO_DECISION">{t("deals.lostReasons.noDecision")}</option>
                  <option value="NOT_A_FIT">{t("deals.lostReasons.notAFit")}</option>
                  <option value="OTHER">{t("deals.lostReasons.other")}</option>
                </Select>

                <Textarea
                  label={t("deals.lostModal.notesLabel")}
                  rows={3}
                  placeholder={t("deals.lostModal.notesPlaceholder")}
                  value={lostNotes}
                  onChange={(e) => setLostNotes(e.target.value)}
                />

                <Select
                  label={locale === "vi" ? "Quyết định recycle" : "Recycle decision"}
                  value={lostRecycleDecision}
                  onChange={(e) => setLostRecycleDecision(e.target.value as "RECYCLE" | "CONDITIONAL" | "DO_NOT_RECYCLE")}
                >
                  <option value="DO_NOT_RECYCLE">{locale === "vi" ? "Không recycle" : "Do not recycle"}</option>
                  <option value="RECYCLE">{locale === "vi" ? "Recycle" : "Recycle"}</option>
                  <option value="CONDITIONAL">{locale === "vi" ? "Recycle có điều kiện" : "Conditional recycle"}</option>
                </Select>

                {lostRecycleDecision !== "DO_NOT_RECYCLE" && (
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">{locale === "vi" ? "Ngày revisit bắt buộc" : "Required revisit date"}</label>
                    <Input
                      type="date"
                      value={lostRevisitAt}
                      onChange={(e) => setLostRevisitAt(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                <Button
                  type="button"
                  onClick={() => {
                    setIsLostModalOpen(false);
                    setLostError("");
                    setLostReason("");
                    setLostNotes("");
                    setLostRecycleDecision("DO_NOT_RECYCLE");
                    setLostRevisitAt("");
                  }}
                  variant="secondary"
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  onClick={handleConfirmLost}
                  variant="danger"
                >
                  {t("deals.lostModal.confirm")}
                </Button>
              </div>
        </div>
      </Modal>

      {deal && (
        <ProductPickerModal
          id={`deal_picker_${deal.id}`}
          isOpen={isProductPickerOpen}
          onClose={() => setIsProductPickerOpen(false)}
          products={productCatalog}
          initialSelected={deal.lineItems.map(item => {
            const originalProd = productCatalog.find(p => p.id === item.productId || p.name === item.productName);
            return {
              product: originalProd || { id: item.productId, name: item.productName ?? item.productNameSnapshot ?? item.productId, sku: item.skuSnapshot || "", type: (item.productTypeSnapshot || "license") as Product["type"], status: "active", category: "", unit: "", listPrice: item.unitPrice ?? item.unitPriceSnapshot ?? 0, currency: (deal.currency ?? "VND") as Product["currency"], taxRate: item.taxRate || 0, taxMode: (item.taxMode || "none") as Product["taxMode"], billingCycle: (item.billingCycleSnapshot || "one_time") as Product["billingCycle"], isSubscription: false, isRenewable: false, tags: [], createdAt: "", updatedAt: "" },
              quantity: item.quantity,
              discountPercent: item.discountPercent,
              billingCycle: item.billingCycleSnapshot as Product["billingCycle"] | undefined,
              taxMode: item.taxModeSnapshot || item.taxMode
            };
          })}
          onApply={(selected) => {
            const nextLines: DealLineItem[] = selected.map(s => {
              const rawLineSub = (s.customPrice !== undefined ? s.customPrice : s.product.listPrice) * s.quantity;
              const tRate = s.product.taxRate ?? 10;
              const tMode = s.taxMode || s.product.taxMode || "none";
              const lineTaxAmt = tMode === "exclusive" ? rawLineSub * (tRate / 100) : (tMode === "inclusive" ? rawLineSub - (rawLineSub / (1 + tRate / 100)) : 0);
              const totalAmount = tMode === "exclusive" ? rawLineSub + lineTaxAmt : rawLineSub;

              const existing = deal.lineItems.find(x => x.productId === s.product.id || x.productName === s.product.name);

              return {
                id: existing?.id || createDurableId(`deal-line-${s.product.id}`),
                productId: s.product.id,
                productName: s.product.name,
                productNameSnapshot: s.product.name,
                skuSnapshot: s.product.sku,
                productTypeSnapshot: s.product.type,
                billingCycleSnapshot: s.billingCycle || s.product.billingCycle || "one_time",
                description: existing?.description || s.product.description || "",
                quantity: s.quantity,
                unitPriceSnapshot: s.customPrice !== undefined ? s.customPrice : s.product.listPrice,
                unitPrice: s.customPrice !== undefined ? s.customPrice : s.product.listPrice,
                discountPercent: s.discountPercent ?? existing?.discountPercent ?? 0,
                discountAmount: s.discountPercent ? ((s.customPrice !== undefined ? s.customPrice : s.product.listPrice) * s.quantity * s.discountPercent) / 100 : 0,
                taxRate: tRate,
                taxRateSnapshot: tRate,
                taxMode: tMode,
                taxModeSnapshot: tMode,
                taxAmount: lineTaxAmt,
                subtotal: rawLineSub,
                totalAmount: totalAmount,
                customPriceEnabled: s.customPrice !== undefined
              };
            });

            // Outcome-gated: the picker only closes after `deal.update` commits, so a
            // failed update never looks like a successful line-item change.
            void handleApplyLineItems(nextLines).then((applied) => {
              if (applied) setIsProductPickerOpen(false);
            });
          }}
        />
      )}
    </>
  );
}
