import { formatApplicationError } from "@/shared/operations";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, FileText, Landmark, Mail, MessageCircle, Percent, Plus, PlusCircle, Save, ShieldCheck, ShoppingBag, Trash2 } from "lucide-react";
import type { CustomerDisplay as Customer } from "@/modules/customers";
import { getQuoteDocumentLabel, type CrmWorkspaceConfig } from "@/platform/workspace-config";
import { DealStage, updateDeals, type Deal, type DealActivity } from "@/modules/deals";
import { validateQuoteDraft } from "../../application/queries/quoteDraftValidation";
import { QuoteApprovalStatus, QuoteStatus, SalesDocumentAdjustmentType, type Quote, type QuoteDeliveryChannel, type QuoteLineItem, type QuotePaymentMethod, type QuotePaymentTiming, type SalesDocumentAdjustment } from "../../domain/model/quote.types";
import { applyQuoteApprovalAssessment, canQuoteBeSent, DEFAULT_QUOTE_APPROVAL_POLICY, evaluateQuoteApproval } from "../../domain/rules/quoteApprovalPolicy";
import { normalizeQuoteLineItem } from "../../domain/rules/quoteCalculations";
import { getQuoteConversionIssues } from "../../domain/rules/quoteConversion";
import { calculateQuoteDraftTotals } from "../../domain/rules/quoteDraftPricing";
import { isQuoteVersionImmutable, quoteContentFingerprint } from "../../domain/rules/quoteVersioning";
import { allocateQuoteIdentitySnapshot, createQuoteRevisionCommand, recordQuoteDeliveryCommand, requestQuoteApprovalCommand, saveQuoteCommand } from "../../public/quotes";

import { useQuotes } from "../hooks/useQuotes";
import { useDeals } from "../hooks/useDeals";
import { DEFAULT_CRM_WORKSPACE_CONFIG } from "@/platform/workspace-config/workspaceConfigDefaults";
import { useI18n } from "@/i18n";
import { Input, SearchableSelect, Select, Textarea, Button, Badge, PageHeader, SectionHeader, getQuoteStatusBadgeVariant, Table, TableHeader, TableBody, TableRow, TableCell } from "@/shared/components/ui";
import { getProductCatalogSnapshot } from "@/modules/products";
import { findCustomerByRelationshipRefSnapshot, getCustomerSnapshot } from "@/modules/customers";
import { getContactSnapshot } from "@/modules/contacts";
import { getOrganizationAccountSnapshot } from "@/modules/organizations";
import { QuoteBuilderPreview } from "../components/QuoteBuilderPreview";
import { QuoteBuilderProductPicker } from "../components/QuoteBuilderProductPicker";
import { QuoteDeliveryConfirmationModal, type QuoteDeliveryConfirmationValue } from "../components/QuoteDeliveryConfirmationModal";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import { getInvoiceSellerInformation, subscribeToInvoiceConfiguration } from "@/modules/invoices";
import { useSubscribableSnapshot } from "@/platform/react";
import { createQuotePdfFromElement, downloadQuotePdf } from "../services/quotePdfExport";
import { launchQuoteGmailDelivery } from "../services/quoteGmailDelivery";
import { usePlatformState } from "@/platform/application-state";
import { resolveWorkspaceMemberLabel } from "@/platform/member-directory";
import { registerUnsavedWork } from "@/platform/unsaved-work";
import { getPaymentMethodCatalogSnapshot } from "@/modules/payments";
import { formatMoneyDto, money } from "@/shared/money";
import { createDurableId } from "@/shared/ids";
import { OperationGuideButton } from "@/components/crm/OperationGuide";
import { canonicalPaymentMethodCodeForKind, canonicalPaymentMethodKindForCode, isCanonicalCodMethodCode, type PaymentAgreementLineSnapshot, type PaymentAgreementSnapshot, type PaymentFulfillmentGate, type PaymentPurpose } from "@/shared/order-to-cash";

