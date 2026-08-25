import { backendUnavailableMessage, formatApplicationError } from "@/shared/operations";
import { useAuthoritativeResource } from "@/shared/operations";
import React from "react";
import {
  Banknote,
  CalendarClock,
  CircleDollarSign,
  CreditCard,
  ExternalLink,
  FileText,
  Landmark,
  Link2,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  WalletCards,
  XCircle,
} from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toWorkspacePath } from "@/platform/navigation";
import { notifyProduct, requestConfirmation } from "@/components/feedback/ProductDialogService";
import { PageHeaderActions } from "@/components/crm/PageHeaderActions";
import {
  ListDataTable,
  ListPageFrame,
  ListPageHeader,
  ListPaginationBar,
  ListRecordIdentity,
  ListStatePanel,
  ListTableBody,
  ListTableCell,
  ListTableHead,
  ListTableHeaderCell,
  ListTableRow,
  ListTableSurface,
  ListToolbar,
  useListPagination,
} from "@/components/crm/list-archetype";
import { OperationSavedViews } from "@/components/crm/operations";
import { Badge, Button, Card, Input, Modal, SearchableSelect, Select } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import { getInvoiceWorkspaceResource, getReceivablesWorkspaceResource } from "@/modules/invoices";
import { getOrderListSnapshot, subscribeToOrderList } from "@/modules/orders";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { useSubscribableSnapshot } from "@/platform/react";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import { addMoney, compareMoney, formatMoneyDto, money, subtractMoney, sumMoney, type MoneyDto } from "@/shared/money";
import { PaymentRequestComposer } from "../components/PaymentRequestComposer";
import {
  cancelPaymentIntentCanonical,
  createPaymentIntentCanonical,
  recordCodCustomerCollectionCanonical,
  recordCodMerchantRemittanceCanonical,
  isPaymentIntentRefreshUnavailable,
  recordManualPaymentCanonical,
  refreshPaymentIntentCanonical,
  retryPaymentIntentCanonical,
  type CustomerCredit,
  type InvoicePaymentAllocation,
  type PaymentIntent,
  type PaymentMethodCatalogItem,
  type PaymentRecord,
  type PaymentScheduleLine,
} from "../../public/api";
import type { PaymentWorkspaceDto } from "../../application/vertical-slice/paymentVerticalSlice";
import { usePaymentWorkspaceQuery } from "../hooks/usePaymentVerticalSlice";

const durableId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
type WorkspaceTab = "COLLECTIONS" | "INTENTS" | "PAYMENTS" | "RECONCILIATION" | "CREDITS";

interface ManualPaymentForm {
  orderId: string;
  buyerType: "CONTACT" | "ORGANIZATION_ACCOUNT";
  buyerId: string;
  amount: string;
  currency: string;
  methodCode: string;
  externalReference: string;
  codEvidenceReference: string;
  convertToCredit: boolean;
}

interface IntentForm {
  orderId: string;
  buyerType: "CONTACT" | "ORGANIZATION_ACCOUNT";
  buyerId: string;
  amount: string;
  currency: string;
  methodCode: string;
}

const emptyManualForm = (currency: string): ManualPaymentForm => ({
  orderId: "",
  buyerType: "ORGANIZATION_ACCOUNT",
  buyerId: "",
  amount: "",
  currency,
  methodCode: "",
  externalReference: "",
  codEvidenceReference: "",
  convertToCredit: false,
});
const emptyIntentForm = (currency: string): IntentForm => ({
  orderId: "",
  buyerType: "ORGANIZATION_ACCOUNT",
  buyerId: "",
  amount: "",
  currency,
  methodCode: "",
});


const EMPTY_PAYMENT_WORKSPACE: PaymentWorkspaceDto = {
  plans: [], scheduleLines: [], intents: [], refundIntents: [], paymentRecords: [], allocations: [], customerCredits: [], methodCatalog: [], providerCatalog: [],
};

const OPEN_INTENT_STATES = new Set(["CREATED", "REQUIRES_ACTION", "PROCESSING"]);
const OPEN_SCHEDULE_STATES = new Set(["SCHEDULED", "NOT_DUE", "DUE", "PARTIAL", "OVERDUE"]);

function sumByCurrency(values: readonly MoneyDto[]): MoneyDto[] {
  const totals = new Map<string, MoneyDto>();
  for (const value of values) {
    const current = totals.get(value.currency) ?? money("0", value.currency);
    totals.set(value.currency, addMoney(current, value));
  }
  return [...totals.values()];
}

