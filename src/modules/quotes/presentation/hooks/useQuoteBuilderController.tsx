import { getDirtyUnsavedWork, getUnsavedWorkVersion, subscribeUnsavedWork } from "@/platform/unsaved-work";
import { compareQuotePricing, quotePricingReconciliationNotice } from "../model/quotePricingReconciliation";
import { quoteBuilderFieldFeedback, quoteBuilderSubmissionIssues, type QuoteBuilderIssue } from "../model/quoteBuilderErrors";
import { useQuoteBuyer } from "./useQuoteBuyer";
import { useQuoteSourceBuyer } from "./useQuoteSourceBuyer";
import { toWorkspacePath } from "@/platform/navigation";
import { normalizeApplicationError } from "@/shared/domain";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import type { BuyerRef } from "@/platform/identity";
import { getQuoteDetailResource } from "../../application/vertical-slice/quoteAuthoritativeQueries";
import { saveQuoteDeliveryEvidence } from "../services/saveQuoteDeliveryEvidence";
import { useQuoteFormLifecycle } from "./useQuoteFormLifecycle";
import { useModuleAuthoritativeResource, formatApplicationError } from "@/shared/operations";
import React, { useState, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import type { CustomerDisplay as Customer } from "@/modules/customers";
import { type CrmWorkspaceConfig } from "@/platform/workspace-config";
import { getDealDetailResource, DealStage, isDealConnectedMode, updateDeals, type Deal, type DealActivity } from "@/modules/deals";
import { invalidateModuleQueries } from "@/shared/application";
import { validateQuoteDraft } from "../../application/queries/quoteDraftValidation";
import { QuoteStatus, SalesDocumentAdjustmentType, type Quote, type QuoteDeliveryChannel, type QuoteLineItem, type QuotePaymentMethod, type QuotePaymentTiming, type SalesDocumentAdjustment } from "../../domain/model/quote.types";
import { normalizeQuoteLineItem } from "../../domain/rules/quoteCalculations";

import { calculateQuoteDraftTotals } from "../../domain/rules/quoteDraftPricing";

import { isQuoteConnectedMode, allocateQuoteIdentitySnapshot, saveQuoteCommand, saveAndIssueQuoteCommand, type QuoteIssuanceCheckpoint } from "../../public/quotes";

import { useQuotes } from "../hooks/useQuotes";
import { useDeals } from "../hooks/useDeals";
import { DEFAULT_CRM_WORKSPACE_CONFIG } from "@/platform/workspace-config/workspaceConfigDefaults";
import { useI18n } from "@/i18n";
import { getProductCatalogSnapshot } from "@/modules/products";
import { findCustomerByRelationshipRefSnapshot, getCustomerSnapshot } from "@/modules/customers";
import { getContactSnapshot } from "@/modules/contacts";
import { getOrganizationAccountSnapshot } from "@/modules/organizations";
import type { QuoteDeliveryConfirmationValue } from "../components/QuoteDeliveryConfirmationModal";
import { useWorkspaceOperationalConfigurationResource, useWorkspaceRuntimeSettings } from "@/platform/workspace-config";
import { getInvoiceSellerInformation, subscribeToInvoiceConfiguration } from "@/modules/invoices";
import { useSubscribableSnapshot } from "@/platform/react";
import { createQuotePdfFromElement, downloadQuotePdf } from "../services/quotePdfExport";
import { launchQuoteGmailDelivery } from "../services/quoteGmailDelivery";
import { usePlatformState } from "@/platform/application-state";
import { resolveWorkspaceMemberLabel } from "@/platform/member-directory";
import { getPaymentMethodCatalogSnapshot } from "@/modules/payments";
import { getCurrencyMinorUnit } from "@/shared/money";
import { createDurableId } from "@/shared/ids";
import { canEditAgreementWithDraftControls, resolveDraftPaymentAgreement, allocateAgreementLineId, legacyAgreementDraftLine, draftLinesFromAgreement, buildPaymentAgreementSnapshot, type PaymentAgreementDraftLine } from "../model/quotePaymentAgreementDraft";

export interface QuoteBuilderPageProps {
  crmConfig?: CrmWorkspaceConfig;
  customers: Customer[];
}

interface PendingQuoteDelivery {
  quoteId: string;
  expectedVersion?: number;
  channel: QuoteDeliveryChannel;
  recipientEmail?: string;
  recipient?: string;
  fileName?: string;
  channelLocked?: boolean;
}

function resolveBuyerRefFromCustomer(customerId: string) {
  return getCustomerSnapshot(customerId)?.relationshipRef;
}
export function useQuoteBuilderController(props: QuoteBuilderPageProps) {
  const {
  crmConfig = DEFAULT_CRM_WORKSPACE_CONFIG,
  customers = []
} = props;
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const workspaceConfigurationResource = useWorkspaceOperationalConfigurationResource();
  const workspaceConfiguration = workspaceConfigurationResource.data;
  const runtimeSettings = useWorkspaceRuntimeSettings();
  const workspace = useWorkspaceContextSnapshot();
  const connected = isQuoteConnectedMode();
  const invoiceConfiguration = useSubscribableSnapshot(getInvoiceSellerInformation, subscribeToInvoiceConfiguration);
  const invoiceAddress = workspaceConfiguration?.addresses.find((address) => address.id === invoiceConfiguration.invoiceAddressId);
  const senderCompanyName = invoiceConfiguration.sellerName || workspaceConfiguration?.businessInformation.legalName || workspaceConfiguration?.businessInformation.displayName || "";
  const senderAddress = invoiceAddress?.addressLine1 || "";
  const senderEmail = invoiceConfiguration.email || workspaceConfiguration?.businessInformation.billingEmail || workspaceConfiguration?.businessInformation.email || "";
  const senderTaxId = invoiceConfiguration.taxId || workspaceConfiguration?.businessInformation.taxId || "";
  const operationGuide = {
    title: locale === "vi" ? "Hướng dẫn tạo Báo giá" : "Quotation creation guide",
    steps: locale === "vi" ? [
      "Kiểm tra cơ hội hoặc khách hàng liên kết trước khi nhập nội dung.",
      "Thêm hàng hóa/dịch vụ, số lượng, đơn giá, chiết khấu và thuế.",
      "Thiết lập và kiểm tra điều khoản thanh toán.",
      "Nhấn Tạo & phát hành báo giá để lưu và phát hành PDF chính thức.",
      "Dùng Xem trước để kiểm tra bố cục trước khi xuất PDF.",
    ] : [
      "Review the linked deal or customer before entering the quotation.",
      "Add products/services, quantities, prices, discounts, and tax.",
      "Configure and review payment terms.",
      "Create and issue the Quote to save it and publish its official PDF.",
      "Use Preview to verify the document before PDF export.",
    ],
    tips: locale === "vi" ? [
      "Nút hành động cố định ở cuối trang là nơi duy nhất để lưu và xem trước.",
      "Phần tài liệu chỉ dùng để xem trước, không lặp lại hành động gửi hoặc xuất.",
    ] : [
      "The sticky action bar is the single place for save and preview actions.",
      "The document card is preview-only and does not duplicate delivery actions.",
    ],
  } as const;
  const { session, activeWorkspace } = usePlatformState();
  const actorId = session.principal.accountId;
  const { quotes } = useQuotes();
  const { deals } = useDeals();
  const products = getProductCatalogSnapshot();
  const setDeals: React.Dispatch<React.SetStateAction<Deal[]>> = (updater) => { updateDeals(updater); };
  const { quoteId: routeTargetId } = useParams();
  const [routeSearchParams, setRouteSearchParams] = useSearchParams();
  const sourceSearchParams = new URLSearchParams(routeSearchParams); sourceSearchParams.delete("quoteIntent");
  const lifecycle = useQuoteFormLifecycle(`${routeTargetId ?? ""}|${sourceSearchParams.toString()}`);
  const separator = lifecycle.targetId?.indexOf("|") ?? 0;
  const quoteId = lifecycle.targetId?.slice(0, separator) || undefined;
  const searchParams = useMemo(() => new URLSearchParams(lifecycle.targetId?.slice(separator + 1) ?? ""), [lifecycle.targetId, separator]);
  const dealIdParam = searchParams.get("dealId");
  const quoteIdParam = quoteId || searchParams.get("quoteId");
  const customerIdParam = searchParams.get("customerId");
  const contactIdParam = searchParams.get("contactId");
  const organizationIdParam = searchParams.get("organizationId");
  const publishAction = searchParams.get("action");

  const [persistedDraft, setPersistedDraft] = useState<Quote | undefined>();
  const [savedNavigation, setSavedNavigation] = useState<{ path: string; notice: string | undefined } | null>(null);
  const unsavedVersion = useSyncExternalStore(subscribeUnsavedWork, getUnsavedWorkVersion, () => "");
  const [directBuyer, setDirectBuyer] = useState<{ ref: BuyerRef; label: string } | null>(null);
  const sourceBuyer = useQuoteSourceBuyer(connected && !dealIdParam && !quoteIdParam, contactIdParam, customerIdParam, organizationIdParam);
  const sourceDealVersion = useRef<number | undefined>(undefined);
  const issuanceCheckpoint = useRef<QuoteIssuanceCheckpoint | undefined>(undefined);
  const creationIntent = useRef(routeSearchParams.get("quoteIntent") || createDurableId("quote-create-issue"));
  useEffect(() => {
    if (connected && !routeTargetId && !routeSearchParams.has("quoteId") && !routeSearchParams.has("quoteIntent"))
      setRouteSearchParams(previous => { const next = new URLSearchParams(previous); next.set("quoteIntent", creationIntent.current); return next; }, { replace: true });
  }, [connected, routeTargetId, routeSearchParams, setRouteSearchParams]);
  const saveIntent = useRef<{ fingerprint: string; key: string; unresolved: boolean } | null>(null);
  const detailQuery = useModuleAuthoritativeResource(getQuoteDetailResource(quoteIdParam || "__new__"), { enabled: Boolean(quoteIdParam), scopeKey: workspace.workspaceId });
  const liveEditingQuote = persistedDraft || (connected && quoteIdParam ? detailQuery.data : quotes.find(q => q.id === quoteIdParam));
  const openingQuote = useRef(liveEditingQuote);
  if (openingQuote.current?.id !== liveEditingQuote?.id
      || persistedDraft && openingQuote.current?.resourceVersion !== persistedDraft.resourceVersion)
    openingQuote.current = liveEditingQuote ? structuredClone(liveEditingQuote) : undefined;
  const editingQuote = openingQuote.current;
  const referencedOrganization = organizationIdParam ? getOrganizationAccountSnapshot(organizationIdParam) : undefined;
  const organizationCustomer = referencedOrganization
    ? findCustomerByRelationshipRefSnapshot({ type: "ORGANIZATION_ACCOUNT", id: referencedOrganization.id })
    : undefined;
  const organizationPrimaryContact = referencedOrganization?.primaryContactId
    ? getContactSnapshot(referencedOrganization.primaryContactId)
    : undefined;
  const referencedCustomer = customers.find(c => c.id === (editingQuote?.customerId || customerIdParam || organizationCustomer?.id || ""));

  // Selection state for current referenced Deal
  const [selectedDealId, setSelectedDealId] = useState<string>(() => {
    if (editingQuote) return editingQuote.dealId || "";
    if (dealIdParam) return dealIdParam;
    if (customerIdParam || organizationIdParam) return "";
    return "";
  });
  
  // Find referenced deal
  const sourceDealQuery = useModuleAuthoritativeResource(getDealDetailResource(selectedDealId || "__none__"), { enabled: Boolean(selectedDealId), scopeKey: workspace.workspaceId });
  const referencedDeal = selectedDealId ? (connected ? sourceDealQuery.data?.id === selectedDealId ? sourceDealQuery.data : null : deals.find(d => d.id === selectedDealId) || null) : null;
  const currentBuyerRef = referencedDeal?.buyerRef ?? editingQuote?.buyerRef ?? sourceBuyer.buyer ?? directBuyer?.ref
    ?? (!connected ? (referencedOrganization ? { type: "ORGANIZATION_ACCOUNT" as const, id: referencedOrganization.id } : customerIdParam ? resolveBuyerRefFromCustomer(customerIdParam) ?? undefined : undefined) : undefined);
  const buyerInfo = useQuoteBuyer(currentBuyerRef, connected);
  const buyerSourcePath = currentBuyerRef ? toWorkspacePath(activeWorkspace.workspaceKey, "crm", `${currentBuyerRef.type === "CONTACT" ? "contacts" : "organizations"}/${encodeURIComponent(currentBuyerRef.id)}`) : undefined;
  const quoteSourceInitializationKey = editingQuote
    ? `edit:${editingQuote.id}`
    : selectedDealId
      ? `deal:${selectedDealId}`
      : `direct:${contactIdParam || organizationIdParam || customerIdParam || referencedCustomer?.id || "none"}`;
  const initializedQuoteSourceRef = useRef<string | null>(null);
  const autoPublishActionRef = useRef<string | null>(null);
  const saveHandlerRef = useRef<() => Promise<boolean>>(async () => false);

  // Locked Deal flag - if dealIdParam exists or we are currently editing an existing quote, lock it
  const isDealLocked = !!dealIdParam || !!editingQuote || !!customerIdParam || !!organizationIdParam || !!contactIdParam;

  // Identity allocation belongs to the Quote application boundary, not collection length or component time.
  const allocateOpeningIdentity = () => connected ? { id: createDurableId("quote-intent"), quoteNumber: "" } : allocateQuoteIdentitySnapshot();
  const [newQuoteIdentity, setNewQuoteIdentity] = useState(allocateOpeningIdentity);
  const identityCycle = useRef(lifecycle.cycle);
  useEffect(() => { if (identityCycle.current !== lifecycle.cycle) { identityCycle.current = lifecycle.cycle; setSelectedDealId(dealIdParam || ""); setNewQuoteIdentity(allocateOpeningIdentity()); setPersistedDraft(undefined); setSavedNavigation(null); setDirectBuyer(null); saveIntent.current = null; issuanceCheckpoint.current = undefined; creationIntent.current = routeSearchParams.get("quoteIntent") || createDurableId("quote-create-issue"); sourceDealVersion.current = undefined; openingQuote.current = undefined; setSavedDraftFingerprint(null); setDraftHydrated(false); initializedQuoteSourceRef.current = null; } }, [lifecycle.cycle, dealIdParam]);
  const quoteNumber = editingQuote?.quoteNumber ?? newQuoteIdentity.quoteNumber;

  // Dynamic Quote fields
  const [quoteTitle, setQuoteTitle] = useState("");
  const [currency, setCurrency] = useState(() => editingQuote?.currency || workspaceConfiguration?.localeRegion.currencies.baseCurrency || runtimeSettings.baseCurrency);
  const [quoteLines, setQuoteLines] = useState<QuoteLineItem[]>([]);
  const [adjustments, setAdjustments] = useState<SalesDocumentAdjustment[]>([]);
  const [taxPercent, setTaxPercent] = useState(10); // Default 10%
  const [discountAmount, setDiscountAmount] = useState(0); 
  const [quoteNotes, setQuoteNotes] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [paymentTiming, setPaymentTiming] = useState<QuotePaymentTiming>("PREPAID");
  const [paymentDueDays, setPaymentDueDays] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<QuotePaymentMethod>("BANK_TRANSFER");
  const [paymentAgreementLines, setPaymentAgreementLines] = useState<PaymentAgreementDraftLine[]>(() => [legacyAgreementDraftLine()]);
  const requiresPhysicalShipping = useMemo(() => quoteLines.some((line) => !["service", "subscription", "license", "implementation"].includes(line.productTypeSnapshot || "license")), [quoteLines]);
  const paymentMethods = useMemo(() => getPaymentMethodCatalogSnapshot({ currency, requiresPhysicalShipping }).filter((method) => method.enabled), [currency, requiresPhysicalShipping]);
  const [exportBusy, setExportBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [deliveryConfirmation, setDeliveryConfirmation] = useState<PendingQuoteDelivery | null>(null);
  const [validUntil, setValidUntil] = useState(() => {
    // Default valid until 30 days from now
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });

  // State-based mock notifications
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const [suggestedProductId, setSuggestedProductId] = useState<string>();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "info" | "error">("info");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [validationKind, setValidationKind] = useState<"FIELD" | "STATUS">("FIELD");
  const [serverFieldIssues, setServerFieldIssues] = useState<QuoteBuilderIssue[]>([]);
  const [saveBusy, setSaveBusy] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const firstLineActionRef = useRef<HTMLSpanElement>(null);
  const [savedDraftFingerprint, setSavedDraftFingerprint] = useState<string | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);

  const triggerToast = (msg: string, type: "success" | "info" | "error" = "info") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Check if deal stage is WON or LOST (terminal stages)
  const isClosedDeal = referencedDeal && (Boolean(referencedDeal.archivedAt) || referencedDeal.stageCategory === "WON" || referencedDeal.stageCategory === "LOST" || referencedDeal.stage === DealStage.WON || referencedDeal.stage === DealStage.LOST);

  const getDealStageLabel = (stage: DealStage) => {
    switch (stage) {
      case DealStage.DISCOVERY:
        return t("dealStages.new");
      case DealStage.QUALIFIED:
        return t("dealStages.consulting");
      case DealStage.PROPOSAL:
        return t("dealStages.proposal");
      case DealStage.NEGOTIATION:
        return t("dealStages.negotiation");
      case DealStage.WON:
        return t("dealStages.won");
      case DealStage.LOST:
        return t("dealStages.lost");
      default:
        return String(stage);
    }
  };

  // Initialize pricing items, titles, and notes once per source record. Repository
  // refreshes for the same Deal/Quote must not wipe edits already made in the builder.
  useEffect(() => {
    if (initializedQuoteSourceRef.current === quoteSourceInitializationKey) return;
    if (connected && !workspaceConfiguration) return;
    if (quoteIdParam && !editingQuote) return;
    if (dealIdParam && selectedDealId !== dealIdParam) return;
    if (selectedDealId && !referencedDeal) return;
    if (sourceBuyer.required && !sourceBuyer.buyer) return;
    if (!connected && customerIdParam && !referencedCustomer) return;
    if (!connected && organizationIdParam && !referencedOrganization) return;

    if (referencedDeal) sourceDealVersion.current = referencedDeal.resourceVersion;
    if (editingQuote) {
      setSelectedDealId(editingQuote.dealId || "");
      setQuoteTitle(editingQuote.title);
      setCurrency(editingQuote.currency || runtimeSettings.baseCurrency);
      setQuoteLines(editingQuote.lineItems || []);
      setTaxPercent(editingQuote.taxPercent ?? 10);
      setDiscountAmount(editingQuote.discountTotal ?? editingQuote.discountAmountToTotal ?? 0);
      if (editingQuote.adjustments) {
        setAdjustments(editingQuote.adjustments);
      } else {
        const hasLineTaxSnapshots = (editingQuote.lineItems ?? []).some((line) => (line.taxModeSnapshot ?? "none") !== "none");
        const legacyDocumentDiscount = Math.max(0, (editingQuote.discountTotal ?? editingQuote.discountAmountToTotal ?? 0)
          - (editingQuote.lineItems ?? []).reduce((sum, line) => sum + (line.lineDiscountAmount ?? 0), 0));
        setAdjustments([
          ...(!hasLineTaxSnapshots && (editingQuote.taxPercent ?? 0) > 0
            ? [{ id: "adj_vat", label: "Thuế giá trị gia tăng (VAT)", type: SalesDocumentAdjustmentType.TAX, calculation: "PERCENTAGE" as const, value: editingQuote.taxPercent ?? 0, amount: 0 }]
            : []),
          ...(legacyDocumentDiscount > 0
            ? [{ id: "adj_disc", label: "Chiết khấu trực tiếp", type: SalesDocumentAdjustmentType.DISCOUNT, calculation: "FIXED_AMOUNT" as const, value: legacyDocumentDiscount, amount: legacyDocumentDiscount }]
            : []),
        ]);
      }
      setQuoteNotes(editingQuote.notes ?? editingQuote.termsAndNotes ?? "");
      setRecipientEmail(editingQuote.recipientEmail || (connected ? "" : referencedDeal?.contactEmail || referencedCustomer?.email || ""));
      setPaymentTiming(editingQuote.paymentTiming ?? "PREPAID");
      setPaymentDueDays(editingQuote.paymentDueDays ?? 0);
      setPaymentMethod(editingQuote.paymentMethod ?? "BANK_TRANSFER");
      setPaymentAgreementLines(draftLinesFromAgreement(editingQuote));
      if (editingQuote.validUntil) {
        setValidUntil(editingQuote.validUntil);
      }
    } else if (referencedDeal) {
      setQuoteTitle(t("quoteBuilder.defaultTitle", { deal: referencedDeal.name }));
      setCurrency(workspaceConfiguration?.localeRegion.currencies.baseCurrency || runtimeSettings.baseCurrency);
      const initialLines: QuoteLineItem[] = (!connected && referencedDeal.currency === (workspaceConfiguration?.localeRegion.currencies.baseCurrency || runtimeSettings.baseCurrency) ? referencedDeal.lineItems || [] : []).map(item => normalizeQuoteLineItem({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productNameSnapshot: item.productNameSnapshot || item.productName || "",
        skuSnapshot: item.skuSnapshot || "",
        productTypeSnapshot: item.productTypeSnapshot || "license",
        billingCycleSnapshot: item.billingCycleSnapshot || "one_time",
        description: item.description || "",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitPriceSnapshot: item.unitPriceSnapshot || item.unitPrice || 0,
        discountPercent: item.discountPercent || 0,
        taxRateSnapshot: item.taxRateSnapshot || item.taxRate || 0,
        taxModeSnapshot: item.taxModeSnapshot || item.taxMode || "none",
        subtotal: item.subtotal || ((item.quantity || 1) * (item.unitPrice || 0)),
        totalAmount: item.totalAmount || ((item.quantity || 1) * (item.unitPrice || 0))
      }));
      setQuoteLines(initialLines);
      setRecipientEmail(connected ? "" : referencedDeal.contactEmail || "");
      setPaymentTiming("PREPAID");
      setPaymentDueDays(0);
      setPaymentMethod("BANK_TRANSFER");
      setPaymentAgreementLines([legacyAgreementDraftLine()]);
      setQuoteNotes(t("quoteBuilder.terms.default", "Điều khoản thanh toán: 100% sau khi ký hợp đồng."));
    } else {
      // Direct Quote mode
      const custName = connected ? (locale === "vi" ? "khách hàng" : "customer") : referencedOrganization?.displayName || referencedCustomer?.displayName || referencedCustomer?.name || "Khách hàng";
      setQuoteTitle(locale === "vi"
        ? `Báo giá cho ${custName}`
        : `Quote for ${custName}`
      );
      setCurrency(workspaceConfiguration?.localeRegion.currencies.baseCurrency || runtimeSettings.baseCurrency);
      setQuoteLines([]);
      setRecipientEmail(
        connected ? "" : organizationPrimaryContact?.workEmail
          || organizationPrimaryContact?.email
          || organizationPrimaryContact?.personalEmail
          || referencedOrganization?.email
          || referencedCustomer?.billingEmail
          || referencedCustomer?.email
          || "",
      );
      setPaymentTiming("PREPAID");
      setPaymentDueDays(0);
      setPaymentMethod("BANK_TRANSFER");
      setPaymentAgreementLines([legacyAgreementDraftLine()]);
      setQuoteNotes(locale === "vi" ? "Điều khoản thanh toán: 100% chuyển khoản trong vòng 15 ngày." : "Payment terms: 100% Bank Transfer within 15 days.");
    }

    initializedQuoteSourceRef.current = quoteSourceInitializationKey;
    setDraftHydrated(true);
  }, [workspaceConfiguration, runtimeSettings.baseCurrency, connected, dealIdParam, draftHydrated,quoteSourceInitializationKey, quoteIdParam, customerIdParam, organizationIdParam, selectedDealId, referencedDeal, editingQuote, t, locale, referencedCustomer, referencedOrganization, organizationPrimaryContact, sourceBuyer.required, sourceBuyer.buyer]);

  // Handle value modifications inside table
  const handleUpdateLineField = (id: string, field: keyof QuoteLineItem, value: any) => {
    const decimalKey = field === "quantity" ? "quantity" : field === "unitPrice" ? "unitPrice" : field === "discountPercent" ? "discountRate" : field === "taxRateSnapshot" ? "taxRate" : undefined;
    const display = decimalKey ? Number(value) : value;
    setQuoteLines((previous) => previous.map((item) => item.id === id
      ? normalizeQuoteLineItem({ ...item, [field]: display, ...(field === "unitPrice" ? { unitPriceSnapshot: display } : {}), ...(field === "productName" ? { productNameSnapshot: value } : {}), ...(field === "description" ? { descriptionSnapshot: value } : {}), ...(decimalKey ? { inputDecimals: { ...item.inputDecimals, [decimalKey]: String(value) } } : {}) })
      : item));
  };

  // Add line item dynamic behavior
  const handleAddLineItem = () => {
    const newItem = normalizeQuoteLineItem({
      id: createDurableId("item"),
      productNameSnapshot: "",
      descriptionSnapshot: "",
      quantity: 1,
      unitPriceSnapshot: 0,
      discountPercent: 0,
      taxRateSnapshot: 0,
      taxModeSnapshot: "none",
    });
    setQuoteLines(prev => [...prev, newItem]);
  };

  // Remove line item dynamic behavior
  const handleRemoveLineItem = (id: string) => {
    setQuoteLines(prev => prev.filter(item => item.id !== id));
  };

  // Commercial totals are calculated by the Quote domain layer.
  const {
    lineItems: pricedQuoteLines,
    subtotal: rawSubtotal,
    discountTotal: computedDiscounts,
    feeTotal: computedFees,
    taxTotal: computedTaxes,
    grandTotal: quoteGrandTotal,
    adjustments: pricedAdjustments,
  } = calculateQuoteDraftTotals(quoteLines, adjustments, getCurrencyMinorUnit(currency));

  const paymentAgreementReadOnly = connected && !canEditAgreementWithDraftControls(editingQuote);
  const paymentAgreement = useMemo(() => connected
    ? resolveDraftPaymentAgreement(editingQuote, paymentAgreementLines, quoteGrandTotal, currency, editingQuote?.id ?? newQuoteIdentity.id)
    : buildPaymentAgreementSnapshot(paymentAgreementLines, quoteGrandTotal, currency, editingQuote?.id ?? newQuoteIdentity.id),
  [connected, currency, editingQuote, newQuoteIdentity.id, paymentAgreementLines, quoteGrandTotal]);
  const paymentAgreementPercent = paymentAgreementLines
    .filter((line) => line.amountMode === "PERCENTAGE")
    .reduce((sum, line) => sum + Math.max(0, line.percentage), 0);

  const currentDraftFingerprint = useMemo(() => JSON.stringify({
    title: quoteTitle,
    lines: pricedQuoteLines,
    adjustments: pricedAdjustments,
    notes: quoteNotes,
    validUntil,
    recipientEmail,
    paymentTiming,
    paymentDueDays,
    paymentMethod,
    paymentAgreement,
    currency,
    directBuyer,
  }), [directBuyer, currency, paymentAgreement, paymentDueDays, paymentMethod, paymentTiming, pricedAdjustments, pricedQuoteLines, quoteNotes, quoteTitle, recipientEmail, validUntil]);

  const { fieldBinding, fieldIssueCurrent } = quoteBuilderFieldFeedback({ title: quoteTitle, recipientEmail, currency, validUntil,
    lineItems: quoteLines, buyerRef: currentBuyerRef, sourceDealId: selectedDealId, paymentAgreement, adjustments, notes: quoteNotes }, buyerInfo);

  useEffect(() => {
    if (draftHydrated && savedDraftFingerprint === null) setSavedDraftFingerprint(currentDraftFingerprint);
  }, [currentDraftFingerprint, draftHydrated, savedDraftFingerprint]);

  const hasUnsavedChanges = draftHydrated && savedDraftFingerprint !== null && savedDraftFingerprint !== currentDraftFingerprint;

  lifecycle.register(hasUnsavedChanges, () => {
    initializedQuoteSourceRef.current = null;
    setSavedDraftFingerprint(null);
    setDraftHydrated(false);
  }, () => saveHandlerRef.current());

  // A successful command clears dirty/pending state before navigation reaches the shell blocker.
  // Wait for this form's registry effect and the shell's subscribed commit; other dirty forms keep their guard.
  useEffect(() => {
    if (!savedNavigation || lifecycle.pending || hasUnsavedChanges) return;
    const ownEntry = `quote-builder:${lifecycle.targetId}:${lifecycle.cycle}`;
    if (getDirtyUnsavedWork().some(entry => entry.id === ownEntry)) return;
    const frame = window.requestAnimationFrame(() => {
      if (!lifecycle.isCurrent()) return;
      setSavedNavigation(null);
      navigate(savedNavigation.path, { state: savedNavigation.notice ? { quotePricingNotice: savedNavigation.notice } : undefined });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [savedNavigation, lifecycle.pending, lifecycle.targetId, lifecycle.cycle, hasUnsavedChanges, unsavedVersion, navigate]);

  // Execute Quote saving
  const validateCurrentDraft = (): boolean => {
    setValidationKind("FIELD");
    setValidationAttempt(value => value + 1);
    setServerFieldIssues([]);
    setValidationError(null);
    if (quoteLines.some(line => Object.entries(line.inputDecimals ?? {}).some(([key, value]) =>
      !/^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/.test(value) || (key === "quantity" && Number(value) <= 0) || ((key === "discountRate" || key === "taxRate") && Number(value) > 100))) || adjustments.some(item => item.valueDecimal !== undefined && !/^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/.test(item.valueDecimal))) {
      setValidationError(locale === "vi" ? "Nhập số thập phân không âm, tối đa sáu chữ số lẻ; số lượng phải dương và tỷ lệ không vượt 100%." : "Enter non-negative decimals with at most six fractional digits; quantity must be positive and rates cannot exceed 100%.");
      return false;
    }
    const validation = validateQuoteDraft(quoteTitle, quoteLines, {
      minOneLineItem: t("quoteBuilder.validation.minOneLineItem"),
      productRequired: t("quoteBuilder.validation.productRequired"),
      rowNumber: (row) => t("quoteBuilder.validation.rowNumber", { row }),
      quantityInvalid: t("quoteBuilder.validation.quantityInvalid"),
      unitPriceInvalid: t("quoteBuilder.validation.unitPriceInvalid"),
      discountInvalid: t("quoteBuilder.validation.discountInvalid"),
      titleRequired: t("quoteBuilder.validation.titleRequired"),
    });
    if (validation) {
      setValidationError(validation);
      return false;
    }
    if (paymentAgreementLines.length === 0 || paymentAgreement.lines.some((line) => Number(line.previewAmount.amount) < 0)) {
      setValidationError(locale === "vi" ? "Thỏa thuận thanh toán phải có ít nhất một đợt hợp lệ." : "Payment Agreement requires at least one valid line.");
      return false;
    }
    if (paymentAgreementPercent > 100.000001) {
      setValidationError(locale === "vi" ? "Tổng tỷ lệ các đợt thanh toán không được vượt 100%." : "Payment Agreement percentages cannot exceed 100%.");
      return false;
    }
    return true;
  };

  const buildCurrentQuote = (): Quote | null => {
    if (connected && !workspaceConfiguration) { setValidationError(locale === "vi" ? "Chưa tải được cấu hình tiền tệ. Hãy tải lại trang rồi thử lại." : "Currency settings could not be loaded. Reload the page and retry."); return null; }
    if ((quoteIdParam && !editingQuote) || (selectedDealId && !referencedDeal) || (connected && (detailQuery.loading || sourceDealQuery.loading))) {
      setValidationError(locale === "vi" ? "Hãy đợi dữ liệu nguồn tải xong." : "Wait for the source record to finish loading.");
      return null;
    }
    if (!validateCurrentDraft()) return null;

    if (editingQuote) {
      return {
        ...editingQuote,
        title: quoteTitle,
        lineItems: pricedQuoteLines,
        subtotal: rawSubtotal,
        discountTotal: computedDiscounts,
        discountAmountToTotal: computedDiscounts,
        taxPercent: adjustments.find((item) => item.type === "TAX" && item.calculation === "PERCENTAGE")?.value ?? taxPercent,
        taxTotal: computedTaxes,
        grandTotal: quoteGrandTotal,
        notes: quoteNotes,
        termsAndNotes: quoteNotes,
        validUntil,
        expiryDate: validUntil,
        adjustments: pricedAdjustments,
        recipientEmail: recipientEmail.trim() || undefined,
        paymentTiming,
        paymentDueDays: paymentTiming === "POSTPAID" ? Math.max(0, paymentDueDays) : 0,
        paymentMethod,
        paymentAgreement,
        updatedAt: new Date().toISOString(),
      };
    }

    let finalCustId = "";
    let finalCustName = "";
    let finalCustAddress = "";
    let finalCustContact = "";
    let finalDealId = "";
    let finalDealName = "";
    let finalContactId = "";
    let finalLeadId = "";
    let finalLeadName = "";

    if (referencedDeal) {
      finalCustId = referencedDeal.customerId || "";
      finalCustName = referencedDeal.customerName || referencedDeal.organizationAccountName || referencedDeal.contactName || "";
      finalCustAddress = referencedDeal.address || "";
      finalCustContact = referencedDeal.contactName ? `${referencedDeal.contactName} - ${referencedDeal.contactPhone || ""}` : "";
      finalDealId = referencedDeal.id;
      finalDealName = referencedDeal.name;
      finalContactId = referencedDeal.contactId || "";
      finalLeadId = referencedDeal.leadId || "";
      finalLeadName = referencedDeal.leadName || "";
      if (!finalCustName) {
        finalCustName = referencedDeal.contactName || referencedDeal.leadName || "Người nhận Cơ hội";
      }
    } else if (referencedOrganization) {
      finalCustId = organizationCustomer?.id || customerIdParam || "";
      finalCustName = referencedOrganization.displayName;
      finalCustAddress = referencedOrganization.address || referencedCustomer?.address || "";
      finalCustContact = organizationPrimaryContact
        ? `${organizationPrimaryContact.fullName || organizationPrimaryContact.name}${organizationPrimaryContact.phone || organizationPrimaryContact.mobilePhone ? ` - ${organizationPrimaryContact.phone || organizationPrimaryContact.mobilePhone}` : ""}`
        : (referencedOrganization.phone || "");
      finalContactId = organizationPrimaryContact?.id || "";
    } else {
      finalCustId = customerIdParam || "";
      finalCustName = referencedCustomer?.displayName || referencedCustomer?.name || "Khách hàng trực tiếp";
      finalCustAddress = referencedCustomer?.address || "";
      finalCustContact = referencedCustomer?.phone || "";
    }

    const buyerRef = currentBuyerRef || referencedDeal?.buyerRef
      || directBuyer?.ref
      || (referencedOrganization ? { type: "ORGANIZATION_ACCOUNT" as const, id: referencedOrganization.id } : resolveBuyerRefFromCustomer(finalCustId));
    if (!buyerRef) {
      setValidationError(locale === "vi" ? "Không thể xác định buyer Contact/Organization Account." : "Could not resolve Contact/Organization Account buyer.");
      setServerFieldIssues([{ target: "quote-buyer", message: locale === "vi" ? "Vui lòng chọn người mua." : "Select a buyer.", binding: fieldBinding("quote-buyer") }]);
      return null;
    }

    const newQuoteId = newQuoteIdentity.id;
    return {
      id: newQuoteId,
      quoteNumber,
      version: 1,
      rootQuoteId: newQuoteId,
      buyerRef,
      sourcePath: referencedDeal ? "DEAL" : "DIRECT_SALE",
      dealId: referencedDeal ? finalDealId : undefined,
      sourceDealId: referencedDeal ? finalDealId : undefined,
      dealName: referencedDeal ? finalDealName : undefined,
      customerId: finalCustId,
      customerName: directBuyer?.label || finalCustName,
      customerAddress: finalCustAddress,
      customerContact: finalCustContact || undefined,
      contactId: finalContactId,
      leadId: finalLeadId,
      leadName: finalLeadName,
      senderName: senderCompanyName,
      senderAddress,
      senderEmail,
      senderTaxId,
      status: QuoteStatus.DRAFT,
      title: quoteTitle,
      currency,
      ownerId: referencedDeal?.ownerId,
      ownerName: resolveWorkspaceMemberLabel(referencedDeal?.ownerId || actorId, locale),
      createdAt: new Date().toISOString(),
      expiryDate: validUntil,
      validUntil,
      taxPercent: adjustments.find((item) => item.type === "TAX" && item.calculation === "PERCENTAGE")?.value ?? taxPercent,
      taxTotal: computedTaxes,
      discountAmountToTotal: computedDiscounts,
      discountTotal: computedDiscounts,
      subtotal: rawSubtotal,
      grandTotal: quoteGrandTotal,
      lineItems: pricedQuoteLines,
      termsAndNotes: quoteNotes,
      notes: quoteNotes,
      adjustments: pricedAdjustments,
      recipientEmail: recipientEmail.trim() || undefined,
      paymentTiming,
      paymentDueDays: paymentTiming === "POSTPAID" ? Math.max(0, paymentDueDays) : 0,
      paymentMethod,
      paymentAgreement,
      deliveryHistory: [],
    };
  };

  const appendDealActivity = (quote: Quote, activityKind: "created" | "updated") => {
    if (!referencedDeal) return;
    // Saving a Quote does not authorize a Deal write. `quote.create` / `quote.update-draft`
    // declare readModelRefreshRequirement ["QUOTE_LIST","QUOTE_DETAIL"] only, so the
    // backend does not record quote activity on the Deal. Connected mode therefore
    // refreshes the Deal from authority rather than inventing a cross-module Deal
    // activity; demo mode keeps its own Deal timeline entry.
    if (isDealConnectedMode()) {
      void invalidateModuleQueries({
        moduleKeys: ["deals"],
        commandType: activityKind === "created" ? "quote.create" : "quote.update-draft",
        aggregateId: referencedDeal.id,
        occurredAt: new Date().toISOString(),
      });
      return;
    }
    const activity: DealActivity = {
      id: createDurableId(`act_${activityKind}`),
      createdAt: new Date().toISOString(),
      author: t("common.system"),
      type: "quote",
      title: activityKind === "created" ? t("deals.activities.quoteCreatedTitle") : t("deals.activities.quoteUpdatedTitle"),
      description: activityKind === "created"
        ? t("deals.activities.quoteCreatedDescription", { quoteNumber: quote.quoteNumber })
        : t("deals.activities.quoteUpdatedDescription", { quoteNumber: quote.quoteNumber }),
      metadata: { quoteId: quote.id, quoteNumber: quote.quoteNumber, quoteStatus: QuoteStatus.DRAFT },
    };
    setDeals((current) => current.map((deal) => deal.id === referencedDeal.id
      ? { ...deal, activities: [activity, ...(deal.activities || [])] }
      : deal));
  };

  const navigateAfterSave = (quote: Quote) => {
    if (referencedDeal) navigate(`/deals/${referencedDeal.id}`);
    else if (quote.customerId) navigate(`/customers/${quote.customerId}`);
    else if (quote.buyerRef.type === "ORGANIZATION_ACCOUNT") navigate(`/organizations/${quote.buyerRef.id}`);
    else navigate("/quotes");
  };

  const persistCurrentQuote = async (shouldNavigate = false, issueDocument = false): Promise<Quote | null> => {
    if (editingQuote?.archivedAt) {
      setValidationKind("STATUS");
      setValidationError(locale === "vi" ? "Không thể sửa Báo giá đã lưu trữ." : "Archived Quotes cannot be edited.");
      return null;
    }
    if (lifecycle.pending) return null;
    const candidate = buildCurrentQuote();
    if (!candidate) return null;
    if (!lifecycle.begin()) return null;
    const intentFingerprint = JSON.stringify({ draft: currentDraftFingerprint, buyer: candidate.buyerRef, sourceDealId: candidate.sourceDealId, expectedVersion: editingQuote?.resourceVersion ?? sourceDealVersion.current });
    if (saveIntent.current?.unresolved && saveIntent.current.fingerprint !== intentFingerprint) {
      setValidationKind("STATUS");
      setValidationError(locale === "vi" ? "Chưa xác định được kết quả lần lưu trước. Giữ nguyên nội dung yêu cầu trước để thử lại hoặc kiểm tra danh sách báo giá trước khi tạo yêu cầu mới." : "The previous save outcome is unknown. Retry its original contents or check the quote list before starting another request.");
      lifecycle.finish();return null;
    }
    if (saveIntent.current?.fingerprint !== intentFingerprint) saveIntent.current = { fingerprint: intentFingerprint, key: connected && !editingQuote ? creationIntent.current : createDurableId("quote-save"), unresolved: false };
    setSaveBusy(true);
    try {
      const wasNew = !editingQuote;
      const metadata = { idempotencyKey: saveIntent.current.key, expectedVersion: editingQuote?.resourceVersion ?? sourceDealVersion.current };
      let saved: Quote;
      if (connected && issueDocument) {
        const result = await saveAndIssueQuoteCommand(candidate, metadata, issuanceCheckpoint.current);
        if (!lifecycle.isCurrent()) return null;
        if (result.stage === "ISSUANCE_PENDING") {
          issuanceCheckpoint.current = result.checkpoint;
          setPersistedDraft(result.checkpoint.quote); openingQuote.current = structuredClone(result.checkpoint.quote);
          setValidationKind("STATUS");
          setValidationError((locale === "vi" ? `Đã lưu ${result.checkpoint.quote.quoteNumber}; PDF chưa phát hành xong. Thử lại cùng báo giá. ` : "The Quote is saved; PDF issuance is incomplete. Retry the same Quote. ") + formatApplicationError(result.error, { locale }));
          return null;
        }
        issuanceCheckpoint.current = undefined;
        saved = result.quote;
      } else saved = (await saveQuoteCommand(candidate, metadata)).data;
      if (!lifecycle.isCurrent()) return null;
      setPersistedDraft(saved);
      openingQuote.current = structuredClone(saved);
      // Keep the accepted identity and version even when saving from the unsaved-work dialog.
      saveIntent.current = null;
      appendDealActivity(saved, wasNew ? "created" : "updated");
      setDraftHydrated(false);
      initializedQuoteSourceRef.current = null;
      setSavedDraftFingerprint(null);
      const pricingDifferences = compareQuotePricing(candidate, saved, getCurrencyMinorUnit(currency));
      const pricingReconciled = pricingDifferences.length > 0;
      const pricingNotice = quotePricingReconciliationNotice(pricingDifferences, currency, locale);
      triggerToast(pricingReconciled ? pricingNotice : (locale === "vi" ? "Đã lưu Báo giá." : "Quote saved."), pricingReconciled ? "info" : "success");
      if (shouldNavigate) setSavedNavigation({ path: `/quotes/${saved.id}${pricingReconciled ? "?pricing=updated" : ""}`, notice: pricingReconciled ? pricingNotice : undefined });
      return saved;
    } catch (error) {
      if (lifecycle.isCurrent()) {
        const normalized = normalizeApplicationError(error);
        const issues = quoteBuilderSubmissionIssues(normalized, quoteLines, locale === "vi");
        setValidationKind(issues.length ? "FIELD" : "STATUS");
        setValidationError(issues.length ? (locale === "vi" ? "Kiểm tra các mục dưới đây rồi lưu lại báo giá." : "Review the items below, then save the quote again.") : formatApplicationError(error, { locale }));
        setServerFieldIssues(issues.map(issue => ({ ...issue, binding: fieldBinding(issue.target), ...(issue.target === "quote-buyer" && buyerInfo.version !== undefined ? { buyerVersion: buyerInfo.version } : {}) })));
        setValidationAttempt(value => value + 1);
        const requestValidation = normalized.code === "CONTRACT_VIOLATION" && normalized.details && typeof normalized.details === "object" && "direction" in normalized.details && normalized.details.direction === "request";
        if (saveIntent.current) saveIntent.current.unresolved = !(requestValidation || normalized.status === 422 || normalized.status === 401 || normalized.status === 403 || normalized.status === 412);
      }
      return null;
    } finally {
      setSaveBusy(false);
      lifecycle.finish();
    }
  };

  saveHandlerRef.current = async () => Boolean(await persistCurrentQuote(false, connected));

  const handleSaveQuote = async () => {
    await persistCurrentQuote(true, connected);
  };
  const handleSaveDraft = async () => { await persistCurrentQuote(true, false); };

  const getPdfSourceElement = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-quote-pdf-source="true"]');

  const createCurrentQuotePdf = async () => {
    const source = getPdfSourceElement();
    if (!source) throw new Error(locale === "vi" ? "Không tìm thấy bản xem trước để xuất PDF." : "Quote preview is unavailable.");
    return createQuotePdfFromElement(source, `${quoteNumber}.pdf`);
  };

  const handleExportPdf = async () => {
    if (!validateCurrentDraft()) return;
    setExportBusy(true);
    try {
      const result = await createCurrentQuotePdf();
      downloadQuotePdf(result);
      triggerToast(locale === "vi" ? `Đã xuất ${result.fileName}.` : `Exported ${result.fileName}.`, "success");
    } catch (error) {
      triggerToast(formatApplicationError(error, { locale }), "error");
    } finally {
      setExportBusy(false);
    }
  };

  const handleSendGmail = async () => {
    if (connected && hasUnsavedChanges) {
      triggerToast(locale === "vi" ? "Lưu thay đổi trước khi gửi báo giá." : "Save changes before sending the Quote.", "error");
      return;
    }
    // Opening an external compose window must not rewrite the approved commercial snapshot.
    const saved = connected ? editingQuote : await persistCurrentQuote(false);
    if (!saved) return;
    const email = recipientEmail.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setValidationError(locale === "vi" ? "Cần email người nhận hợp lệ để gửi qua Gmail." : "A valid recipient email is required for Gmail delivery.");
      return;
    }

    setSendBusy(true);
    try {
      const pdf = await createCurrentQuotePdf();
      const mode = await launchQuoteGmailDelivery({
        recipientEmail: email,
        subject: `${saved.quoteNumber} - ${saved.title}`,
        body: locale === "vi"
          ? `Kính gửi Quý khách,\n\nVui lòng xem Báo giá ${saved.quoteNumber} đính kèm. Báo giá có hiệu lực đến ${saved.validUntil || saved.expiryDate || "theo tài liệu"}.\n\nTrân trọng,\n${saved.senderName || senderCompanyName}`
          : `Hello,\n\nPlease review attached Quote ${saved.quoteNumber}. It is valid until ${saved.validUntil || saved.expiryDate || "the date shown in the document"}.\n\nRegards,\n${saved.senderName || senderCompanyName}`,
        pdf,
      });
      setDeliveryConfirmation({
        quoteId: saved.id,
        expectedVersion: saved.resourceVersion,
        channel: "GMAIL",
        recipientEmail: email,
        fileName: pdf.fileName,
        channelLocked: true,
      });
      triggerToast(
        mode === "SHARED_WITH_ATTACHMENT"
          ? (locale === "vi" ? "Đã mở luồng chia sẻ với PDF đính kèm. Sau khi gửi qua Gmail, xác nhận lại trong CRM." : "Opened file sharing with the PDF attached. Confirm in CRM after sending with Gmail.")
          : (locale === "vi" ? "Đã mở Gmail và tải PDF. Đính kèm file, gửi email rồi xác nhận lại trong CRM." : "Opened Gmail and downloaded the PDF. Attach it, send the email, then confirm in CRM."),
        "success",
      );
    } catch (error) {
      triggerToast(formatApplicationError(error, { locale }), "error");
    } finally {
      setSendBusy(false);
    }
  };

  const handleOpenDeliveryConfirmation = async () => {
    const saved = await persistCurrentQuote(false);
    if (!saved) return;
    setDeliveryConfirmation({
      quoteId: saved.id,
        expectedVersion: saved.resourceVersion,
      channel: "ZALO",
      recipient: referencedDeal?.contactName || saved.customerContact || saved.customerName || "",
    });
  };

  const confirmQuoteSent = async (value: QuoteDeliveryConfirmationValue, deferClose = false, deliveryId = createDurableId("quote_delivery")): Promise<boolean> => {
    if (!deliveryConfirmation) return false;
    if (!(await saveQuoteDeliveryEvidence(deliveryConfirmation.quoteId, deliveryConfirmation.expectedVersion, value, deliveryId, actorId))) return false;
    if (!deferClose) setDeliveryConfirmation(null);
    triggerToast(locale === "vi" ? "Đã xác nhận Báo giá được gửi và lưu bằng chứng kênh liên hệ." : "Quote delivery was confirmed with channel evidence.", "success");
    if (!deferClose) navigate(`/quotes/${deliveryConfirmation.quoteId}`);
    return true;
  };

  useEffect(() => {
    if ((connected && publishAction !== "pdf" && publishAction !== "gmail") || !publishAction || !editingQuote || initializedQuoteSourceRef.current !== quoteSourceInitializationKey) return;
    if (!quoteTitle.trim() || quoteLines.length === 0) return;
    const key = `${editingQuote.id}:${publishAction}`;
    if (autoPublishActionRef.current === key) return;
    autoPublishActionRef.current = key;
    const frame = window.requestAnimationFrame(() => {
      if (publishAction === "pdf") void handleExportPdf();
      if (publishAction === "gmail") void handleSendGmail();
      if (publishAction === "confirm") handleOpenDeliveryConfirmation();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [publishAction, editingQuote?.id, quoteSourceInitializationKey, quoteTitle, quoteLines.length]);
  return {
    connected, workspaceConfigurationResource, detailQuery, sourceDealQuery, directBuyer, setDirectBuyer, sourceBuyer,
    formPending: lifecycle.pending,
    crmConfig,
    customers,
    allocateAgreementLineId,
    legacyAgreementDraftLine,
    draftLinesFromAgreement,
    buildPaymentAgreementSnapshot,
    resolveBuyerRefFromCustomer,
    navigate,
    t,
    locale,
    operationGuide,
    session,
    actorId,
    quotes,
    deals,
    products,
    paymentMethods,
    currency,
    setCurrency: (next: string) => {
      if (next === currency) return;
      if (editingQuote || quoteLines.length > 0 || adjustments.length > 0) {
        triggerToast(locale === "vi" ? "Không thể đổi tiền tệ khi đã có số tiền. Hãy tạo báo giá mới với sản phẩm cùng tiền tệ; hiện chưa hỗ trợ quy đổi." : "Currency cannot change while amounts exist. Create a Quote with matching-currency products; conversion is unavailable.", "info"); return;
      }
      setCurrency(next);
    },
    setDeals,
    quoteId,
    searchParams,
    dealIdParam,
    quoteIdParam,
    customerIdParam,
    publishAction,
    editingQuote,
    referencedCustomer,
    selectedDealId,
    setSelectedDealId,
    referencedDeal,
    quoteSourceInitializationKey,
    initializedQuoteSourceRef,
    autoPublishActionRef,
    saveHandlerRef,
    isDealLocked,
    newQuoteIdentity,
    quoteNumber,
    quoteTitle,
    setQuoteTitle,
    quoteLines,
    setQuoteLines,
    adjustments,
    setAdjustments,
    taxPercent,
    setTaxPercent,
    discountAmount,
    setDiscountAmount,
    quoteNotes,
    setQuoteNotes,
    recipientEmail,
    setRecipientEmail,
    paymentTiming,
    setPaymentTiming,
    paymentDueDays,
    setPaymentDueDays,
    paymentMethod,
    setPaymentMethod,
    paymentAgreementLines,
    setPaymentAgreementLines,
    exportBusy,
    setExportBusy,
    sendBusy,
    setSendBusy,
    deliveryConfirmation,
    setDeliveryConfirmation,
    validUntil,
    setValidUntil,
    isProductPickerOpen,
    suggestedProductId, setSuggestedProductId,
    setIsProductPickerOpen,
    toastMessage,
    setToastMessage,
    toastType,
    setToastType,
    validationError,
    validationAttempt,
    validationKind,
    fieldBinding,
    fieldIssueCurrent,
    buyerInfo,
    buyerSourcePath,
    currentBuyerRef,
    serverFieldIssues,
    setValidationError,
    saveBusy,
    setSaveBusy,
    titleInputRef,
    firstLineActionRef,
    savedDraftFingerprint,
    setSavedDraftFingerprint,
    draftHydrated,
    setDraftHydrated,
    triggerToast,
    isClosedDeal,
    getDealStageLabel,
    handleUpdateLineField,
    handleAddLineItem,
    handleRemoveLineItem,
    pricedQuoteLines,
    rawSubtotal,
    computedDiscounts,
    computedFees,
    computedTaxes,
    quoteGrandTotal,
    pricedAdjustments,
    paymentAgreement,
    paymentAgreementReadOnly,
    paymentAgreementPercent,
    currentDraftFingerprint,
    hasUnsavedChanges,
    validateCurrentDraft,
    buildCurrentQuote,
    appendDealActivity,
    navigateAfterSave,
    persistCurrentQuote,
    handleSaveQuote,
    handleSaveDraft,
    getPdfSourceElement,
    createCurrentQuotePdf,
    handleExportPdf,
    handleSendGmail,
    handleOpenDeliveryConfirmation,
    confirmQuoteSent,
  };
}