interface PaymentAgreementDraftLine {
  id: string;
  label: string;
  purpose: PaymentPurpose;
  amountMode: "PERCENTAGE" | "REMAINDER";
  percentage: number;
  timing: QuotePaymentTiming;
  dueDays: number;
  methodCode: string;
  fulfillmentGate: PaymentFulfillmentGate;
}

function allocateAgreementLineId(): string {
  return createDurableId("payment-term");
}

function legacyAgreementDraftLine(input?: Pick<Quote, "paymentTiming" | "paymentDueDays" | "paymentMethod">): PaymentAgreementDraftLine {
  const timing = input?.paymentTiming ?? "PREPAID";
  const methodKind = input?.paymentMethod ?? "BANK_TRANSFER";
  const methodCode = canonicalPaymentMethodCodeForKind(methodKind);
  return {
    id: allocateAgreementLineId(),
    label: "Thanh toán toàn bộ",
    purpose: "FULL",
    amountMode: "REMAINDER",
    percentage: 100,
    timing,
    dueDays: input?.paymentDueDays ?? 0,
    methodCode,
    fulfillmentGate: methodKind === "COD" ? "NONE" : timing === "PREPAID" ? "BEFORE_COMPLETION" : "NONE",
  };
}

function draftLinesFromAgreement(quote?: Quote): PaymentAgreementDraftLine[] {
  if (!quote?.paymentAgreement?.lines.length) return [legacyAgreementDraftLine(quote)];
  return quote.paymentAgreement.lines.map((line) => ({
    id: line.id,
    label: line.label,
    purpose: line.purpose,
    amountMode: line.amountRule.type === "REMAINDER" ? "REMAINDER" : "PERCENTAGE",
    percentage: line.amountRule.type === "PERCENTAGE" ? Number(line.amountRule.percentage) : 0,
    timing: line.dueRule.type === "EVENT_RELATIVE" && line.dueRule.event === "DELIVERY_CONFIRMED"
      ? "ON_DELIVERY"
      : line.dueRule.type === "EVENT_RELATIVE" && line.dueRule.offsetDays > 0
        ? "POSTPAID"
        : line.dueRule.type === "MILESTONE"
          ? "CUSTOM"
          : "PREPAID",
    dueDays: line.dueRule.type === "EVENT_RELATIVE" ? Math.max(0, line.dueRule.offsetDays) : 0,
    methodCode: line.preferredMethodCode ?? line.allowedMethodCodes[0] ?? canonicalPaymentMethodCodeForKind("BANK_TRANSFER"),
    fulfillmentGate: line.fulfillmentGate,
  }));
}