export const PaymentOperationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { locale } = useI18n();
  const { workspaceKey = "unicore-vietnam" } = useParams<{ workspaceKey: string }>();
  const access = useEffectiveAccess();
  const workspaceConfiguration = useWorkspaceOperationalConfiguration();
  const { baseCurrency, enabledCurrencies } = workspaceConfiguration.localeRegion.currencies;
  const [searchParams, setSearchParams] = useSearchParams();
  const paymentQuery = usePaymentWorkspaceQuery();
  const invoiceQuery = useAuthoritativeResource(getInvoiceWorkspaceResource());
  const receivablesQuery = useAuthoritativeResource(getReceivablesWorkspaceResource());
  const snapshot = paymentQuery.data ?? EMPTY_PAYMENT_WORKSPACE;
  const orders = useSubscribableSnapshot(getOrderListSnapshot, subscribeToOrderList);
  const invoiceSnapshot = invoiceQuery.data ?? { invoices: [], creditNotes: [], deliveries: [] };
  const [tab, setTab] = React.useState<WorkspaceTab>("COLLECTIONS");
  const [search, setSearch] = React.useState("");
  const [showStats, setShowStats] = React.useState(false);
  const [manualOpen, setManualOpen] = React.useState(false);
  const [intentOpen, setIntentOpen] = React.useState(false);
  const [composerIntentId, setComposerIntentId] = React.useState<string | null>(null);
  const [manualForm, setManualForm] = React.useState<ManualPaymentForm>(() => emptyManualForm(baseCurrency));
  const [intentForm, setIntentForm] = React.useState<IntentForm>(() => emptyIntentForm(baseCurrency));
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const text = React.useCallback((vi: string, en: string) => locale === "vi" ? vi : en, [locale]);
  const path = React.useCallback((value: string) => toWorkspacePath(workspaceKey, "crm", value), [workspaceKey]);
  const format = React.useCallback((value: MoneyDto) => formatMoneyDto(value, locale === "vi" ? "vi-VN" : "en-US"), [locale]);
  const formatAggregate = React.useCallback((values: readonly MoneyDto[]) => {
    const totals = sumByCurrency(values);
    return totals.length ? totals.map(format).join(" · ") : format(money("0", baseCurrency));
  }, [baseCurrency, format]);
  const formatDate = React.useCallback((value?: string) => {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
  }, [locale]);

  const visibleOrders = React.useMemo(
    () => orders.filter((order) => access.canAccessRecord("orders", order)),
    [access, orders],
  );
  const orderById = React.useMemo(() => new Map(visibleOrders.map((order) => [order.id, order])), [visibleOrders]);
  const invoiceById = React.useMemo(() => new Map(invoiceSnapshot.invoices.map((invoice) => [invoice.id, invoice])), [invoiceSnapshot.invoices]);
  const receivableByInvoiceId = React.useMemo(() => new Map((receivablesQuery.data?.entries ?? []).map((receivable) => [receivable.invoiceId, receivable])), [receivablesQuery.data]);
  const planById = React.useMemo(() => new Map(snapshot.plans.map((plan) => [plan.id, plan])), [snapshot.plans]);
  const methodByCode = React.useMemo(() => new Map(snapshot.methodCatalog.map((method) => [method.code, method])), [snapshot.methodCatalog]);
  const manualMethods = React.useMemo(() => snapshot.methodCatalog.filter((item) => item.enabled && item.supportsManualRecording), [snapshot.methodCatalog]);
  const intentMethods = React.useMemo(() => snapshot.methodCatalog.filter((item) => item.enabled && item.supportsIntent), [snapshot.methodCatalog]);

  const displayOrder = React.useCallback((orderId?: string) => orderId ? orderById.get(orderId)?.orderNumber ?? orderId : text("Không gắn đơn hàng", "No linked order"), [orderById, text]);
  const displayBuyer = React.useCallback((buyerId: string, orderId?: string) => {
    const order = orderId ? orderById.get(orderId) : undefined;
    return order?.customerName ?? order?.contactName ?? order?.recipientName ?? buyerId;
  }, [orderById]);
  const methodLabel = React.useCallback((methodCode: string) => {
    const method = methodByCode.get(methodCode);
    return method ? (locale === "vi" ? method.displayNameVi : method.displayNameEn) : methodCode;
  }, [locale, methodByCode]);

  const safeAvailableAmount = React.useCallback((record: PaymentRecord) => {
    const allocated = sumMoney(snapshot.allocations.filter((item) => item.paymentRecordId === record.id && item.state === "EFFECTIVE").map((item) => item.amount), record.amount.currency);
    const refunded = sumMoney(snapshot.paymentRecords.filter((item) => item.kind === "REFUND" && item.state === "SUCCEEDED" && item.refundOfPaymentRecordId === record.id).map((item) => item.amount), record.amount.currency);
    const consumed = addMoney(allocated, refunded);
    return compareMoney(consumed, record.amount) >= 0 ? money("0", record.amount.currency) : subtractMoney(record.amount, consumed);
  }, [snapshot.allocations, snapshot.paymentRecords]);

  const collectionLines = React.useMemo(() => snapshot.scheduleLines
    .filter((line) => planById.get(line.planId)?.state === "ACTIVE" && OPEN_SCHEDULE_STATES.has(line.state) && compareMoney(line.outstandingAmount, money("0", line.outstandingAmount.currency)) > 0)
    .sort((left, right) => {
      const priority = (state: PaymentScheduleLine["state"]) => state === "OVERDUE" ? 0 : state === "DUE" || state === "PARTIAL" ? 1 : 2;
      return priority(left.state) - priority(right.state) || (left.resolvedDueDate ?? "9999").localeCompare(right.resolvedDueDate ?? "9999") || left.sequence - right.sequence;
    }), [planById, snapshot.scheduleLines]);
  const openIntents = React.useMemo(() => snapshot.intents.filter((intent) => OPEN_INTENT_STATES.has(intent.state)), [snapshot.intents]);
  const paymentAvailability = React.useMemo(() => snapshot.paymentRecords
    .filter((record) => record.kind === "PAYMENT" && record.state === "SUCCEEDED")
    .filter((record) => methodByCode.get(record.methodCode)?.kind !== "COD" || (record.codMerchantRemittanceState === "REMITTED" && record.effectiveForReceivables === true))
    .map((record) => ({ record, available: safeAvailableAmount(record) })), [methodByCode, safeAvailableAmount, snapshot.paymentRecords]);
  const unallocatedPayments = React.useMemo(() => paymentAvailability.filter(({ available }) => compareMoney(available, money("0", available.currency)) > 0), [paymentAvailability]);
  const availableCredits = React.useMemo(() => snapshot.customerCredits.filter((credit) => compareMoney(credit.availableAmount, money("0", credit.availableAmount.currency)) > 0), [snapshot.customerCredits]);
  const codPending = React.useMemo(() => snapshot.paymentRecords.filter((record) => {
    const method = methodByCode.get(record.methodCode);
    return method?.kind === "COD" && (record.codCustomerCollectionState !== "COLLECTED" || record.codMerchantRemittanceState !== "REMITTED");
  }), [methodByCode, snapshot.paymentRecords]);

  const dueRuleLabel = React.useCallback((line: PaymentScheduleLine) => {
    if (line.resolvedDueDate) return text(`Hạn ${formatDate(line.resolvedDueDate)}`, `Due ${formatDate(line.resolvedDueDate)}`);
    const rule = line.dueRule;
    if (rule.type === "FIXED_DATE") return text(`Hạn ${formatDate(rule.date)}`, `Due ${formatDate(rule.date)}`);
    if (rule.type === "EVENT_RELATIVE") {
      const eventLabels: Record<typeof rule.event, [string, string]> = {
        ORDER_CONFIRMED: ["sau khi xác nhận đơn", "after order confirmation"],
        INVOICE_ISSUED: ["sau khi phát hành hóa đơn", "after invoice issue"],
        DELIVERY_CONFIRMED: ["sau khi giao hàng", "after delivery"],
        ACCEPTANCE_CONFIRMED: ["sau khi nghiệm thu", "after acceptance"],
      };
      const [vi, en] = eventLabels[rule.event];
      return text(`${rule.offsetDays} ngày ${vi}`, `${rule.offsetDays} days ${en}`);
    }
    if (rule.type === "OPERATIONAL_PRECONDITION") {
      const operations: Record<typeof rule.operation, [string, string]> = {
        BOOKING: ["trước khi tạo vận đơn", "before shipping booking"],
        DISPATCH: ["trước khi xuất hàng", "before dispatch"],
        COMPLETION: ["trước khi hoàn tất đơn", "before order completion"],
      };
      const [vi, en] = operations[rule.operation];
      return text(`${rule.leadDays} ngày ${vi}`, `${rule.leadDays} days ${en}`);
    }
    if (rule.type === "MILESTONE") return text(`Theo mốc ${rule.milestoneCode}`, `At milestone ${rule.milestoneCode}`);
    return text(`Định kỳ từ ${formatDate(rule.firstDueDate)}`, `Recurring from ${formatDate(rule.firstDueDate)}`);
  }, [formatDate, text]);

  const scheduleState = React.useCallback((state: PaymentScheduleLine["state"]) => {
    const map: Record<PaymentScheduleLine["state"], { label: string; variant: "success" | "warning" | "danger" | "info" | "neutral" }> = {
      SCHEDULED: { label: text("Đã lên lịch", "Scheduled"), variant: "neutral" },
      NOT_DUE: { label: text("Chưa đến hạn", "Not due"), variant: "info" },
      DUE: { label: text("Cần thu", "Due"), variant: "warning" },
      PARTIAL: { label: text("Đã thu một phần", "Partially collected"), variant: "warning" },
      SATISFIED: { label: text("Đã thu đủ", "Satisfied"), variant: "success" },
      OVERDUE: { label: text("Quá hạn", "Overdue"), variant: "danger" },
      VOIDED: { label: text("Đã vô hiệu", "Voided"), variant: "neutral" },
    };
    return map[state];
  }, [text]);

  const intentState = React.useCallback((state: PaymentIntent["state"]) => {
    const map: Record<PaymentIntent["state"], { label: string; variant: "success" | "warning" | "danger" | "info" | "neutral" }> = {
      CREATED: { label: text("Đã tạo", "Created"), variant: "info" },
      REQUIRES_ACTION: { label: text("Chờ khách thao tác", "Customer action needed"), variant: "warning" },
      PROCESSING: { label: text("Đang xử lý", "Processing"), variant: "warning" },
      SUCCEEDED: { label: text("Thành công", "Succeeded"), variant: "success" },
      FAILED: { label: text("Thất bại", "Failed"), variant: "danger" },
      CANCELLED: { label: text("Đã hủy", "Cancelled"), variant: "neutral" },
      EXPIRED: { label: text("Hết hạn", "Expired"), variant: "neutral" },
    };
    return map[state];
  }, [text]);

  const paymentState = React.useCallback((state: PaymentRecord["state"]) => {
    if (state === "SUCCEEDED") return { label: text("Đã ghi nhận", "Recorded"), variant: "success" as const };
    if (["FAILED", "CANCELLED", "EXPIRED", "REVERSED"].includes(state)) return { label: text(state === "REVERSED" ? "Đã hoàn tác" : "Không thành công", state === "REVERSED" ? "Reversed" : "Unsuccessful"), variant: "danger" as const };
    return { label: text("Đang xử lý", "Processing"), variant: "warning" as const };
  }, [text]);

  const applyOrderToManual = React.useCallback((orderId: string, amount?: MoneyDto, methodCode?: string) => {
    const order = visibleOrders.find((item) => item.id === orderId);
    if (!order) return;
    setManualForm((current) => ({
      ...current,
      orderId,
      buyerType: order.buyerRef.type,
      buyerId: order.buyerRef.id,
      currency: amount?.currency ?? order.currency ?? baseCurrency,
      amount: amount?.amount ?? String(order.grandTotal ?? order.totalAmount ?? ""),
      methodCode: methodCode && manualMethods.some((item) => item.code === methodCode) ? methodCode : current.methodCode,
    }));
  }, [baseCurrency, manualMethods, visibleOrders]);

  const applyOrderToIntent = React.useCallback((orderId: string, amount?: MoneyDto, methodCode?: string) => {
    const order = visibleOrders.find((item) => item.id === orderId);
    if (!order) return;
    setIntentForm((current) => ({
      ...current,
      orderId,
      buyerType: order.buyerRef.type,
      buyerId: order.buyerRef.id,
      currency: amount?.currency ?? order.currency ?? baseCurrency,
      amount: amount?.amount ?? String(order.grandTotal ?? order.totalAmount ?? ""),
      methodCode: methodCode && intentMethods.some((item) => item.code === methodCode) ? methodCode : current.methodCode,
    }));
  }, [baseCurrency, intentMethods, visibleOrders]);

  React.useEffect(() => {
    if (searchParams.get("action") !== "record" || !access.can(CAPABILITIES.PAYMENTS_RECORD_MANUAL)) return;
    const orderId = searchParams.get("orderId") ?? "";
    setManualForm(emptyManualForm(baseCurrency));
    if (orderId) applyOrderToManual(orderId);
    setManualOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    setSearchParams(next, { replace: true });
  }, [access, applyOrderToManual, searchParams, setSearchParams]);

  React.useEffect(() => {
    if (searchParams.get("action") !== "request" || !access.can(CAPABILITIES.PAYMENTS_INTENT_CREATE)) return;
    const invoiceId = searchParams.get("invoiceId") ?? "";
    const requestedOrderId = searchParams.get("orderId") ?? "";
    const invoice = invoiceId ? invoiceById.get(invoiceId) : undefined;
    const receivable = invoiceId ? receivableByInvoiceId.get(invoiceId) : undefined;
    setIntentForm(emptyIntentForm(baseCurrency));
    if (invoice) {
      const orderId = invoice.sourceLinks.orderId ?? requestedOrderId;
      const amount = receivable?.outstandingAmount ?? invoice.totals.grandTotal;
      if (orderId) applyOrderToIntent(orderId, amount);
      else setIntentForm((current) => ({ ...current, buyerType: invoice.buyerRef.type, buyerId: invoice.buyerRef.id, amount: amount.amount, currency: amount.currency }));
    } else if (requestedOrderId) applyOrderToIntent(requestedOrderId);
    setError("");
    setTab("INTENTS");
    setIntentOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("action");
    next.delete("invoiceId");
    setSearchParams(next, { replace: true });
  }, [access, applyOrderToIntent, invoiceById, receivableByInvoiceId, searchParams, setSearchParams]);

  const selectedManualMethod = manualMethods.find((item) => item.code === manualForm.methodCode);
  const selectedIntentMethod = intentMethods.find((item) => item.code === intentForm.methodCode);
  const selectedProvider = snapshot.providerCatalog.find((provider) => selectedIntentMethod?.providerCodes?.includes(provider.code) && provider.enabled);

  const openManual = (line?: PaymentScheduleLine) => {
    setManualForm(emptyManualForm(baseCurrency));
    setError("");
    if (line) applyOrderToManual(line.orderId, line.outstandingAmount, line.preferredMethodCode ?? line.allowedMethodCodes[0]);
    setManualOpen(true);
  };
  const openIntent = (line?: PaymentScheduleLine) => {
    setIntentForm(emptyIntentForm(baseCurrency));
    setError("");
    if (line) applyOrderToIntent(line.orderId, line.outstandingAmount, line.preferredMethodCode ?? line.allowedMethodCodes[0]);
    setIntentOpen(true);
  };

  const submitManual = async () => {
    try {
      const amount = money(manualForm.amount, manualForm.currency);
      if (compareMoney(amount, money("0", amount.currency)) <= 0) throw new Error(text("Số tiền phải lớn hơn 0.", "Amount must be greater than zero."));
      if (!manualForm.buyerId.trim()) throw new Error(text("Người mua là bắt buộc.", "Buyer is required."));
      if (!selectedManualMethod) throw new Error(text("Chọn phương thức thanh toán từ catalog.", "Select a payment method from the catalog."));
      const isCod = selectedManualMethod.kind === "COD";
      if (isCod && !manualForm.codEvidenceReference.trim()) throw new Error(text("COD cần mã chứng từ thu tiền từ người nhận.", "COD requires customer collection evidence."));
      setBusy(true);
      const now = new Date().toISOString();
      await recordManualPaymentCanonical({
        id: durableId("payment"),
        buyerRef: { type: manualForm.buyerType, id: manualForm.buyerId.trim() },
        orderId: manualForm.orderId || undefined,
        amount,
        methodCode: selectedManualMethod.code,
        channel: isCod ? "CARRIER" : selectedManualMethod.channels[0] ?? "OFFLINE",
        occurredAt: now,
        externalReference: manualForm.externalReference.trim() || undefined,
        evidenceMetadata: isCod ? { customerCollectionEvidenceId: manualForm.codEvidenceReference.trim() } : undefined,
        idempotencyKey: durableId("manual_payment"),
        now,
        allowUnapplied: manualForm.convertToCredit,
        customerCreditId: manualForm.convertToCredit ? durableId("customer_credit") : undefined,
      });
      setManualOpen(false);
      setTab(manualForm.convertToCredit ? "CREDITS" : "PAYMENTS");
      notifyProduct(text("Đã ghi nhận tiền thu. Hãy phân bổ vào hóa đơn để giảm công nợ.", "Payment recorded. Allocate it to an invoice to reduce receivables."), "success");
    } catch (caught) {
      setError(formatApplicationError(caught, { locale, fallbackMessage: text("Không thể ghi nhận thanh toán.", "Payment could not be recorded.") }));
    } finally {
      setBusy(false);
    }
  };

  const submitIntent = async () => {
    try {
      const amount = money(intentForm.amount, intentForm.currency);
      if (compareMoney(amount, money("0", amount.currency)) <= 0) throw new Error(text("Số tiền phải lớn hơn 0.", "Amount must be greater than zero."));
      if (!intentForm.buyerId.trim()) throw new Error(text("Người mua là bắt buộc.", "Buyer is required."));
      if (!selectedIntentMethod || !selectedProvider) throw new Error(text("Phương thức hoặc nhà cung cấp không khả dụng.", "Payment method or provider is unavailable."));
      setBusy(true);
      const now = new Date();
      await createPaymentIntentCanonical({
        id: durableId("intent"),
        buyerRef: { type: intentForm.buyerType, id: intentForm.buyerId.trim() },
        orderId: intentForm.orderId || undefined,
        amount,
        methodCode: selectedIntentMethod.code,
        providerCode: selectedProvider.code,
        returnContext: { routeKey: "payments" },
        expiresAt: new Date(now.getTime() + 30 * 60_000).toISOString(),
        idempotencyKey: durableId("payment_intent"),
        now: now.toISOString(),
      });
      setIntentOpen(false);
      setTab("INTENTS");
      notifyProduct(text("Đã tạo yêu cầu thanh toán. Trạng thái chỉ thay đổi theo kết quả từ nhà cung cấp.", "Payment request created. Its state changes only from provider evidence."), "success");
    } catch (caught) {
      setError(formatApplicationError(caught, { locale, fallbackMessage: text("Không thể tạo yêu cầu thanh toán.", "Payment request could not be created.") }));
    } finally {
      setBusy(false);
    }
  };

  const cancelIntent = async (intent: PaymentIntent) => {
    const confirmed = await requestConfirmation({
      title: text("Hủy yêu cầu thanh toán", "Cancel payment request"),
      message: text("Yêu cầu thanh toán sẽ được hủy. Liên kết đã gửi không thể tự thay đổi kết quả thu tiền.", "The payment request will be cancelled. A shared checkout link cannot change the collection result by itself."),
      confirmLabel: text("Hủy yêu cầu", "Cancel request"),
      cancelLabel: text("Giữ lại", "Keep"),
      tone: "warning",
    });
    if (!confirmed) return;
    try {
      await cancelPaymentIntentCanonical(intent.id, intent.version);
      notifyProduct(text("Đã hủy yêu cầu thanh toán.", "Payment request cancelled."), "success");
    } catch (caught) {
      notifyProduct(formatApplicationError(caught, { locale, fallbackMessage: text("Không thể hủy yêu cầu.", "Payment request could not be cancelled.") }), "danger");
    }
  };

  const refreshIntent = async (intent: PaymentIntent) => {
    // `payment.refresh-intent-status` is a BLOCKED canonical command: refuse before the
    // mutation is started rather than reporting a routing failure afterwards.
    if (isPaymentIntentRefreshUnavailable()) {
      notifyProduct(backendUnavailableMessage({ locale, action: text("Đồng bộ trạng thái thanh toán", "Synchronizing the payment state") }), "warning");
      return;
    }
    try {
      await refreshPaymentIntentCanonical(intent.id);
      notifyProduct(text("Đã đồng bộ trạng thái từ nhà cung cấp.", "State synchronized from the provider."), "success");
    } catch (caught) {
      notifyProduct(formatApplicationError(caught, { locale, fallbackMessage: text("Không thể đồng bộ yêu cầu.", "Payment request could not be synchronized.") }), "danger");
    }
  };

  const retryIntent = async (intent: PaymentIntent) => {
    try {
      const now = new Date();
      await retryPaymentIntentCanonical(intent.id, {
        id: durableId("payment_intent"),
        expectedVersion: intent.version,
        expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
        idempotencyKey: durableId("payment_intent_retry"),
        now: now.toISOString(),
      });
      notifyProduct(text("Đã tạo yêu cầu thử lại; yêu cầu cũ vẫn được giữ để đối soát.", "A retry request was created; the original remains for audit."), "success");
    } catch (caught) {
      notifyProduct(formatApplicationError(caught, { locale, fallbackMessage: text("Không thể thử lại yêu cầu.", "Payment request retry failed.") }), "danger");
    }
  };

  const updateCodCollection = async (record: PaymentRecord) => {
    try {
      await recordCodCustomerCollectionCanonical(record.id, { expectedVersion: record.version, state: "COLLECTED", evidenceMetadata: { confirmedBy: access.memberId }, now: new Date().toISOString() });
      notifyProduct(text("Đã xác nhận đơn vị vận chuyển thu tiền từ khách.", "Carrier collection from the customer was confirmed."), "success");
    } catch (caught) {
      notifyProduct(formatApplicationError(caught, { locale, fallbackMessage: text("Không thể ghi nhận chứng từ COD.", "COD evidence could not be recorded.") }), "danger");
    }
  };
  const updateCodRemittance = async (record: PaymentRecord) => {
    try {
      await recordCodMerchantRemittanceCanonical(record.id, { expectedVersion: record.version, state: "REMITTED", evidenceMetadata: { reconciledBy: access.memberId }, now: new Date().toISOString() });
      notifyProduct(text("Đã xác nhận tiền COD được chuyển về doanh nghiệp.", "COD remittance to the merchant was confirmed."), "success");
    } catch (caught) {
      notifyProduct(formatApplicationError(caught, { locale, fallbackMessage: text("Không thể ghi nhận đối soát COD.", "COD remittance evidence could not be recorded.") }), "danger");
    }
  };

  const reconciliationCount = unallocatedPayments.length + availableCredits.length;
  const matchesSearch = React.useCallback((...values: Array<string | undefined>) => {
    const normalized = search.trim().toLocaleLowerCase();
    return !normalized || values.some((value) => value?.toLocaleLowerCase().includes(normalized));
  }, [search]);
  const visibleCollectionLines = React.useMemo(() => collectionLines.filter((line) => matchesSearch(displayOrder(line.orderId), displayBuyer(line.buyerRef.id, line.orderId), line.label, line.id)), [collectionLines, displayBuyer, displayOrder, matchesSearch]);
  const visibleIntents = React.useMemo(() => snapshot.intents.filter((intent) => matchesSearch(displayOrder(intent.orderId), displayBuyer(intent.buyerRef.id, intent.orderId), intent.id, intent.methodCode, intent.state)), [displayBuyer, displayOrder, matchesSearch, snapshot.intents]);
  const visiblePaymentRecords = React.useMemo(() => snapshot.paymentRecords.filter((record) => matchesSearch(displayOrder(record.orderId), displayBuyer(record.buyerRef.id, record.orderId), record.externalReference, record.id, record.methodCode)), [displayBuyer, displayOrder, matchesSearch, snapshot.paymentRecords]);
  const visibleAllocations = React.useMemo(() => snapshot.allocations.filter((allocation) => { const invoice = invoiceById.get(allocation.invoiceId); return matchesSearch(invoice?.invoiceNumber, invoice?.buyerSnapshot.displayName, allocation.id, allocation.invoiceId); }), [invoiceById, matchesSearch, snapshot.allocations]);
  const visibleCredits = React.useMemo(() => snapshot.customerCredits.filter((credit) => matchesSearch(displayBuyer(credit.buyerRef.id), credit.id, credit.sourcePaymentRecordId)), [displayBuyer, matchesSearch, snapshot.customerCredits]);
  const collectionPagination = useListPagination(visibleCollectionLines, 25);
  const intentPagination = useListPagination(visibleIntents, 25);
  const paymentPagination = useListPagination(visiblePaymentRecords, 25);
  const allocationPagination = useListPagination(visibleAllocations, 25);
  const creditPagination = useListPagination(visibleCredits, 25);
  const tabs: Array<{ id: WorkspaceTab; label: string; count: number }> = [
    { id: "COLLECTIONS", label: text("Cần thu", "Collection queue"), count: collectionLines.length },
    { id: "INTENTS", label: text("Yêu cầu thanh toán", "Payment requests"), count: openIntents.length },
    { id: "PAYMENTS", label: text("Tiền đã ghi nhận", "Recorded payments"), count: snapshot.paymentRecords.length },
    { id: "RECONCILIATION", label: text("Đối soát & phân bổ", "Reconcile & allocate"), count: reconciliationCount },
    { id: "CREDITS", label: text("Tín dụng khách hàng", "Customer credits"), count: snapshot.customerCredits.length },
  ];

  return <ListPageFrame id="payment-operations-page" data-guidance-id="payment.operations.screen">
    <ListPageHeader
      title={text("Thu tiền & thanh toán", "Collections & payments")}
      count={tabs.find((item) => item.id === tab)?.count}
      icon={<WalletCards size={18} />}
      actions={(
        <PageHeaderActions
          actions={[
            { id: "open-invoices", label: text("Hóa đơn", "Invoices"), icon: <ReceiptText size={14} />, onClick: () => navigate(path("invoices")), variant: "secondary", hidden: !access.can(CAPABILITIES.INVOICES_READ) },
            { id: "open-receivables", label: text("Công nợ", "Receivables"), icon: <Landmark size={14} />, onClick: () => navigate(path("receivables")), variant: "secondary", hidden: !access.can(CAPABILITIES.RECEIVABLES_READ) },
            { id: "request-payment", label: text("Gửi yêu cầu thu", "Request payment"), icon: <CreditCard size={14} />, onClick: () => openIntent(), variant: "secondary", hidden: !access.can(CAPABILITIES.PAYMENTS_INTENT_CREATE) },
            { id: "record-payment", label: text("Ghi nhận tiền đã thu", "Record collected funds"), icon: <Plus size={14} />, onClick: () => openManual(), variant: "primary", hidden: !access.can(CAPABILITIES.PAYMENTS_RECORD_MANUAL) },
          ]}
        />
      )}
    />

    <div data-guidance-id="payment.operations.search">
    <ListToolbar
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder={text("Tìm đơn hàng, khách hàng, chứng từ hoặc yêu cầu thanh toán...", "Search order, buyer, evidence, or payment request...")}
      showStats
      onOpenStats={() => setShowStats(true)}
      statsLabel={text("Thống kê", "Statistics")}
    />
    </div>

    <div data-guidance-id="payment.operations.workflow">
    <OperationSavedViews
      title={text("Quy trình thu tiền", "Collection workflow")}
      activeKey={tab}
      onChange={(key) => setTab(key as WorkspaceTab)}
      items={tabs.map((item, index) => ({ key: item.id, label: `${index + 1}. ${item.label}`, count: item.count, tone: index === 0 ? "violet" : index === 1 ? "sky" : index === 2 ? "emerald" : index === 3 ? "amber" : "slate" }))}
    />
    </div>

    {tab === "COLLECTIONS" && <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-950">{text("Danh sách khoản cần thu", "Collection queue")}</h2>
      {visibleCollectionLines.length === 0 ? <ListStatePanel kind="empty" title={text("Không có khoản cần thu phù hợp", "No matching collection tasks")} /> : (
        <ListTableSurface surfaceId="payment-collections"><ListDataTable minWidth={1040}><ListTableHead><tr><ListTableHeaderCell>{text("Đơn hàng / khách hàng", "Order / buyer")}</ListTableHeaderCell><ListTableHeaderCell>{text("Khoản cần thu", "Milestone")}</ListTableHeaderCell><ListTableHeaderCell>{text("Thời điểm", "Due condition")}</ListTableHeaderCell><ListTableHeaderCell align="right">{text("Còn phải thu", "Outstanding")}</ListTableHeaderCell><ListTableHeaderCell align="center">{text("Trạng thái", "Status")}</ListTableHeaderCell><ListTableHeaderCell align="right">{text("Thao tác", "Actions")}</ListTableHeaderCell></tr></ListTableHead><ListTableBody>
          {collectionPagination.pageItems.map((line) => { const status = scheduleState(line.state); const allowedMethod = line.preferredMethodCode ?? line.allowedMethodCodes[0]; const canRequest = Boolean(allowedMethod && intentMethods.some((item) => item.code === allowedMethod)); return <ListTableRow key={line.id}><ListTableCell><ListRecordIdentity avatar={<CalendarClock size={15} />} primary={displayOrder(line.orderId)} secondary={displayBuyer(line.buyerRef.id, line.orderId)} onOpen={() => navigate(path(`orders/${line.orderId}`))} /></ListTableCell><ListTableCell><div className="font-semibold text-slate-800">{line.label}</div><div className="mt-0.5 text-[10px] text-slate-400">{allowedMethod ? methodLabel(allowedMethod) : text("Theo danh mục của kế hoạch", "From plan catalog")}</div></ListTableCell><ListTableCell>{dueRuleLabel(line)}</ListTableCell><ListTableCell align="right"><div className="whitespace-nowrap font-semibold text-slate-950">{format(line.outstandingAmount)}</div>{compareMoney(line.satisfiedAmount, money("0", line.satisfiedAmount.currency)) > 0 && <div className="mt-0.5 text-[10px] text-emerald-700">{text("Đã thu", "Collected")}: {format(line.satisfiedAmount)}</div>}</ListTableCell><ListTableCell align="center"><Badge variant={status.variant}>{status.label}</Badge></ListTableCell><ListTableCell align="right"><div className="flex justify-end gap-2">{canRequest && access.can(CAPABILITIES.PAYMENTS_INTENT_CREATE) && <Button size="xs" variant="secondary" icon={<CreditCard size={13} />} onClick={() => openIntent(line)}>{text("Gửi yêu cầu", "Request")}</Button>}{access.can(CAPABILITIES.PAYMENTS_RECORD_MANUAL) && <Button size="xs" actionIntent="confirm" className="text-white [&_svg]:stroke-white" icon={<Plus size={13} />} onClick={() => openManual(line)}>{text("Ghi nhận thu", "Record")}</Button>}</div></ListTableCell></ListTableRow>; })}
        </ListTableBody></ListDataTable></ListTableSurface>
      )}
      {visibleCollectionLines.length > 0 ? <ListPaginationBar {...collectionPagination} itemLabelVi="khoản cần thu" itemLabelEn="collection items" /> : null}
    </section>}

    {tab === "INTENTS" && <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-950">{text("Yêu cầu thanh toán gửi khách", "Customer payment requests")}</h2>
      {visibleIntents.length === 0 ? <ListStatePanel kind="empty" title={text("Chưa có yêu cầu phù hợp", "No matching requests")} /> : <ListTableSurface surfaceId="payment-intents"><ListDataTable minWidth={1060}><ListTableHead><tr><ListTableHeaderCell>{text("Đơn hàng / khách hàng", "Order / buyer")}</ListTableHeaderCell><ListTableHeaderCell align="right">{text("Số tiền", "Amount")}</ListTableHeaderCell><ListTableHeaderCell>{text("Phương thức / Nhà cung cấp", "Method / Provider")}</ListTableHeaderCell><ListTableHeaderCell align="center">{text("Trạng thái", "Status")}</ListTableHeaderCell><ListTableHeaderCell>{text("Hết hạn", "Expires")}</ListTableHeaderCell><ListTableHeaderCell align="right">{text("Thao tác", "Actions")}</ListTableHeaderCell></tr></ListTableHead><ListTableBody>{intentPagination.pageItems.map((intent) => { const status = intentState(intent.state); return <ListTableRow key={intent.id}><ListTableCell><ListRecordIdentity avatar={<CreditCard size={15} />} primary={displayOrder(intent.orderId)} secondary={displayBuyer(intent.buyerRef.id, intent.orderId)} /></ListTableCell><ListTableCell align="right" className="whitespace-nowrap font-semibold text-slate-950">{format(intent.amount)}</ListTableCell><ListTableCell><div className="font-semibold text-slate-800">{methodLabel(intent.methodCode)}</div><div className="mt-0.5 text-[10px] text-slate-400">{snapshot.providerCatalog.find((provider) => provider.code === intent.providerCode)?.displayName ?? intent.providerCode}</div></ListTableCell><ListTableCell align="center"><Badge variant={status.variant}>{status.label}</Badge>{intent.failureCode && <div className="mt-1 text-[9px] text-rose-600">{intent.failureCode}</div>}</ListTableCell><ListTableCell className="whitespace-nowrap">{formatDate(intent.expiresAt)}</ListTableCell><ListTableCell align="right"><div className="flex justify-end gap-2"><Button size="xs" variant="secondary" icon={<FileText size={13} />} onClick={() => setComposerIntentId(intent.id)}>{text("Soạn & gửi", "Compose")}</Button>{intent.checkoutUrl && OPEN_INTENT_STATES.has(intent.state) && <Button size="xs" variant="secondary" icon={<ExternalLink size={13} />} onClick={() => window.open(intent.checkoutUrl, "_blank", "noopener,noreferrer")}>{text("Mở", "Open")}</Button>}<Button size="xs" variant="secondary" icon={<RefreshCw size={13} />} onClick={() => refreshIntent(intent)}>{text("Đồng bộ", "Sync")}</Button>{["FAILED", "EXPIRED"].includes(intent.state) && <Button size="xs" actionIntent="sync" onClick={() => retryIntent(intent)}>{text("Thử lại", "Retry")}</Button>}{OPEN_INTENT_STATES.has(intent.state) && access.can(CAPABILITIES.PAYMENTS_INTENT_CANCEL) && <Button size="xs" variant="secondary" icon={<XCircle size={13} />} onClick={() => cancelIntent(intent)}>{text("Hủy", "Cancel")}</Button>}</div></ListTableCell></ListTableRow>; })}</ListTableBody></ListDataTable></ListTableSurface>}
      {visibleIntents.length > 0 ? <ListPaginationBar {...intentPagination} itemLabelVi="yêu cầu thanh toán" itemLabelEn="payment requests" /> : null}
    </section>}

    {tab === "PAYMENTS" && <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-950">{text("Tiền đã ghi nhận", "Recorded cash evidence")}</h2>
      {visiblePaymentRecords.length === 0 ? <ListStatePanel kind="empty" title={text("Chưa có khoản thu phù hợp", "No matching recorded funds")} /> : <ListTableSurface surfaceId="payments"><ListDataTable minWidth={1120}><ListTableHead><tr><ListTableHeaderCell>{text("Chứng từ thu", "Payment evidence")}</ListTableHeaderCell><ListTableHeaderCell>{text("Đơn hàng / khách hàng", "Order / buyer")}</ListTableHeaderCell><ListTableHeaderCell>{text("Phương thức", "Method")}</ListTableHeaderCell><ListTableHeaderCell align="right">{text("Số tiền", "Amount")}</ListTableHeaderCell><ListTableHeaderCell align="right">{text("Chưa phân bổ", "Available")}</ListTableHeaderCell><ListTableHeaderCell align="center">{text("Trạng thái", "Status")}</ListTableHeaderCell><ListTableHeaderCell align="right">COD</ListTableHeaderCell></tr></ListTableHead><ListTableBody>{paymentPagination.pageItems.map((record) => { const available = safeAvailableAmount(record); const state = paymentState(record.state); const method = methodByCode.get(record.methodCode); return <ListTableRow key={record.id}><ListTableCell><ListRecordIdentity avatar={<Banknote size={15} />} toneClassName="border-emerald-200 bg-emerald-50 text-emerald-700" primary={record.externalReference ?? text("Chứng từ nội bộ", "Internal record")} secondary={formatDate(record.occurredAt)} onOpen={() => navigate(path(`payments/${record.id}`))} /></ListTableCell><ListTableCell><div className="font-semibold text-slate-800">{displayOrder(record.orderId)}</div><div className="mt-0.5 text-[10px] text-slate-400">{displayBuyer(record.buyerRef.id, record.orderId)}</div></ListTableCell><ListTableCell>{methodLabel(record.methodCode)}</ListTableCell><ListTableCell align="right" className="whitespace-nowrap font-semibold text-slate-950">{format(record.amount)}</ListTableCell><ListTableCell align="right"><div className={`whitespace-nowrap font-semibold ${compareMoney(available, money("0", available.currency)) > 0 ? "text-amber-700" : "text-slate-500"}`}>{format(available)}</div><div className="mt-0.5 text-[10px] text-slate-400">{record.reconciliationState === "MATCHED" ? text("Đã đối soát", "Reconciled") : record.reconciliationState === "MISMATCH" ? text("Có chênh lệch", "Mismatch") : text("Chưa đối soát", "Unreconciled")}</div></ListTableCell><ListTableCell align="center"><Badge variant={state.variant}>{state.label}</Badge></ListTableCell><ListTableCell align="right"><div className="flex justify-end gap-2">{method?.kind === "COD" && record.codCustomerCollectionState !== "COLLECTED" && access.can(CAPABILITIES.PAYMENTS_RECORD_MANUAL) && <Button size="xs" actionIntent="confirm" onClick={() => updateCodCollection(record)}>{text("Xác nhận đã thu", "Confirm collection")}</Button>}{method?.kind === "COD" && record.codCustomerCollectionState === "COLLECTED" && record.codMerchantRemittanceState !== "REMITTED" && access.can(CAPABILITIES.PAYMENTS_RECONCILE) && <Button size="xs" actionIntent="sync" onClick={() => updateCodRemittance(record)}>{text("Xác nhận chuyển về", "Confirm remittance")}</Button>}{method?.kind === "COD" && record.codMerchantRemittanceState === "REMITTED" && <Badge variant="success">{text("Đã đối soát COD", "COD reconciled")}</Badge>}</div></ListTableCell></ListTableRow>; })}</ListTableBody></ListDataTable></ListTableSurface>}
      {visiblePaymentRecords.length > 0 ? <ListPaginationBar {...paymentPagination} itemLabelVi="khoản thu" itemLabelEn="payments" /> : null}
    </section>}

    {tab === "RECONCILIATION" && <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><h2 className="text-sm font-semibold text-violet-950">{text("Phân bổ tiền vào hóa đơn", "Allocate funds to invoices")}</h2>{access.can(CAPABILITIES.RECEIVABLES_READ) && <Button size="sm" icon={<Landmark size={14} />} onClick={() => navigate(path("receivables"))}>{text("Mở Công nợ", "Open Receivables")}</Button>}</div>
      <div className="grid gap-3 lg:grid-cols-2"><Card padding="sm"><h3 className="text-xs font-semibold text-slate-950">{text("Nguồn tiền chưa phân bổ", "Unallocated payment sources")}</h3><div className="mt-3 space-y-2">{unallocatedPayments.length === 0 ? <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">{text("Không có khoản thu đang chờ phân bổ.", "No Payments await allocation.")}</p> : unallocatedPayments.map(({ record, available }) => <div key={record.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5"><div className="min-w-0"><p className="crm-text-wrap text-xs font-semibold text-slate-900">{record.externalReference ?? displayOrder(record.orderId)}</p><p className="mt-0.5 crm-text-wrap text-[10px] text-slate-400">{displayBuyer(record.buyerRef.id, record.orderId)} · {methodLabel(record.methodCode)}</p></div><strong className="shrink-0 text-xs text-amber-700">{format(available)}</strong></div>)}</div></Card><Card padding="sm"><h3 className="text-xs font-semibold text-slate-950">{text("Tín dụng khách hàng khả dụng", "Available customer credits")}</h3><div className="mt-3 space-y-2">{availableCredits.length === 0 ? <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">{text("Không có tín dụng khách hàng khả dụng.", "No Customer Credit is available.")}</p> : availableCredits.map((credit) => <div key={credit.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5"><div className="min-w-0"><p className="crm-text-wrap text-xs font-semibold text-slate-900">{displayBuyer(credit.buyerRef.id)}</p><p className="mt-0.5 text-[10px] text-slate-400">{text("Từ khoản tiền chưa áp dụng", "From unapplied payment")}</p></div><strong className="shrink-0 text-xs text-violet-700">{format(credit.availableAmount)}</strong></div>)}</div></Card></div>
      <div><h3 className="crm-overflow-safe mb-3 text-sm font-semibold text-slate-950">{text("Lịch sử phân bổ", "Allocation history")}</h3>{visibleAllocations.length === 0 ? <ListStatePanel kind="empty" title={text("Chưa có phân bổ phù hợp", "No matching allocations")} /> : <ListTableSurface surfaceId="payment-allocations"><ListDataTable minWidth={760}><ListTableHead><tr><ListTableHeaderCell>{text("Hóa đơn / khách hàng", "Invoice / buyer")}</ListTableHeaderCell><ListTableHeaderCell>{text("Nguồn tiền", "Source")}</ListTableHeaderCell><ListTableHeaderCell align="right">{text("Số tiền", "Amount")}</ListTableHeaderCell><ListTableHeaderCell align="center">{text("Trạng thái", "Status")}</ListTableHeaderCell></tr></ListTableHead><ListTableBody>{allocationPagination.pageItems.map((allocation: InvoicePaymentAllocation) => { const invoice = invoiceById.get(allocation.invoiceId); const payment = allocation.paymentRecordId ? snapshot.paymentRecords.find((item) => item.id === allocation.paymentRecordId) : undefined; return <ListTableRow key={allocation.id}><ListTableCell><ListRecordIdentity avatar={<Link2 size={15} />} primary={invoice?.invoiceNumber ?? text("Hóa đơn", "Invoice")} secondary={invoice?.buyerSnapshot.displayName ?? allocation.buyerRef.id} onOpen={() => navigate(path(`invoices/${allocation.invoiceId}`))} /></ListTableCell><ListTableCell>{payment?.externalReference ?? (allocation.customerCreditId ? text("Tín dụng khách hàng", "Customer Credit") : text("Khoản thu", "Payment"))}</ListTableCell><ListTableCell align="right" className="whitespace-nowrap font-semibold text-slate-950">{format(allocation.amount)}</ListTableCell><ListTableCell align="center"><Badge variant={allocation.state === "EFFECTIVE" ? "success" : "neutral"}>{allocation.state === "EFFECTIVE" ? text("Có hiệu lực", "Effective") : text("Đã hoàn tác", "Reversed")}</Badge></ListTableCell></ListTableRow>; })}</ListTableBody></ListDataTable></ListTableSurface>}
        {visibleAllocations.length > 0 ? <ListPaginationBar {...allocationPagination} itemLabelVi="phân bổ" itemLabelEn="allocations" /> : null}
      </div>
    </section>}

    {tab === "CREDITS" && <section className="space-y-3">
      <h2 className="text-sm font-semibold text-slate-950">{text("Tín dụng khách hàng", "Customer credits")}</h2>
      {visibleCredits.length === 0 ? <ListStatePanel kind="empty" title={text("Chưa có tín dụng phù hợp", "No matching customer credits")} /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{creditPagination.pageItems.map((credit: CustomerCredit) => <Card key={credit.id} className="border-slate-200"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="crm-text-wrap text-xs font-semibold text-slate-950">{displayBuyer(credit.buyerRef.id)}</p><p className="mt-1 crm-text-wrap text-[10px] text-slate-500">{text("Nguồn", "Source")}: {snapshot.paymentRecords.find((record) => record.id === credit.sourcePaymentRecordId)?.externalReference ?? text("Khoản thu chưa áp dụng", "Unapplied payment")}</p></div><Badge variant={credit.state === "AVAILABLE" ? "success" : credit.state === "PARTIALLY_ALLOCATED" ? "warning" : "neutral"}>{credit.state === "AVAILABLE" ? text("Khả dụng", "Available") : credit.state === "PARTIALLY_ALLOCATED" ? text("Đã dùng một phần", "Partially used") : credit.state === "ALLOCATED" ? text("Đã dùng hết", "Fully used") : text("Đã hoàn tác", "Reversed")}</Badge></div><div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs"><div><span className="block text-[9px] uppercase tracking-wider text-slate-400">{text("Ban đầu", "Original")}</span><strong className="mt-1 block text-slate-900">{format(credit.originalAmount)}</strong></div><div><span className="block text-[9px] uppercase tracking-wider text-slate-400">{text("Còn lại", "Available")}</span><strong className="mt-1 block text-violet-700">{format(credit.availableAmount)}</strong></div></div></Card>)}</div>}
      {visibleCredits.length > 0 ? <ListPaginationBar {...creditPagination} itemLabelVi="tín dụng khách hàng" itemLabelEn="customer credits" /> : null}
    </section>}

    <Modal
      id="collection-statistics-modal"
      isOpen={showStats}
      onClose={() => setShowStats(false)}
      size="lg"
      title={text("Thống kê thu tiền", "Collection statistics")}
      bodyClassName="bg-slate-50/70"
    >
      <div className="grid gap-3 sm:grid-cols-2">{[
        [text("Cần thu theo lịch", "Scheduled outstanding"), formatAggregate(collectionLines.map((line) => line.outstandingAmount)), `${collectionLines.length} ${text("kỳ đang mở", "open milestones")}`, <CalendarClock size={17} />],
        [text("Chờ khách thanh toán", "Awaiting customer payment"), String(openIntents.length), formatAggregate(openIntents.map((intent) => intent.amount)), <CreditCard size={17} />],
        [text("Tiền chờ phân bổ", "Funds awaiting allocation"), formatAggregate([...unallocatedPayments.map(({ available }) => available), ...availableCredits.map((credit) => credit.availableAmount)]), `${reconciliationCount} ${text("nguồn tiền", "sources")}`, <CircleDollarSign size={17} />],
        [text("COD chờ đối soát", "COD awaiting reconciliation"), String(codPending.length), text("Thu từ khách và chuyển về doanh nghiệp", "Collection and merchant remittance"), <Banknote size={17} />],
      ].map(([label, value, hint, icon]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</div><div className="mt-2 break-words text-xl font-semibold text-slate-950">{value}</div><div className="mt-1 text-xs text-slate-500">{hint}</div></div><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700">{icon}</span></div></div>)}</div>
    </Modal>

    <Modal isOpen={manualOpen} onClose={() => setManualOpen(false)} title={text("Ghi nhận tiền đã thu", "Record collected funds")} size="md" variant="form" footer={<><Button variant="secondary" onClick={() => setManualOpen(false)}>{text("Hủy", "Cancel")}</Button><Button actionIntent="confirm" className="text-white [&_svg]:stroke-white" loading={busy} onClick={submitManual}>{text("Ghi nhận khoản thu", "Record payment")}</Button></>}>
      <div className="space-y-5">
        <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-800"><FileText className="mr-2 inline" size={16} />{text("Chỉ ghi nhận khi đã có chứng từ hoặc bằng chứng tiền thực nhận. Sau đó phân bổ khoản thu vào hóa đơn tại Công nợ.", "Record only when actual cash evidence exists. Then allocate the funds to an invoice in Receivables.")}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <SearchableSelect label={text("Đơn hàng", "Order")} value={manualForm.orderId} onChange={applyOrderToManual} placeholder={text("Không gắn đơn hàng", "No linked order")} searchPlaceholder={text("Tìm mã đơn hoặc khách hàng...", "Search order or buyer...")} options={visibleOrders.map((order) => ({ value: order.id, label: order.orderNumber, description: displayBuyer(order.buyerRef.id, order.id), keywords: `${order.orderNumber} ${displayBuyer(order.buyerRef.id, order.id)}` }))} />
          <Select label={text("Loại người mua", "Buyer type")} value={manualForm.buyerType} onChange={(event) => setManualForm((current) => ({ ...current, buyerType: event.target.value as ManualPaymentForm["buyerType"] }))}><option value="ORGANIZATION_ACCOUNT">{text("Tổ chức", "Organization")}</option><option value="CONTACT">{text("Cá nhân", "Contact")}</option></Select>
          <Input label={text("Mã người mua", "Buyer ID")} value={manualForm.buyerId} onChange={(event) => setManualForm((current) => ({ ...current, buyerId: event.target.value }))} />
          <Input label={text("Số tiền thực nhận", "Collected amount")} value={manualForm.amount} onChange={(event) => setManualForm((current) => ({ ...current, amount: event.target.value }))} />
          <Select label={text("Tiền tệ", "Currency")} value={manualForm.currency} onChange={(event) => setManualForm((current) => ({ ...current, currency: event.target.value }))}>{enabledCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</Select>
          <Select label={text("Phương thức thu", "Collection method")} value={manualForm.methodCode} onChange={(event) => setManualForm((current) => ({ ...current, methodCode: event.target.value, codEvidenceReference: "" }))}><option value="">{text("Chọn từ danh mục", "Select from catalog")}</option>{manualMethods.filter((item: PaymentMethodCatalogItem) => item.supportedCurrencies.includes(manualForm.currency)).map((item) => <option key={item.code} value={item.code}>{locale === "vi" ? item.displayNameVi : item.displayNameEn}</option>)}</Select>
          <Input label={text("Số tham chiếu / chứng từ", "Reference / evidence number")} value={manualForm.externalReference} onChange={(event) => setManualForm((current) => ({ ...current, externalReference: event.target.value }))} />
          {selectedManualMethod?.kind === "COD" && <Input label={text("Mã chứng từ đơn vị vận chuyển đã thu", "Carrier collection evidence ID")} value={manualForm.codEvidenceReference} onChange={(event) => setManualForm((current) => ({ ...current, codEvidenceReference: event.target.value }))} />}
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 text-sm"><input type="checkbox" className="mt-1" checked={manualForm.convertToCredit} onChange={(event) => setManualForm((current) => ({ ...current, convertToCredit: event.target.checked }))} /><span><strong>{text("Giữ toàn bộ dưới dạng tín dụng khách hàng", "Keep the full amount as Customer Credit")}</strong><span className="mt-1 block leading-5 text-slate-500">{text("Dùng khi chưa xác định hóa đơn cần phân bổ; khoản thu sẽ không được phân bổ đồng thời để tránh ghi nhận hai lần.", "Use when the target invoice is not known; the payment source cannot also be allocated, preventing double counting.")}</span></span></label>
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      </div>
    </Modal>

    <Modal isOpen={intentOpen} onClose={() => setIntentOpen(false)} title={text("Gửi yêu cầu thanh toán", "Request customer payment")} size="md" variant="form" footer={<><Button variant="secondary" onClick={() => setIntentOpen(false)}>{text("Hủy", "Cancel")}</Button><Button actionIntent="confirm" loading={busy} onClick={submitIntent}>{text("Tạo yêu cầu", "Create request")}</Button></>}>
      <div className="space-y-5">
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800"><ShieldCheck className="mr-2 inline" size={16} />{text("Liên kết thanh toán dùng phương thức đã cấu hình. Chỉ trạng thái xác nhận từ nhà cung cấp mới ghi nhận thu tiền thành công.", "The checkout link uses a configured method. Only a confirmed provider state records a successful collection.")}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <SearchableSelect label={text("Đơn hàng", "Order")} value={intentForm.orderId} onChange={applyOrderToIntent} placeholder={text("Không gắn đơn hàng", "No linked order")} searchPlaceholder={text("Tìm mã đơn hoặc khách hàng...", "Search order or buyer...")} options={visibleOrders.map((order) => ({ value: order.id, label: order.orderNumber, description: displayBuyer(order.buyerRef.id, order.id), keywords: `${order.orderNumber} ${displayBuyer(order.buyerRef.id, order.id)}` }))} />
          <Select label={text("Loại người mua", "Buyer type")} value={intentForm.buyerType} onChange={(event) => setIntentForm((current) => ({ ...current, buyerType: event.target.value as IntentForm["buyerType"] }))}><option value="ORGANIZATION_ACCOUNT">{text("Tổ chức", "Organization")}</option><option value="CONTACT">{text("Cá nhân", "Contact")}</option></Select>
          <Input label={text("Mã người mua", "Buyer ID")} value={intentForm.buyerId} onChange={(event) => setIntentForm((current) => ({ ...current, buyerId: event.target.value }))} />
          <Input label={text("Số tiền yêu cầu", "Requested amount")} value={intentForm.amount} onChange={(event) => setIntentForm((current) => ({ ...current, amount: event.target.value }))} />
          <Select label={text("Tiền tệ", "Currency")} value={intentForm.currency} onChange={(event) => setIntentForm((current) => ({ ...current, currency: event.target.value }))}>{enabledCurrencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}</Select>
          <Select label={text("Phương thức thanh toán trực tuyến", "Online payment method")} value={intentForm.methodCode} onChange={(event) => setIntentForm((current) => ({ ...current, methodCode: event.target.value }))}><option value="">{text("Chọn từ danh mục", "Select from catalog")}</option>{intentMethods.filter((item: PaymentMethodCatalogItem) => item.supportedCurrencies.includes(intentForm.currency)).map((item) => <option key={item.code} value={item.code}>{locale === "vi" ? item.displayNameVi : item.displayNameEn}</option>)}</Select>
        </div>
        {selectedProvider && <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">{text("Nhà cung cấp xử lý", "Processing provider")}: <strong>{selectedProvider.displayName}</strong></p>}
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      </div>
    </Modal>
    {composerIntentId && (() => {
      const composerIntent = snapshot.intents.find((item) => item.id === composerIntentId);
      if (!composerIntent) return null;
      return <PaymentRequestComposer intent={composerIntent} order={composerIntent.orderId ? orderById.get(composerIntent.orderId) : undefined} actorId={access.memberId || access.accountId || "current-user"} locale={locale} onClose={() => setComposerIntentId(null)} />;
    })()}
  </ListPageFrame>;
};