function buildPaymentAgreementSnapshot(
  draftLines: readonly PaymentAgreementDraftLine[],
  total: number,
  currency: string,
  sourceQuoteId?: string,
): PaymentAgreementSnapshot {
  let allocated = 0;
  const lines: PaymentAgreementLineSnapshot[] = draftLines.map((line, index) => {
    const isRemainder = line.amountMode === "REMAINDER" || index === draftLines.length - 1;
    const preview = isRemainder ? Math.max(0, total - allocated) : Math.max(0, total * Math.max(0, line.percentage) / 100);
    allocated += preview;
    const dueRule = line.timing === "ON_DELIVERY"
      ? { type: "EVENT_RELATIVE" as const, event: "DELIVERY_CONFIRMED" as const, offsetDays: 0, dayBasis: "CALENDAR" as const }
      : line.timing === "POSTPAID"
        ? { type: "EVENT_RELATIVE" as const, event: "INVOICE_ISSUED" as const, offsetDays: Math.max(0, line.dueDays), dayBasis: "CALENDAR" as const }
        : line.timing === "CUSTOM"
          ? { type: "MILESTONE" as const, milestoneCode: `PAYMENT_${index + 1}`, offsetDays: Math.max(0, line.dueDays) }
          : { type: "EVENT_RELATIVE" as const, event: "ORDER_CONFIRMED" as const, offsetDays: 0, dayBasis: "CALENDAR" as const };
    return {
      id: line.id,
      sequence: index + 1,
      label: line.label.trim() || `Đợt ${index + 1}`,
      purpose: line.purpose,
      amountRule: isRemainder
        ? { type: "REMAINDER" as const }
        : { type: "PERCENTAGE" as const, percentage: String(Math.max(0, line.percentage)) },
      previewAmount: money(String(preview), currency),
      dueRule,
      allowedMethodCodes: [line.methodCode],
      preferredMethodCode: line.methodCode,
      fulfillmentGate: isCanonicalCodMethodCode(line.methodCode) ? "NONE" : line.fulfillmentGate,
      invoicePolicyCode: line.purpose === "DEPOSIT" ? "DEPOSIT_INVOICE_ALLOWED" : "STANDARD_ORDER_INVOICE",
    };
  });
  const kind = lines.length === 1 ? "FULL_PAYMENT" : lines.some((line) => line.purpose === "DEPOSIT") ? "DEPOSIT_AND_BALANCE" : "INSTALLMENT";
  return { version: 1, kind, currency, lines, sourceQuoteId, policyVersion: "quote-payment-agreement/v1" };
}

export interface QuoteBuilderPageProps {
  crmConfig?: CrmWorkspaceConfig;
  customers: Customer[];
}

interface PendingQuoteDelivery {
  quoteId: string;
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
  const workspaceConfiguration = useWorkspaceOperationalConfiguration();
  const invoiceConfiguration = useSubscribableSnapshot(getInvoiceSellerInformation, subscribeToInvoiceConfiguration);
  const invoiceAddress = workspaceConfiguration.addresses.find((address) => address.id === invoiceConfiguration.invoiceAddressId);
  const senderCompanyName = invoiceConfiguration.sellerName || workspaceConfiguration.businessInformation.legalName || workspaceConfiguration.businessInformation.displayName;
  const senderAddress = invoiceAddress?.addressLine1 || "";
  const senderEmail = invoiceConfiguration.email || workspaceConfiguration.businessInformation.billingEmail || workspaceConfiguration.businessInformation.email;
  const senderTaxId = invoiceConfiguration.taxId || workspaceConfiguration.businessInformation.taxId;
  const operationGuide = {
    title: locale === "vi" ? "Hướng dẫn tạo Báo giá" : "Quotation creation guide",
    steps: locale === "vi" ? [
      "Kiểm tra cơ hội hoặc khách hàng liên kết trước khi nhập nội dung.",
      "Thêm hàng hóa/dịch vụ, số lượng, đơn giá, chiết khấu và thuế.",
      "Thiết lập điều khoản thanh toán và kiểm tra yêu cầu phê duyệt.",
      "Lưu nháp hoặc gửi duyệt. Chỉ gửi khách khi nội dung đã sẵn sàng.",
      "Dùng Xem trước để kiểm tra bố cục trước khi xuất PDF.",
    ] : [
      "Review the linked deal or customer before entering the quotation.",
      "Add products/services, quantities, prices, discounts, and tax.",
      "Configure payment terms and review approval requirements.",
      "Save a draft or request approval. Send only when the content is ready.",
      "Use Preview to verify the document before PDF export.",
    ],
    tips: locale === "vi" ? [
      "Nút hành động cố định ở cuối trang là nơi duy nhất để lưu, duyệt và xuất PDF.",
      "Phần tài liệu chỉ dùng để xem trước, không lặp lại hành động gửi hoặc xuất.",
    ] : [
      "The sticky action bar is the single place for save, approval, and PDF actions.",
      "The document card is preview-only and does not duplicate delivery actions.",
    ],
  } as const;
  const { session } = usePlatformState();
  const actorId = session.principal.accountId;
  const { quotes } = useQuotes();
  const { deals } = useDeals();
  const products = getProductCatalogSnapshot();
  const setDeals: React.Dispatch<React.SetStateAction<Deal[]>> = (updater) => { updateDeals(updater); };
  const { quoteId } = useParams();
  const [searchParams] = useSearchParams();
  const dealIdParam = searchParams.get("dealId");
  const quoteIdParam = quoteId || searchParams.get("quoteId");
  const customerIdParam = searchParams.get("customerId");
  const organizationIdParam = searchParams.get("organizationId");
  const publishAction = searchParams.get("action");

  const editingQuote = quotes.find(q => q.id === quoteIdParam);
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
    return deals[0]?.id || "";
  });
  
  // Find referenced deal
  const referencedDeal = selectedDealId ? (deals.find(d => d.id === selectedDealId) || null) : null;
  const quoteSourceInitializationKey = editingQuote
    ? `edit:${editingQuote.id}`
    : selectedDealId
      ? `deal:${selectedDealId}`
      : `direct:${organizationIdParam ? `organization:${organizationIdParam}` : customerIdParam || referencedCustomer?.id || "none"}`;
  const initializedQuoteSourceRef = useRef<string | null>(null);
  const autoPublishActionRef = useRef<string | null>(null);
  const saveHandlerRef = useRef<() => Promise<boolean>>(async () => false);

  // Locked Deal flag - if dealIdParam exists or we are currently editing an existing quote, lock it
  const isDealLocked = !!dealIdParam || !!editingQuote || !!customerIdParam || !!organizationIdParam;

  // Identity allocation belongs to the Quote application boundary, not collection length or component time.
  const [newQuoteIdentity] = useState(() => allocateQuoteIdentitySnapshot());
  const quoteNumber = editingQuote?.quoteNumber ?? newQuoteIdentity.quoteNumber;

  // Dynamic Quote fields
  const [quoteTitle, setQuoteTitle] = useState("");
  const [currency, setCurrency] = useState(() => editingQuote?.currency || referencedDeal?.currency || workspaceConfiguration.localeRegion.currencies.baseCurrency);
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "info" | "error">("info");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | undefined>();
  const [saveBusy, setSaveBusy] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const firstLineActionRef = useRef<HTMLSpanElement>(null);
  const [savedDraftFingerprint, setSavedDraftFingerprint] = useState<string | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const validationSummaryRef = useRef<HTMLDivElement>(null);

  const triggerToast = (msg: string, type: "success" | "info" | "error" = "info") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Check if deal stage is WON or LOST (terminal stages)
  const isClosedDeal = referencedDeal && (referencedDeal.stage === DealStage.WON || referencedDeal.stage === DealStage.LOST);

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
    if (quoteIdParam && !editingQuote) return;
    if (selectedDealId && !referencedDeal) return;
    if (customerIdParam && !referencedCustomer) return;
    if (organizationIdParam && !referencedOrganization) return;

    if (editingQuote) {
      setSelectedDealId(editingQuote.dealId || "");
      setQuoteTitle(editingQuote.title);
      setCurrency(editingQuote.currency || workspaceConfiguration.localeRegion.currencies.baseCurrency);
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
      setRecipientEmail(editingQuote.recipientEmail || referencedDeal?.contactEmail || referencedCustomer?.email || "");
      setPaymentTiming(editingQuote.paymentTiming ?? "PREPAID");
      setPaymentDueDays(editingQuote.paymentDueDays ?? 0);
      setPaymentMethod(editingQuote.paymentMethod ?? "BANK_TRANSFER");
      setPaymentAgreementLines(draftLinesFromAgreement(editingQuote));
      if (editingQuote.validUntil) {
        setValidUntil(editingQuote.validUntil);
      }
    } else if (referencedDeal) {
      setQuoteTitle(t("quoteBuilder.defaultTitle", { deal: referencedDeal.name }));
      setCurrency(referencedDeal.currency || workspaceConfiguration.localeRegion.currencies.baseCurrency);
      const initialLines: QuoteLineItem[] = (referencedDeal.lineItems || []).map(item => normalizeQuoteLineItem({
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
      setRecipientEmail(referencedDeal.contactEmail || "");
      setPaymentTiming("PREPAID");
      setPaymentDueDays(0);
      setPaymentMethod("BANK_TRANSFER");
      setPaymentAgreementLines([legacyAgreementDraftLine()]);
      setQuoteNotes(t("quoteBuilder.terms.default", "Điều khoản thanh toán: 100% sau khi ký hợp đồng."));
    } else {
      // Direct Quote mode
      const custName = referencedOrganization?.displayName || referencedCustomer?.displayName || referencedCustomer?.name || "Khách hàng";
      setQuoteTitle(locale === "vi"
        ? `Báo giá cho ${custName}`
        : `Quote for ${custName}`
      );
      setCurrency(workspaceConfiguration.localeRegion.currencies.baseCurrency);
      setQuoteLines([]);
      setRecipientEmail(
        organizationPrimaryContact?.workEmail
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
  }, [quoteSourceInitializationKey, quoteIdParam, customerIdParam, organizationIdParam, selectedDealId, referencedDeal, editingQuote, t, locale, referencedCustomer, referencedOrganization, organizationPrimaryContact]);

  // Handle value modifications inside table
  const handleUpdateLineField = (id: string, field: keyof QuoteLineItem, value: any) => {
    setQuoteLines((previous) => previous.map((item) => item.id === id
      ? normalizeQuoteLineItem({ ...item, [field]: value })
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
  } = calculateQuoteDraftTotals(quoteLines, adjustments);

  const paymentAgreement = useMemo(() => buildPaymentAgreementSnapshot(
    paymentAgreementLines,
    quoteGrandTotal,
    currency,
    editingQuote?.id ?? newQuoteIdentity.id,
  ), [currency, editingQuote?.id, newQuoteIdentity.id, paymentAgreementLines, quoteGrandTotal]);
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
  }), [currency, paymentAgreement, paymentDueDays, paymentMethod, paymentTiming, pricedAdjustments, pricedQuoteLines, quoteNotes, quoteTitle, recipientEmail, validUntil]);

  useEffect(() => {
    if (draftHydrated && savedDraftFingerprint === null) setSavedDraftFingerprint(currentDraftFingerprint);
  }, [currentDraftFingerprint, draftHydrated, savedDraftFingerprint]);

  const hasUnsavedChanges = draftHydrated && savedDraftFingerprint !== null && savedDraftFingerprint !== currentDraftFingerprint;

  useEffect(() => registerUnsavedWork({
    id: `quote-builder:${editingQuote?.id ?? newQuoteIdentity.id}`,
    title: locale === "vi" ? "Báo giá chưa lưu" : "Unsaved Quote",
    isDirty: hasUnsavedChanges,
    save: () => saveHandlerRef.current(),
    discard: () => setSavedDraftFingerprint(currentDraftFingerprint),
  }), [currentDraftFingerprint, editingQuote?.id, hasUnsavedChanges, locale, newQuoteIdentity.id]);

  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [hasUnsavedChanges]);

  const approvalPolicy = crmConfig.moduleSettings?.quotes?.approval ?? DEFAULT_QUOTE_APPROVAL_POLICY;
  const approvalAssessment = useMemo(() => evaluateQuoteApproval({
    lineItems: pricedQuoteLines,
    subtotal: rawSubtotal,
    discountTotal: computedDiscounts,
    grandTotal: quoteGrandTotal,
    paymentTiming,
    paymentDueDays,
  }, approvalPolicy), [pricedQuoteLines, rawSubtotal, computedDiscounts, quoteGrandTotal, paymentTiming, paymentDueDays, approvalPolicy]);

  const approvalIsCurrent = useMemo(() => {
    if (!editingQuote || editingQuote.approvalStatus !== QuoteApprovalStatus.APPROVED || !editingQuote.approvalContentFingerprint) return false;
    const fingerprint = quoteContentFingerprint({
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
    });
    return fingerprint === editingQuote.approvalContentFingerprint;
  }, [currency, editingQuote, quoteTitle, pricedQuoteLines, rawSubtotal, computedDiscounts, taxPercent, computedTaxes, quoteGrandTotal, quoteNotes, validUntil, pricedAdjustments, recipientEmail, paymentTiming, paymentDueDays, paymentMethod, paymentAgreement]);
  const approvalPending = Boolean(editingQuote?.approvalRequired && editingQuote.approvalStatus === QuoteApprovalStatus.PENDING && editingQuote.approvalRequestedAt && approvalIsCurrent === false);
  const mustRequestApproval = approvalAssessment.required && !approvalIsCurrent;

  // Execute Quote saving
  const validateCurrentDraft = (): boolean => {
    setValidationError(null);
    setTitleError(undefined);
    const validation = validateQuoteDraft(quoteTitle, pricedQuoteLines, {
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
      if (!quoteTitle.trim()) {
        setTitleError(validation);
        window.requestAnimationFrame(() => titleInputRef.current?.focus());
      } else if (pricedQuoteLines.length === 0) {
        window.requestAnimationFrame(() => firstLineActionRef.current?.focus());
      } else {
        window.requestAnimationFrame(() => (document.querySelector<HTMLElement>('[data-quote-line-invalid="true"]') ?? validationSummaryRef.current)?.focus());
      }
      return false;
    }
    if (paymentAgreementLines.length === 0 || paymentAgreement.lines.some((line) => Number(line.previewAmount.amount) <= 0)) {
      setValidationError(locale === "vi" ? "Thỏa thuận thanh toán phải có ít nhất một đợt với số tiền hợp lệ." : "Payment Agreement requires at least one positive line.");
      return false;
    }
    if (paymentAgreementPercent > 100.000001) {
      setValidationError(locale === "vi" ? "Tổng tỷ lệ các đợt thanh toán không được vượt 100%." : "Payment Agreement percentages cannot exceed 100%.");
      return false;
    }
    return true;
  };

  const buildCurrentQuote = (): Quote | null => {
    if (!validateCurrentDraft()) return null;

    if (editingQuote) {
      return applyQuoteApprovalAssessment({
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
      }, approvalPolicy);
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

    const buyerRef = referencedDeal?.buyerRef
      || (referencedOrganization ? { type: "ORGANIZATION_ACCOUNT" as const, id: referencedOrganization.id } : resolveBuyerRefFromCustomer(finalCustId));
    if (!buyerRef) {
      setValidationError(locale === "vi" ? "Không thể xác định buyer Contact/Organization Account." : "Could not resolve Contact/Organization Account buyer.");
      return null;
    }

    const newQuoteId = newQuoteIdentity.id;
    return applyQuoteApprovalAssessment({
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
      customerName: finalCustName,
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
      ownerId: referencedDeal?.ownerId || actorId,
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
    }, approvalPolicy);
  };

  const appendDealActivity = (quote: Quote, activityKind: "created" | "updated") => {
    if (!referencedDeal) return;
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

  const persistCurrentQuote = async (shouldNavigate = false): Promise<Quote | null> => {
    if (saveBusy) return null;
    const candidate = buildCurrentQuote();
    if (!candidate) return null;
    setSaveBusy(true);
    try {
      const wasNew = !editingQuote;
      const saved = (await saveQuoteCommand(candidate)).data;
      appendDealActivity(saved, wasNew ? "created" : "updated");
      setSavedDraftFingerprint(currentDraftFingerprint);
      triggerToast(locale === "vi" ? "Đã lưu Báo giá." : "Quote saved.", "success");
      if (shouldNavigate) window.setTimeout(() => navigateAfterSave(saved), 0);
      return saved;
    } catch (error) {
      setValidationError(locale === "vi" ? "Không thể lưu Báo giá. Dữ liệu đang nhập vẫn được giữ." : "The Quote could not be saved. Your entered data is still available.");
      return null;
    } finally {
      setSaveBusy(false);
    }
  };

  saveHandlerRef.current = async () => Boolean(await persistCurrentQuote(false));

  const handleSaveQuote = async () => {
    await persistCurrentQuote(true);
  };

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

  const handleRequestApproval = async () => {
    const saved = await persistCurrentQuote(false);
    if (!saved) return;
    if (!saved.approvalRequired) {
      triggerToast(locale === "vi" ? "Báo giá này không cần phê duyệt và có thể gửi thẳng." : "This Quote does not require approval and can be sent directly.", "info");
      return;
    }
    try {
      await requestQuoteApprovalCommand(saved.id, { actorId });
      triggerToast(locale === "vi" ? "Đã gửi yêu cầu phê duyệt Báo giá." : "Quote approval requested.", "success");
    } catch (error) {
      triggerToast(formatApplicationError(error, { locale }), "error");
    }
  };

  const handleSendGmail = async () => {
    const saved = await persistCurrentQuote(false);
    if (!saved) return;
    if (!canQuoteBeSent(saved)) {
      triggerToast(locale === "vi" ? "Báo giá đang cần phê duyệt. Hãy hoàn tất phê duyệt trước khi gửi khách." : "Approval is required before this Quote can be sent.", "error");
      return;
    }
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
    if (!canQuoteBeSent(saved)) {
      triggerToast(locale === "vi" ? "Báo giá đang cần phê duyệt trước khi xác nhận gửi." : "Approval is required before confirming delivery.", "error");
      return;
    }
    setDeliveryConfirmation({
      quoteId: saved.id,
      channel: "ZALO",
      recipient: referencedDeal?.contactName || saved.customerContact || saved.customerName || "",
    });
  };

  const confirmQuoteSent = async (value: QuoteDeliveryConfirmationValue) => {
    if (!deliveryConfirmation) return;
    const updated = (await recordQuoteDeliveryCommand(deliveryConfirmation.quoteId, {
      id: createDurableId("quote_delivery"),
      ...value,
      evidenceType: "USER_CONFIRMED_SENT",
      sentBy: actorId,
    })).data;
    setDeliveryConfirmation(null);
    triggerToast(locale === "vi" ? "Đã xác nhận Báo giá được gửi và lưu bằng chứng kênh liên hệ." : "Quote delivery was confirmed with channel evidence.", "success");
    navigate(`/quotes/${updated.id}`);
  };

  useEffect(() => {
    if (!publishAction || !editingQuote || initializedQuoteSourceRef.current !== quoteSourceInitializationKey) return;
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
    setCurrency,
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
    setIsProductPickerOpen,
    toastMessage,
    setToastMessage,
    toastType,
    setToastType,
    validationError,
    setValidationError,
    titleError,
    setTitleError,
    saveBusy,
    setSaveBusy,
    titleInputRef,
    firstLineActionRef,
    savedDraftFingerprint,
    setSavedDraftFingerprint,
    draftHydrated,
    setDraftHydrated,
    validationSummaryRef,
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
    paymentAgreementPercent,
    currentDraftFingerprint,
    hasUnsavedChanges,
    approvalPolicy,
    approvalAssessment,
    approvalIsCurrent,
    approvalPending,
    mustRequestApproval,
    validateCurrentDraft,
    buildCurrentQuote,
    appendDealActivity,
    navigateAfterSave,
    persistCurrentQuote,
    handleSaveQuote,
    getPdfSourceElement,
    createCurrentQuotePdf,
    handleExportPdf,
    handleRequestApproval,
    handleSendGmail,
    handleOpenDeliveryConfirmation,
    confirmQuoteSent,
  };
}
