import React, { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  CreditCard,
  ClipboardList,
  Download,
  Edit3,
  Eye,
  FileText,
  ReceiptText,
  MessageCircle,
  Package,
  RefreshCw,
  RotateCcw,
  Send,
  ShoppingBag,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  ConfirmDialog,
  RecordTabTransition,
  SectionHeader,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
  Textarea,
  Select,
} from "@/shared/components/ui";
import {
  RecordDetailFrame,
  RecordDetailHeader,
  recordDetailHeaderActionButtonClassName,
} from "@/components/crm/detail-archetype";
import { RecordHeaderActionMenu } from "@/components/crm/RecordHeaderActionMenu";
import type { ActionDropdownItem, ActionDropdownSection } from "@/components/crm/ActionDropdown";
import {
  OperationDetailTabs,
  OperationInsightPanel,
  OperationLifecycleRail,
} from "@/components/crm/operations";
import { useI18n } from "@/i18n";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { normalizeApplicationError } from "@/shared/domain";
import { formatApplicationError } from "@/shared/operations";
import { getReasonCatalog } from "@/platform/configuration-runtime";
import { businessStatusLabel } from "@/i18n/productGlossary";
import {
  evaluatePaymentFulfillmentGateSnapshot,
  getPaymentObligationsForOrder,
  projectPaymentSummaryFromSnapshot,
  type PaymentRepositorySnapshot,
} from "@/modules/payments";
import { getReturnsSnapshot } from "@/modules/returns";
import { getInvoicesSnapshot, getReceivablesSnapshot, queryInvoiceSnapshot, subscribeToInvoices } from "@/modules/invoices";
import { useSubscribableSnapshot } from "@/platform/react";
import { formatMoneyDto } from "@/shared/money";
import { createDurableId } from "@/shared/ids";
import type { ShippingBooking } from "@/modules/shipping";
import { CAPABILITIES, useEffectiveAccess, useEffectiveRecordAccessDecision } from "@/platform/access-control";
import { usePlatformState } from "@/platform/application-state";
import {
  evaluateOrderClosingPolicy,
  executeOrderClosingCommand,
  isOrderClosingUnavailable,
} from "@/workflows/order-closing";
import { executeOrderConfirmationCommand } from "@/workflows/order-confirmation";
import { recordOrderDeliveryCommandBoundary } from "../../public/orders";
import { executeOrderCancellationCommand } from "@/workflows/order-cancellation";
import { getOrderById } from "../../application/queries/orderQueries";
import type { CustomerOrder, OrderDeliveryChannel, OrderItem } from "../../domain/model/order.types";
import { orderRequiresShipping } from "../../domain/rules/orderFulfillment";
import { OrderStatusBadge } from "../components/OrderStatusBadge";
import { OrderCustomerDocument } from "../components/OrderCustomerDocument";
import { resolveOrderHeaderActionIds, type OrderActionId, type OrderActionPermissions } from "../model/orderActionPolicy";
import { useCustomerSnapshots } from "../hooks/useCustomerSnapshots";
import { useOrders } from "../hooks/useOrders";
import { getOrderDetailResource } from "../../application/vertical-slice/orderAuthoritativeQueries";
import { replaceOrders } from "../../public/orders";
import { AuthoritativeQueryBoundary, AuthoritativeQueryNotice, unavailableFeatureMessage, useModuleAuthoritativeResource } from "@/shared/operations";
import { CommercialLineagePanel } from "@/components/crm/CommercialLineagePanel";
import {
  CustomerDocumentDeliveryModal,
  PaymentQrCode,
  createDocumentPdfFromElement,
  downloadDocumentPdf,
  launchDocumentGmailDelivery,
  type CustomerDocumentDeliveryValue,
  type DocumentPdfResult,
  CommercialDocumentPreviewModal,
} from "@/components/crm/commercial-documents";

interface OrderDetailPageProps {
  quotes?: any[];
  deals?: any[];
  contacts?: any[];
  payments: PaymentRepositorySnapshot;
  shippingBookings: ShippingBooking[];
}

const sectionClassName = "rounded-xl border border-slate-200 bg-white p-5 shadow-sm";
const summaryCardClassName = "rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-left";

function formatMoney(value: number | undefined, currency = "VND"): string {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency }).format(value || 0);
}

function formatDate(value: string | undefined, locale: string): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US");
}

function paymentTermLabel(term: string, locale: string): string {
  const vi: Record<string, string> = { DEPOSIT: "Đặt cọc", PREPAID: "Trả trước", POSTPAID: "Trả sau" };
  const en: Record<string, string> = { DEPOSIT: "Deposit", PREPAID: "Prepaid", POSTPAID: "Postpaid" };
  return (locale === "vi" ? vi : en)[term] ?? term;
}

function paymentMethodLabel(method: string, locale: string): string {
  const vi: Record<string, string> = { BANK_TRANSFER: "Chuyển khoản", COD: "COD", EXTERNAL_GATEWAY: "Cổng thanh toán", CARD: "Thẻ", OTHER: "Khác" };
  const en: Record<string, string> = { BANK_TRANSFER: "Bank transfer", COD: "COD", EXTERNAL_GATEWAY: "Payment gateway", CARD: "Card", OTHER: "Other" };
  return (locale === "vi" ? vi : en)[method] ?? method;
}

function operationalBlockerLabel(blocker: string, locale: "vi" | "en"): string {
  if (locale !== "vi") return blocker;
  if (blocker.includes("Required outbound ShippingBooking does not exist")) return "Đơn hàng có hàng vật lý nhưng chưa có vận đơn outbound.";
  if (blocker.includes("is not DELIVERED")) return "Vận đơn bắt buộc chưa có bằng chứng giao hàng thành công.";
  if (blocker.toLowerCase().includes("payment")) return `Thanh toán chưa đủ điều kiện: ${blocker}`;
  return blocker;
}

export const OrderDetailPage: React.FC<OrderDetailPageProps> = ({ contacts = [], payments, shippingBookings }) => {
  const { orderId = "" } = useParams<{ orderId: string }>();
  const workspace = useWorkspaceContextSnapshot();
  const detailQuery = useModuleAuthoritativeResource(getOrderDetailResource(orderId || "__missing__"), { enabled: Boolean(orderId), scopeKey: workspace.workspaceId, onScopeChange: () => replaceOrders({}) });
  const navigate = useNavigate();
  const { locale } = useI18n();
  const operationGuide = {
    title: locale === "vi" ? "Hướng dẫn thao tác Đơn hàng" : "Order operation guide",
    steps: locale === "vi" ? [
      "Kiểm tra thông tin khách hàng, hàng hóa và điều khoản thanh toán.",
      "Hoàn tất các điều kiện thanh toán hoặc vận đơn đang chặn xử lý.",
      "Dùng hành động chính ở header; các thao tác còn lại nằm trong menu ba chấm.",
      "Trong tab Tài liệu, mở Xem trước để kiểm tra nội dung trước khi xuất hoặc gửi.",
      "Xác nhận đã gửi để lưu bằng chứng và kênh giao tiếp với khách hàng.",
    ] : [
      "Review customer, line items, and payment terms.",
      "Resolve payment or shipping prerequisites that block processing.",
      "Use the primary header action; all other actions are in the three-dot menu.",
      "In Documents, open the preview before exporting or sending.",
      "Confirm delivery to retain customer communication evidence.",
    ],
    tips: locale === "vi" ? [
      "Không lặp lại nút xuất/gửi trong tab và cửa sổ xem trước.",
      "PDF, Gmail và bản xem trước dùng chung một nội dung tài liệu.",
    ] : [
      "Export/send actions are not duplicated inside the tab or preview dialog.",
      "PDF, Gmail, and preview share the same document content.",
    ],
  } as const;
  const access = useEffectiveAccess();
  const effectiveRecordAccess = useEffectiveRecordAccessDecision();
  const { session } = usePlatformState();
  const { orders } = useOrders({ loadAuthoritative: false });
  const customers = useCustomerSnapshots();
  const [cancelOpen, setCancelOpen] = useState(false);
  const cancellationReasons = getReasonCatalog("ORDER_CANCELLATION")?.entries.filter((entry) => entry.enabled) ?? [];
  const [cancelReasonCode, setCancelReasonCode] = useState(cancellationReasons[0]?.code ?? "");
  const [cancelReason, setCancelReason] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState("OVERVIEW");
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [documentPreviewOpen, setDocumentPreviewOpen] = useState(false);
  const [deliveryChannel, setDeliveryChannel] = useState<OrderDeliveryChannel>("ZALO");
  const [deliveryChannelLocked, setDeliveryChannelLocked] = useState(false);
  const [deliveryFileName, setDeliveryFileName] = useState<string | undefined>();
  const [exportBusy, setExportBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const documentRef = useRef<HTMLDivElement | null>(null);

  const order = useMemo(() => orderId ? getOrderById(orders, orderId) : undefined, [orderId, orders]);
  const customer = useMemo(() => order ? customers.find((item) => item.id === order.customerId) : undefined, [customers, order]);
  const contact = useMemo(() => order ? contacts.find((item) => item.id === order.contactId) : undefined, [contacts, order]);

  if (!order) {
    return (
      <AuthoritativeQueryBoundary
        query={detailQuery}
        hasData={false}
        loadingTitleVi="Đang tải đơn hàng từ backend"
        loadingTitleEn="Loading order from backend"
        errorTitleVi="Không thể tải đơn hàng"
        errorTitleEn="Order could not be loaded"
        showNotice={false}
      >
        <div className="mx-auto max-w-2xl p-8 text-center">
          <AlertCircle className="mx-auto text-rose-500" size={32} />
          <h2 className="mt-3 text-lg font-semibold text-slate-800">{locale === "vi" ? "Không tìm thấy đơn hàng" : "Order not found"}</h2>
          <Button className="mt-4" variant="secondary" onClick={() => navigate("/orders")}>{locale === "vi" ? "Quay lại danh sách" : "Back to Orders"}</Button>
        </div>
      </AuthoritativeQueryBoundary>
    );
  }

  const customerLabel = customer?.displayName || customer?.companyName || customer?.individualName || customer?.name || order.customerName || "—";
  const contactLabel = contact?.fullName || contact?.name || order.contactName || "—";
  const orderShipping = shippingBookings.filter((booking) => booking.sourceType === "ORDER" && booking.sourceId === order.id);
  const shippingRequired = orderRequiresShipping(order);
  const paymentSummary = projectPaymentSummaryFromSnapshot(payments, order.id, order.grandTotal ?? order.totalAmount ?? 0, order.currency ?? "VND");
  const paymentObligations = getPaymentObligationsForOrder(payments, order.id);
  const bookingPaymentReadiness = evaluatePaymentFulfillmentGateSnapshot(payments, order.id, "BEFORE_BOOKING");
  const paymentReadiness = evaluatePaymentFulfillmentGateSnapshot(payments, order.id, "BEFORE_COMPLETION");
  const completionEvaluation = evaluateOrderClosingPolicy(order, paymentReadiness, orderShipping);
  useSubscribableSnapshot(getInvoicesSnapshot, subscribeToInvoices);
  const relatedInvoices = queryInvoiceSnapshot({ orderId: order.id });
  const relatedReceivables = getReceivablesSnapshot().filter((item) => relatedInvoices.some((invoice) => invoice.id === item.invoiceId));
  const relatedReturns = getReturnsSnapshot().requests.filter((request) => request.orderId === order.id);
  const deliveredBookingRecords = orderShipping.filter((booking) => booking.externalStatus === "DELIVERED" && booking.deliveredAt);
  const deliveredBookings = deliveredBookingRecords.length;
  const activeReturnCount = relatedReturns.filter((request) => !["CLOSED", "REJECTED"].includes(request.status)).length;
  const terminalOrder = ["COMPLETED", "CANCELLED"].includes(order.state);
  const operationalBlockers = order.state === "DRAFT"
    ? [locale === "vi" ? "Đơn hàng đang ở trạng thái Nháp. Nhân viên có quyền cần xác nhận vận hành để kích hoạt kế hoạch thanh toán." : "The Order is Draft. An authorized employee must confirm it to activate the Payment Plan."]
    : order.state === "CONFIRMED" && !completionEvaluation.ready
      ? completionEvaluation.blockers.map((blocker) => operationalBlockerLabel(blocker, locale))
      : [];
  const shippingProgressScore = !shippingRequired ? 25 : orderShipping.length === 0 ? 0 : Math.round((deliveredBookings / Math.max(1, orderShipping.length)) * 25);
  const operationalScore = terminalOrder
    ? 100
    : Math.min(95, (order.state === "CONFIRMED" ? 25 : 0) + (paymentReadiness.ready ? 25 : 0) + shippingProgressScore + (completionEvaluation.ready ? 25 : 0));
  const detailTabs = [
    { key: "OVERVIEW", label: locale === "vi" ? "Tổng quan" : "Overview", icon: <ShoppingBag size={14} /> },
    { key: "ITEMS", label: locale === "vi" ? "Hàng hóa" : "Items", icon: <Package size={14} />, count: order.items.length },
    { key: "PAYMENT", label: locale === "vi" ? "Thanh toán" : "Payment", icon: <CreditCard size={14} />, count: paymentObligations.length, alert: !paymentReadiness.ready },
    { key: "INVOICES", label: locale === "vi" ? "Hóa đơn & công nợ" : "Invoices & receivables", icon: <ReceiptText size={14} />, count: relatedInvoices.length },
    { key: "SHIPPING", label: locale === "vi" ? "Vận đơn" : "Shipping", icon: <Truck size={14} />, count: orderShipping.length },
    { key: "RETURNS", label: locale === "vi" ? "Đổi / Trả" : "Returns", icon: <RotateCcw size={14} />, count: relatedReturns.length, alert: activeReturnCount > 0 },
    { key: "DOCUMENT", label: locale === "vi" ? "Tài liệu" : "Documents", icon: <FileText size={14} />, count: order.deliveryHistory?.length || undefined },
    { key: "ACTIVITY", label: locale === "vi" ? "Hoạt động" : "Activity", icon: <ClipboardList size={14} /> },
  ];
  const lifecycleSteps = [
    { key: "draft", label: locale === "vi" ? "Nháp thương mại" : "Commercial draft", description: formatDate(order.createdAt || order.orderDate, locale), state: order.state === "DRAFT" ? "current" as const : "done" as const },
    { key: "confirmed", label: locale === "vi" ? "Đã xác nhận" : "Confirmed", description: order.confirmedAt ? formatDate(order.confirmedAt, locale) : (locale === "vi" ? "Chờ xác nhận đơn hàng và kế hoạch thanh toán" : "Awaiting Order and Payment Plan confirmation"), state: order.state === "DRAFT" ? "next" as const : order.state === "CONFIRMED" ? "current" as const : "done" as const },
    { key: "payment", label: locale === "vi" ? "Điều kiện thanh toán" : "Payment readiness", description: paymentReadiness.ready ? (locale === "vi" ? "Không còn blocker thanh toán bắt buộc" : "No mandatory payment blocker") : (locale === "vi" ? "Còn kỳ thanh toán chặn fulfillment" : "Blocking payment schedule line remains"), state: order.state === "DRAFT" ? "next" as const : paymentReadiness.ready ? "done" as const : "blocked" as const },
    { key: "fulfillment", label: locale === "vi" ? "Giao hàng / thực hiện" : "Fulfillment", description: !shippingRequired ? (locale === "vi" ? "Đơn dịch vụ hoặc số hóa, không cần vận đơn" : "Service or digital Order; no shipment required") : orderShipping.length > 0 ? `${deliveredBookings}/${orderShipping.length} ${locale === "vi" ? "vận đơn đã giao" : "shipments delivered"}` : (locale === "vi" ? "Chưa tạo vận đơn" : "No shipment created"), state: order.state === "DRAFT" ? "next" as const : !shippingRequired ? "skipped" as const : orderShipping.length > 0 && deliveredBookings === orderShipping.length ? "done" as const : orderShipping.length > 0 ? "current" as const : "next" as const },
    { key: "complete", label: locale === "vi" ? "Hoàn tất đơn hàng" : "Order completion", description: terminalOrder ? order.state : (locale === "vi" ? "Chỉ hoàn tất khi đủ evidence" : "Completes only with evidence"), state: terminalOrder ? "done" as const : order.state === "DRAFT" ? "next" as const : completionEvaluation.ready ? "current" as const : "next" as const },
  ];

  const serverAllows = (command: string) => !effectiveRecordAccess || effectiveRecordAccess.allowedCommands.includes(command);
  const permissions: OrderActionPermissions = {
    canView: access.canPerform("orders", "read") && (effectiveRecordAccess?.canRead ?? true),
    canUpdate: access.canPerform("orders", "update") && (effectiveRecordAccess?.canUpdate ?? true) && serverAllows("order.update"),
    canCreate: access.canPerform("orders", "create") && serverAllows("order.create"),
    canDelete: access.canPerform("orders", "delete") && (effectiveRecordAccess?.canDelete ?? true) && serverAllows("order.delete"),
    canConfirm: access.canPerform("orders", "confirm") && access.canAccessRecord("orders", order) && serverAllows("order.confirm"),
    canComplete: access.canPerform("orders", "complete") && serverAllows("order.complete"),
    canCreateShipping: access.canPerform("shipping", "create") && serverAllows("shipping.create"),
    canRecordPayment: access.can(CAPABILITIES.PAYMENTS_RECORD_MANUAL) && serverAllows("payments.record"),
    canCreateInvoice: access.canPerform("invoices", "create") && serverAllows("invoices.create"),
  };
  const canCreateShippingNow = permissions.canCreateShipping
    && order.state === "CONFIRMED"
    && shippingRequired
    && bookingPaymentReadiness.ready;
  const createShippingReason = !shippingRequired
    ? (locale === "vi" ? "Đơn hàng chỉ có sản phẩm dịch vụ/số hóa nên không cần vận đơn." : "This Order contains only service/digital lines, so no shipment is required.")
    : order.state === "DRAFT"
      ? (locale === "vi" ? "Hãy xác nhận vận hành Đơn hàng trước khi tạo vận đơn." : "Confirm the Order operationally before creating a shipment.")
      : order.state !== "CONFIRMED"
        ? (locale === "vi" ? "Chỉ Đơn hàng Đã xác nhận mới được tạo vận đơn." : "Only a Confirmed Order can create a shipment.")
        : !bookingPaymentReadiness.ready
          ? (locale === "vi" ? "Kỳ thanh toán đang chặn việc tạo vận đơn." : "A payment schedule line is blocking shipment creation.")
          : undefined;

  const headerActionIds = resolveOrderHeaderActionIds(order, permissions, {
    completionReady: completionEvaluation.ready,
  });

  const getCustomerDocumentElement = async (): Promise<HTMLDivElement> => {
    if (!documentRef.current) {
      setActiveTab("DOCUMENT");
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())));
    }
    if (!documentRef.current) throw new Error(locale === "vi" ? "Không thể mở tài liệu đơn hàng để xuất PDF." : "The Order document is unavailable for PDF export.");
    return documentRef.current;
  };

  const createOrderPdf = async (): Promise<DocumentPdfResult> => {
    const element = await getCustomerDocumentElement();
    return createDocumentPdfFromElement(element, `${locale === "vi" ? "Don-hang" : "Order"}-${order.orderNumber}.pdf`);
  };

  const handleExportPdf = async () => {
    setExportBusy(true);
    try {
      const pdf = await createOrderPdf();
      downloadDocumentPdf(pdf);
      setMessage({ tone: "success", text: locale === "vi" ? "Đã tạo PDF đơn hàng, bao gồm QR chuyển khoản khi cấu hình thanh toán cho phép." : "The Order PDF was generated, including the bank-transfer QR when payment configuration allows it." });
    } catch (error) {
      setMessage({ tone: "error", text: formatApplicationError(error, { locale }) });
    } finally {
      setExportBusy(false);
    }
  };

  const handleSendGmail = async () => {
    const recipientEmail = (order.recipientEmail || contact?.email || "").trim();
    if (!/^\S+@\S+\.\S+$/.test(recipientEmail)) {
      setMessage({ tone: "error", text: locale === "vi" ? "Đơn hàng cần email người nhận hợp lệ trước khi gửi qua Gmail." : "A valid recipient email is required before sending the Order with Gmail." });
      setActiveTab("OVERVIEW");
      return;
    }
    setSendBusy(true);
    try {
      const pdf = await createOrderPdf();
      await launchDocumentGmailDelivery({
        recipientEmail,
        subject: locale === "vi" ? `Đơn hàng ${order.orderNumber}` : `Order ${order.orderNumber}`,
        body: locale === "vi"
          ? `Kính gửi Quý khách,\n\nVui lòng xem Đơn hàng ${order.orderNumber} đính kèm. Thông tin thanh toán và QR chuyển khoản (nếu có) đã được chụp theo cấu hình tại thời điểm xác nhận đơn.\n\nTrân trọng.`
          : `Hello,\n\nPlease review attached Order ${order.orderNumber}. Payment instructions and the bank-transfer QR (when applicable) are captured from the configuration effective at Order confirmation.\n\nRegards.`,
        pdf,
        attachmentInstruction: locale === "vi"
          ? `Tệp PDF đã được tải xuống từ CRM. Hãy đính kèm tệp ${pdf.fileName}, gửi email rồi xác nhận lại trong CRM.`
          : `The PDF was downloaded from CRM. Attach ${pdf.fileName}, send the email, then confirm delivery in CRM.`,
      });
      setDeliveryChannel("GMAIL");
      setDeliveryChannelLocked(true);
      setDeliveryFileName(pdf.fileName);
      setDeliveryOpen(true);
      setMessage({ tone: "success", text: locale === "vi" ? "Đã chuẩn bị Gmail và PDF tài liệu đơn hàng. Sau khi gửi tài liệu, hãy xác nhận để lưu bằng chứng liên hệ." : "Gmail and the Order document PDF are ready. Confirm after sending the document to retain contact evidence." });
    } catch (error) {
      setMessage({ tone: "error", text: formatApplicationError(error, { locale }) });
    } finally {
      setSendBusy(false);
    }
  };

  const openDeliveryConfirmation = () => {
    setDeliveryChannel("ZALO");
    setDeliveryChannelLocked(false);
    setDeliveryFileName(undefined);
    setDeliveryOpen(true);
  };

  const confirmOrderDelivery = async (value: CustomerDocumentDeliveryValue) => {
    const updated = (await recordOrderDeliveryCommandBoundary(order.id, {
      id: createDurableId("order_delivery"),
      ...value,
      evidenceType: "USER_CONFIRMED_SENT",
      sentBy: session.principal.memberId,
    })).data;
    setDeliveryOpen(false);
    setMessage({ tone: "success", text: locale === "vi" ? "Đã xác nhận tài liệu đơn hàng được gửi và lưu bằng chứng kênh liên hệ." : "Order document delivery was confirmed with channel evidence." });
  };

  const completeOrder = async () => {
    // WF-12 order-closing is BLOCKED with `connectedFrontendCoordinatorAllowed: false`.
    // Refuse on WF-12 before the command so the user is told the action is unavailable
    // instead of the boundary assertion throwing out of the click handler.
    if (isOrderClosingUnavailable()) {
      setMessage({ tone: "error", text: unavailableFeatureMessage({ vi: "Chưa thể hoàn tất đơn hàng", en: "The Order cannot be completed yet" }, { locale }) });
      return;
    }
    const result = (await executeOrderClosingCommand({ orderIds: [order.id] })).data;
    const blocked = result.blocked.find((item) => item.orderId === order.id);
    if (result.completedIds.includes(order.id) || result.alreadyCompletedIds.includes(order.id)) setMessage({
      tone: "success",
      text: shippingRequired
        ? (locale === "vi" ? "Đơn hàng đã hoàn tất sau khi đủ điều kiện thanh toán và bằng chứng giao hàng." : "The Order was completed after payment readiness and shipping evidence were satisfied.")
        : (locale === "vi" ? "Đơn hàng đã hoàn tất sau khi đủ điều kiện thanh toán và thực hiện; không phát sinh vận đơn." : "The Order was completed after payment and fulfillment conditions were satisfied; no shipment was required."),
    });
    else setMessage({ tone: "error", text: blocked?.blockers.join(" ") || "Order completion blocked." });
  };

  const confirmOrder = async () => {
    try {
      await executeOrderConfirmationCommand(
        { orderId: order.id },
        order.resourceVersion === undefined ? {} : { expectedVersion: order.resourceVersion },
      );
      setMessage({
        tone: "success",
        text: locale === "vi" ? "Đã xác nhận vận hành đơn hàng và kích hoạt kế hoạch thanh toán." : "Order operationally confirmed and Payment Plan activated.",
      });
    } catch (error) {
      setMessage({ tone: "error", text: formatApplicationError(error, { locale }) });
    }
  };

  const confirmCancellation = async () => {
    if (!cancelReasonCode || !cancelReason.trim()) return;
    try {
      await executeOrderCancellationCommand(
        {
          orderId: order.id,
          reasonCode: cancelReasonCode,
          reason: cancelReason.trim(),
        },
        order.resourceVersion === undefined ? {} : { expectedVersion: order.resourceVersion },
      );
      setCancelOpen(false);
      setCancelReasonCode(cancellationReasons[0]?.code ?? "");
      setCancelReason("");
      setMessage({ tone: "success", text: locale === "vi" ? "Đã hủy đơn hàng và đóng kế hoạch thanh toán liên quan." : "Order and its related Payment Plan were cancelled." });
    } catch (error) {
      setMessage({ tone: "error", text: formatApplicationError(error, { locale }) });
    }
  };

  const renderHeaderAction = (id: string) => {
    if (id === "confirm") return <Button key={id} variant="primary" size="sm" className={recordDetailHeaderActionButtonClassName} onClick={() => { void confirmOrder(); }}><CheckCircle2 size={14} />{locale === "vi" ? "Xác nhận vận hành" : "Confirm operationally"}</Button>;
    if (id === "edit") return <Button key={id} variant="secondary" size="sm" className={recordDetailHeaderActionButtonClassName} onClick={() => navigate(`/orders/${order.id}/edit`)}><Edit3 size={14} />{locale === "vi" ? "Chỉnh sửa" : "Edit"}</Button>;
    if (id === "create-shipping") return <Button key={id} variant="primary" size="sm" className={recordDetailHeaderActionButtonClassName} onClick={() => navigate(`/shipping/new?orderId=${order.id}`)}><Truck size={14} />{locale === "vi" ? "Tạo vận đơn" : "Create Shipping"}</Button>;
    if (id === "create-invoice") return <Button key={id} variant="primary" size="sm" className={recordDetailHeaderActionButtonClassName} onClick={() => navigate(`/invoices/new?orderId=${order.id}`)}><ReceiptText size={14} />{locale === "vi" ? "Tạo hóa đơn" : "Create invoice"}</Button>;
    if (id === "record-payment") return <Button key={id} variant="info" size="sm" className={recordDetailHeaderActionButtonClassName} onClick={() => navigate(`/payments?action=record&orderId=${order.id}`)}><CreditCard size={14} />{locale === "vi" ? "Ghi nhận thanh toán" : "Record payment"}</Button>;
    if (id === "send") return <Button key={id} variant="primary" size="sm" loading={sendBusy} className={recordDetailHeaderActionButtonClassName} onClick={() => { void handleSendGmail(); }}><Send size={14} />{locale === "vi" ? "Gửi qua Gmail" : "Send with Gmail"}</Button>;
    if (id === "confirm-sent") return <Button key={id} variant="success" size="sm" className={recordDetailHeaderActionButtonClassName} onClick={openDeliveryConfirmation}><MessageCircle size={14} />{locale === "vi" ? "Xác nhận đã gửi" : "Confirm sent"}</Button>;
    if (id === "export-pdf") return <Button key={id} variant="info" size="sm" loading={exportBusy} className={recordDetailHeaderActionButtonClassName} onClick={() => { void handleExportPdf(); }}><Download size={14} />{locale === "vi" ? "Xuất PDF" : "Export PDF"}</Button>;
    if (id === "complete") return <Button key={id} variant="primary" size="sm" className={recordDetailHeaderActionButtonClassName} onClick={() => { void completeOrder(); }}><CheckCircle2 size={14} />{locale === "vi" ? "Hoàn tất" : "Complete"}</Button>;
    if (id === "cancel") return <Button key={id} variant="danger" size="sm" className={recordDetailHeaderActionButtonClassName} onClick={() => setCancelOpen(true)}><X size={14} />{locale === "vi" ? "Hủy đơn" : "Cancel"}</Button>;
    if (id === "duplicate") return <Button key={id} variant="secondary" size="sm" className={recordDetailHeaderActionButtonClassName} onClick={() => navigate(`/orders/new?duplicateId=${order.id}`)}><Copy size={14} />{locale === "vi" ? "Nhân bản" : "Duplicate"}</Button>;
    return null;
  };


  const primaryHeaderActionId = (["confirm", "complete", "create-invoice", "create-shipping", "record-payment", "send", "edit"] as OrderActionId[])
    .find((id) => headerActionIds.includes(id));

  const headerMenuItem = (id: string): ActionDropdownItem | null => {
    if (id === "edit") return { id, label: locale === "vi" ? "Chỉnh sửa" : "Edit", icon: <Edit3 size={14} />, onClick: () => navigate(`/orders/${order.id}/edit`) };
    if (id === "confirm") return { id, label: locale === "vi" ? "Xác nhận vận hành" : "Confirm operationally", icon: <CheckCircle2 size={14} />, onClick: () => { void confirmOrder(); }, variant: "primary" };
    if (id === "create-shipping") return { id, label: locale === "vi" ? "Tạo vận đơn" : "Create Shipping", icon: <Truck size={14} />, onClick: () => navigate(`/shipping/new?orderId=${order.id}`), variant: "primary" };
    if (id === "create-invoice") return { id, label: locale === "vi" ? "Tạo hóa đơn" : "Create invoice", icon: <ReceiptText size={14} />, onClick: () => navigate(`/invoices/new?orderId=${order.id}`), variant: "primary" };
    if (id === "record-payment") return { id, label: locale === "vi" ? "Ghi nhận thanh toán" : "Record payment", icon: <CreditCard size={14} />, onClick: () => navigate(`/payments?action=record&orderId=${order.id}`), variant: "info" };
    if (id === "send") return { id, label: locale === "vi" ? "Gửi tài liệu qua Gmail" : "Send document with Gmail", icon: <Send size={14} />, onClick: () => { void handleSendGmail(); }, disabled: sendBusy, variant: "primary" };
    if (id === "confirm-sent") return { id, label: locale === "vi" ? "Xác nhận đã gửi" : "Confirm sent", icon: <MessageCircle size={14} />, onClick: openDeliveryConfirmation, variant: "success" };
    if (id === "export-pdf") return { id, label: locale === "vi" ? "Xuất PDF" : "Export PDF", icon: <Download size={14} />, onClick: () => { void handleExportPdf(); }, disabled: exportBusy, variant: "info" };
    if (id === "complete") return { id, label: locale === "vi" ? "Hoàn tất" : "Complete", icon: <CheckCircle2 size={14} />, onClick: completeOrder, variant: "success" };
    if (id === "cancel") return { id, label: locale === "vi" ? "Hủy đơn" : "Cancel", icon: <X size={14} />, onClick: () => setCancelOpen(true), destructive: true };
    if (id === "duplicate") return { id, label: locale === "vi" ? "Nhân bản" : "Duplicate", icon: <Copy size={14} />, onClick: () => navigate(`/orders/new?duplicateId=${order.id}`) };
    return null;
  };

  const headerMenuSections: ActionDropdownSection[] = [
    {
      id: "document",
      title: locale === "vi" ? "TÀI LIỆU KHÁCH HÀNG" : "CUSTOMER DOCUMENT",
      items: [
        { id: "preview-a4", label: locale === "vi" ? "Xem trước" : "Preview", icon: <Eye size={14} />, onClick: () => setDocumentPreviewOpen(true) },
        ...headerActionIds.filter((id) => ["export-pdf", "send", "confirm-sent"].includes(id) && id !== primaryHeaderActionId).map(headerMenuItem).filter((item): item is ActionDropdownItem => Boolean(item)),
      ],
    },
    {
      id: "operations",
      title: locale === "vi" ? "THAO TÁC ĐƠN HÀNG" : "ORDER ACTIONS",
      items: headerActionIds.filter((id) => !["export-pdf", "send", "confirm-sent"].includes(id) && id !== primaryHeaderActionId).map(headerMenuItem).filter((item): item is ActionDropdownItem => Boolean(item)),
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
      <AuthoritativeQueryNotice connected={detailQuery.connected} loading={detailQuery.loading} refreshing={detailQuery.refreshing} stale={detailQuery.stale} loadedAt={detailQuery.loadedAt} error={detailQuery.error} onRefresh={() => void detailQuery.refresh()} compact />
      <RecordDetailFrame id="order-detail-frame">
        <RecordDetailHeader
          id="order-detail-header"
          backLabel={locale === "vi" ? "Quay lại danh sách đơn hàng" : "Back to Orders"}
          onBack={() => navigate("/orders")}
          identityIcon={<ShoppingBag size={20} />}
          identityToneClassName="border-sky-200 bg-sky-50 text-sky-700"
          title={order.orderNumber}
          status={<OrderStatusBadge state={order.state} />}
          metadata={<><span>{customerLabel}</span><span>{order.sourceQuoteNumber ? `${locale === "vi" ? "Báo giá" : "Quote"}: ${order.sourceQuoteNumber}` : order.sourceDealName ? `${locale === "vi" ? "Cơ hội" : "Opportunity"}: ${order.sourceDealName}` : (locale === "vi" ? "Đơn trực tiếp" : "Direct Order")}</span><span>{formatDate(order.orderDate, locale)}</span></>}
          actions={(
            <div className="flex items-center gap-2">
              {primaryHeaderActionId ? renderHeaderAction(primaryHeaderActionId) : null}
              <RecordHeaderActionMenu
                sections={headerMenuSections}
                label={locale === "vi" ? "Thao tác khác" : "More actions"}
                audit={{
                  resourceKey: "orders",
                  recordId: order.id,
                  title: locale === "vi" ? "Kiểm toán Đơn hàng" : "Order audit",
                  label: locale === "vi" ? "Xem lịch sử kiểm toán" : "View audit history",
                  sectionTitle: locale === "vi" ? "KIỂM SOÁT" : "GOVERNANCE",
                  closeLabel: locale === "vi" ? "Đóng" : "Close",
                }}
                guide={operationGuide}
                guideLabel={locale === "vi" ? "Hướng dẫn thao tác" : "Operation guide"}
                closeGuideLabel={locale === "vi" ? "Đã hiểu" : "Got it"}
              />
            </div>
          )}
          actionsPlacement="inline"
        />

        {message && <div role="status" className={`rounded-xl border px-4 py-3 text-xs font-semibold ${message.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>{message.text}</div>}

        <div aria-hidden="true" className="pointer-events-none fixed left-[-12000px] top-0 z-[-1] w-[1000px]">
          <OrderCustomerDocument ref={documentRef} order={order} customer={customer} contact={contact} customerLabel={customerLabel} contactLabel={contactLabel} locale={locale} />
        </div>

        <OperationDetailTabs items={detailTabs} activeKey={activeTab} onChange={setActiveTab} ariaLabel={locale === "vi" ? "Khu vực chi tiết đơn hàng" : "Order detail areas"} />

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="min-w-0">
            <RecordTabTransition transitionKey={activeTab} axis="x" minHeightClassName="min-h-[420px]" className="space-y-5">
            {activeTab === "OVERVIEW" && <>
              <section className={sectionClassName} data-order-detail-section="summary">
                <SectionHeader title={locale === "vi" ? "Tổng quan đơn hàng" : "Order summary"} icon={<ShoppingBag size={14} />} />
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className={summaryCardClassName}><div className="text-xs font-bold uppercase tracking-wider text-slate-400">{locale === "vi" ? "Tổng giá trị" : "Total value"}</div><div className="mt-1 text-lg font-semibold text-slate-900">{formatMoney(order.grandTotal ?? order.totalAmount, order.currency)}</div></div>
                  <div className={summaryCardClassName}><div className="text-xs font-bold uppercase tracking-wider text-slate-400">{locale === "vi" ? "Ngày đặt" : "Order date"}</div><div className="mt-1 text-sm font-semibold text-slate-800">{formatDate(order.orderDate, locale)}</div></div>
                  <div className={summaryCardClassName}><div className="text-xs font-bold uppercase tracking-wider text-slate-400">{locale === "vi" ? "Dự kiến giao" : "Expected delivery"}</div><div className="mt-1 text-sm font-semibold text-slate-800">{formatDate(order.expectedDeliveryDate, locale)}</div></div>
                  <div className={summaryCardClassName}><div className="text-xs font-bold uppercase tracking-wider text-slate-400">{locale === "vi" ? "Người phụ trách" : "Owner"}</div><div className="mt-1 text-sm font-semibold text-slate-800">{order.ownerName || "—"}</div></div>
                </div>
              </section>

              <section className={sectionClassName} data-order-detail-section="customer-recipient">
                <SectionHeader title={locale === "vi" ? "Khách hàng & Người nhận" : "Customer & Recipient"} icon={<UserRound size={14} />} />
                <div className="grid gap-4 md:grid-cols-2">
                  <div className={summaryCardClassName}><div className="text-xs font-bold uppercase tracking-wider text-slate-400">{locale === "vi" ? "Khách hàng" : "Customer"}</div>{order.customerId ? <button type="button" onClick={() => navigate(`/customers/${order.customerId}`)} className="mt-1 text-left text-sm font-semibold text-slate-800 hover:text-violet-700 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">{customerLabel}</button> : <div className="mt-1 text-sm font-semibold text-slate-800">{customerLabel}</div>}<div className="mt-1 text-xs text-slate-500">{contactLabel}</div></div>
                  <div className={summaryCardClassName}><div className="text-xs font-bold uppercase tracking-wider text-slate-400">{locale === "vi" ? "Người nhận" : "Recipient"}</div><div className="mt-1 text-sm font-semibold text-slate-800">{order.recipientName || "—"}</div><div className="mt-1 text-xs text-slate-500">{order.recipientPhone || "—"} · {order.shippingAddress ? `${order.shippingAddress.line1}, ${order.shippingAddress.city}` : "—"}</div></div>
                </div>
              </section>

              <section className={sectionClassName} data-order-detail-section="flow-summary">
                <SectionHeader title={locale === "vi" ? "Dòng chảy vận hành" : "Operational flow"} icon={<ClipboardList size={14} />} />
                <div className="grid gap-3 md:grid-cols-3">
                  <button type="button" onClick={() => setActiveTab("PAYMENT")} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-violet-200 hover:bg-white hover:shadow-sm"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><CreditCard size={16} /></span><span className={`rounded-full px-2 py-1 text-xs font-semibold ${paymentReadiness.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{paymentReadiness.ready ? "READY" : "ACTION"}</span></div><div className="mt-4 text-xs font-semibold text-slate-900">{locale === "vi" ? "Thanh toán" : "Payments"}</div><div className="mt-1 text-xs font-medium text-slate-500">{locale === "vi" ? `${formatMoney(paymentSummary.outstandingAmount, paymentSummary.currency)} còn theo lịch` : `${formatMoney(paymentSummary.outstandingAmount, paymentSummary.currency)} remaining in schedule`}</div></button>
                  <button type="button" onClick={() => setActiveTab("SHIPPING")} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-sky-200 hover:bg-white hover:shadow-sm"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><Truck size={16} /></span><span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700">{deliveredBookings}/{orderShipping.length || 0}</span></div><div className="mt-4 text-xs font-semibold text-slate-900">{locale === "vi" ? "Vận đơn" : "Shipping"}</div><div className="mt-1 text-xs font-medium text-slate-500">{orderShipping.length === 0 ? (locale === "vi" ? "Chưa có đợt giao hàng" : "No shipment yet") : (locale === "vi" ? `${orderShipping.length} lần giao hàng liên quan` : `${orderShipping.length} related shipment(s)`)}</div></button>
                  <button type="button" onClick={() => setActiveTab("RETURNS")} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-amber-200 hover:bg-white hover:shadow-sm"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><RotateCcw size={16} /></span><span className={`rounded-full px-2 py-1 text-xs font-semibold ${activeReturnCount > 0 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{activeReturnCount}</span></div><div className="mt-4 text-xs font-semibold text-slate-900">{locale === "vi" ? "Đổi / Trả" : "Returns"}</div><div className="mt-1 text-xs font-medium text-slate-500">{locale === "vi" ? `${relatedReturns.length} hồ sơ liên quan` : `${relatedReturns.length} related case(s)`}</div></button>
                </div>
              </section>
            </>}

            {activeTab === "ITEMS" && <section className={sectionClassName} data-order-detail-section="lines">
              <SectionHeader title={locale === "vi" ? "Sản phẩm / Dòng đơn hàng" : "Products / Order lines"} icon={<Package size={14} />} />
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <Table className="min-w-[860px]">
                  <TableHeader><TableRow><TableCell isHeader>{locale === "vi" ? "Sản phẩm" : "Product"}</TableCell><TableCell isHeader>SKU</TableCell><TableCell isHeader className="text-right">{locale === "vi" ? "Số lượng" : "Qty"}</TableCell><TableCell isHeader className="text-right">{locale === "vi" ? "Đơn giá" : "Unit price"}</TableCell><TableCell isHeader className="text-right">{locale === "vi" ? "Chiết khấu" : "Discount"}</TableCell><TableCell isHeader className="text-right">{locale === "vi" ? "Thành tiền" : "Amount"}</TableCell></TableRow></TableHeader>
                  <TableBody>{order.items.map((item: OrderItem) => <TableRow key={item.id}><TableCell><div className="font-bold text-slate-800">{item.productNameSnapshot || item.name}</div></TableCell><TableCell className="font-mono text-xs text-slate-500">{item.skuSnapshot || "—"}</TableCell><TableCell className="text-right whitespace-nowrap">{item.quantity}</TableCell><TableCell className="text-right whitespace-nowrap">{formatMoney(item.unitPriceSnapshot ?? item.price, order.currency)}</TableCell><TableCell className="text-right whitespace-nowrap">{item.discountPercent || 0}%</TableCell><TableCell className="text-right whitespace-nowrap font-bold">{formatMoney(item.lineTotal, order.currency)}</TableCell></TableRow>)}</TableBody>
                </Table>
              </div>
            </section>}

            {activeTab === "PAYMENT" && <section className={sectionClassName} data-order-detail-section="payment-summary">
              <SectionHeader title={locale === "vi" ? "Thanh toán" : "Payment summary"} icon={<CreditCard size={14} />} actions={<Button variant="secondary" size="xs" onClick={() => navigate(`/payments?focus=schedules&orderId=${order.id}`)}>{locale === "vi" ? "Mở workspace Thanh toán" : "Open Payments"}</Button>} />
              {order.paymentInstruction && (
                <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-4" data-order-payment-instruction="snapshot">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-slate-900">{locale === "vi" ? "Hướng dẫn thanh toán đã chụp" : "Captured payment instruction"}</div>
                        <Badge variant="info" size="xs">{paymentMethodLabel(order.paymentInstruction.method, locale)}</Badge>
                        <span className="text-xs font-bold text-slate-400">REV {order.paymentInstruction.configurationVersion ?? "—"}</span>
                      </div>
                      {order.paymentInstruction.bankAccount ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-violet-100 bg-white p-3">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{order.paymentInstruction.bankAccount.bankName}</div>
                            <div className="mt-1 font-mono text-base font-semibold text-slate-900">{order.paymentInstruction.bankAccount.accountNumber}</div>
                            <div className="mt-1 text-xs font-bold text-slate-600">{order.paymentInstruction.bankAccount.accountName}</div>
                            <Button type="button" variant="ghost" size="xs" className="mt-2" onClick={() => navigator.clipboard?.writeText(order.paymentInstruction?.bankAccount?.accountNumber || "")}><Copy size={12} />{locale === "vi" ? "Sao chép tài khoản" : "Copy account"}</Button>
                          </div>
                          <div className="rounded-xl border border-violet-100 bg-white p-3">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{locale === "vi" ? "Nội dung chuyển khoản" : "Transfer content"}</div>
                            <div className="mt-1 break-words text-sm font-semibold text-slate-900">{order.paymentInstruction.transferContent}</div>
                            <div className="mt-1 text-xs text-slate-500">{formatMoney(order.paymentInstruction.amount, order.currency)}</div>
                            <Button type="button" variant="ghost" size="xs" className="mt-2" onClick={() => navigator.clipboard?.writeText(order.paymentInstruction?.transferContent || "")}><Copy size={12} />{locale === "vi" ? "Sao chép nội dung" : "Copy content"}</Button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs font-medium text-amber-700">{locale === "vi" ? "Bản ghi tại thời điểm xác nhận chưa có tài khoản nhận tiền. Cấu hình workspace mới chỉ áp dụng cho đơn hàng được tạo hoặc cập nhật sau." : "This snapshot has no receiving account. New workspace settings apply only to Orders created or explicitly updated later."}</p>
                      )}
                    </div>
                    {order.paymentInstruction.qrPayload && (
                      <div className="shrink-0 text-center" data-order-detail-qr="bank-transfer">
                        <PaymentQrCode payload={order.paymentInstruction.qrPayload} alt={locale === "vi" ? `QR chuyển khoản cho ${order.orderNumber}` : `Bank transfer QR for ${order.orderNumber}`} className="h-36 w-36 rounded-xl border border-violet-200 p-2" />
                        <div className="mt-2 text-xs font-bold text-slate-500">{locale === "vi" ? "Quét QR để chuyển khoản" : "Scan to pay"}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className={summaryCardClassName}><div className="text-xs font-bold uppercase tracking-wider text-slate-400">{locale === "vi" ? "Theo lịch" : "Scheduled amount"}</div><div className="mt-1 text-sm font-semibold">{formatMoney(paymentSummary.dueAmount, paymentSummary.currency)}</div></div>
                <div className={summaryCardClassName}><div className="text-xs font-bold uppercase tracking-wider text-slate-400">{locale === "vi" ? "Đã thu" : "Paid"}</div><div className="mt-1 text-sm font-semibold text-emerald-700">{formatMoney(paymentSummary.netPaidAmount, paymentSummary.currency)}</div></div>
                <div className={summaryCardClassName}><div className="text-xs font-bold uppercase tracking-wider text-slate-400">{locale === "vi" ? "Còn theo lịch" : "Remaining in schedule"}</div><div className="mt-1 text-sm font-semibold text-amber-700">{formatMoney(paymentSummary.outstandingAmount, paymentSummary.currency)}</div></div>
                <div className={summaryCardClassName}><div className="text-xs font-bold uppercase tracking-wider text-slate-400">{locale === "vi" ? "Trạng thái" : "Status"}</div><div className="mt-1 text-sm font-semibold text-slate-800">{businessStatusLabel(paymentSummary.state, locale)}</div></div>
              </div>
              <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                <Table className="min-w-[760px]"><TableHeader><TableRow><TableCell isHeader>{locale === "vi" ? "Đợt" : "Installment"}</TableCell><TableCell isHeader>{locale === "vi" ? "Điều khoản" : "Term"}</TableCell><TableCell isHeader>{locale === "vi" ? "Phương thức" : "Method"}</TableCell><TableCell isHeader className="text-right">{locale === "vi" ? "Theo lịch" : "Scheduled"}</TableCell><TableCell isHeader className="text-right">{locale === "vi" ? "Còn theo lịch" : "Remaining in schedule"}</TableCell></TableRow></TableHeader><TableBody>{paymentObligations.map((scheduleLine) => <TableRow key={scheduleLine.id}><TableCell className="font-semibold">{scheduleLine.label || "—"}</TableCell><TableCell>{paymentTermLabel(scheduleLine.term, locale)}</TableCell><TableCell>{paymentMethodLabel(scheduleLine.method, locale)}</TableCell><TableCell className="text-right whitespace-nowrap">{formatMoney(scheduleLine.amountDue, scheduleLine.currency)}</TableCell><TableCell className="text-right whitespace-nowrap font-bold">{formatMoney(scheduleLine.amountOutstanding, scheduleLine.currency)}</TableCell></TableRow>)}</TableBody></Table>
              </div>
            </section>}

            {activeTab === "INVOICES" && <section className={sectionClassName} data-order-detail-section="invoice-receivable-summary">
              <SectionHeader title={locale === "vi" ? "Hóa đơn và công nợ" : "Invoices and receivables"} icon={<ReceiptText size={14} />} actions={<Button size="xs" actionIntent="create" onClick={() => navigate(`/invoices/new?orderId=${order.id}`)}>{locale === "vi" ? "Tạo hóa đơn nháp" : "Create draft"}</Button>} />
              {relatedInvoices.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{locale === "vi" ? "Chưa có hóa đơn. Kỳ thanh toán không được dùng thay cho hóa đơn hoặc công nợ." : "No invoices yet. Payment schedule lines are not invoices or receivables."}</div> : <div className="space-y-3">{relatedInvoices.map((invoice) => { const receivable = relatedReceivables.find((item) => item.invoiceId === invoice.id); return <button type="button" key={invoice.id} onClick={() => navigate(`/invoices/${invoice.id}`)} className="flex w-full flex-col justify-between gap-3 rounded-xl border border-slate-200 p-4 text-left transition hover:border-violet-300 sm:flex-row sm:items-center"><div><div className="font-semibold text-slate-900">{invoice.invoiceNumber ?? (locale === "vi" ? "Hóa đơn nháp" : "Draft invoice")}</div><div className="mt-1 text-xs text-slate-500">{invoice.lifecycleState} · {invoice.issueDate ?? invoice.createdAt}</div></div><div className="text-left sm:text-right"><div className="font-semibold text-slate-900">{formatMoneyDto(invoice.totals.grandTotal, locale === "vi" ? "vi-VN" : "en-US")}</div>{receivable && <div className={`mt-1 text-xs font-bold ${receivable.settlementState === "OVERDUE" ? "text-rose-700" : "text-amber-700"}`}>{locale === "vi" ? "Còn phải thu" : "Outstanding"}: {formatMoneyDto(receivable.outstandingAmount, locale === "vi" ? "vi-VN" : "en-US")}</div>}</div></button>; })}</div>}
            </section>}

            {activeTab === "SHIPPING" && <section className={sectionClassName} data-order-detail-section="shipping-summary">
              <SectionHeader
                title={locale === "vi" ? "Vận đơn" : "Shipping"}
                icon={<Truck size={14} />}
                actions={permissions.canCreateShipping ? (
                  <Button
                    variant={canCreateShippingNow ? "primary" : "secondary"}
                    size="xs"
                    disabled={!canCreateShippingNow}
                    title={createShippingReason}
                    onClick={() => navigate(`/shipping/new?orderId=${order.id}`)}
                  >
                    <Truck size={12} />{locale === "vi" ? "Tạo vận đơn" : "Create shipment"}
                  </Button>
                ) : undefined}
              />
              {createShippingReason && <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-600">{createShippingReason}</div>}
              {orderShipping.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700"><Truck size={20} /></div><div className="mt-3 text-sm font-semibold text-slate-800">{shippingRequired ? (locale === "vi" ? "Chưa có vận đơn" : "No shipment yet") : (locale === "vi" ? "Đơn hàng không cần vận đơn" : "No shipment required")}</div><div className="mt-1 text-xs text-slate-500">{shippingRequired ? (locale === "vi" ? "Xác nhận vận hành, hoàn tất điều kiện thanh toán và bổ sung thông tin giao nhận trước khi tạo." : "Confirm the Order, satisfy booking payment gates, and complete recipient data before creating a shipment.") : (locale === "vi" ? "Các dòng hàng hiện tại là dịch vụ hoặc sản phẩm số. Việc gửi tài liệu đơn hàng qua Zalo, email hoặc Gmail chỉ là gửi chứng từ cho khách, không phải giao sản phẩm." : "The current lines are service or digital products. Sending the Order document by Zalo, email, or Gmail is customer communication, not product delivery.")}</div></div> : <div className="space-y-3">{orderShipping.map((booking) => <Link key={booking.id} to={`/shipping/${booking.id}`} className="block rounded-2xl border border-slate-200 bg-slate-50/60 p-4 transition hover:-translate-y-0.5 hover:border-violet-200 hover:bg-white hover:shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-semibold text-slate-800">{booking.code}</div><div className="mt-1 text-xs text-slate-500">{booking.providerNameSnapshot} · {booking.trackingCode || "—"} · {booking.purpose}</div></div><div className="flex flex-wrap gap-2"><Badge variant={booking.bookingStatus === "BOOKED" ? "info" : booking.bookingStatus === "FAILED" ? "danger" : "neutral"} size="xs" className="whitespace-nowrap">{locale === "vi" ? "Yêu cầu" : "Booking"}: {businessStatusLabel(booking.bookingStatus, locale)}</Badge><Badge variant={booking.externalStatus === "DELIVERED" ? "success" : booking.externalStatus === "DELIVERY_FAILED" ? "warning" : "neutral"} size="xs" className="whitespace-nowrap">{locale === "vi" ? "Vận chuyển" : "Carrier"}: {businessStatusLabel(booking.externalStatus, locale)}</Badge></div></div>{booking.deliveredAt && <div className="mt-2 text-xs font-semibold text-emerald-700">{locale === "vi" ? "Xác nhận đã giao" : "Delivery confirmed"}: {formatDate(booking.deliveredAt, locale)}</div>}</Link>)}</div>}
            </section>}

            {activeTab === "RETURNS" && <section className={sectionClassName} data-order-detail-section="returns-summary">
              <SectionHeader title={locale === "vi" ? "Đổi / Trả hàng" : "Returns / Replacements"} icon={<RotateCcw size={14} />} actions={deliveredBookingRecords[0] && access.can(CAPABILITIES.RETURNS_UPDATE) ? <Button size="xs" actionIntent="create" onClick={() => navigate(`/returns/new?orderId=${order.id}&shippingBookingId=${deliveredBookingRecords[0].id}`)}>{locale === "vi" ? "Tạo yêu cầu đổi/trả" : "Create return request"}</Button> : undefined} />
              {relatedReturns.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><RotateCcw size={20} /></div><div className="mt-3 text-sm font-semibold text-slate-800">Chưa có hồ sơ đổi / trả</div><div className="mt-1 text-xs text-slate-500">Return chỉ được tạo khi có delivery evidence và quantity eligible.</div></div> : <div className="grid gap-3 md:grid-cols-2">{relatedReturns.map((request) => <Link key={request.id} to={`/returns/${request.id}`} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 transition hover:-translate-y-0.5 hover:border-violet-200 hover:bg-white hover:shadow-sm"><div className="flex items-center justify-between gap-3"><div><div className="font-semibold text-slate-800">{request.code}</div><div className="mt-1 text-xs text-slate-500">{request.requestedResolution || "—"}</div></div><Badge variant={request.status === "CLOSED" || request.status === "RESOLVED" ? "success" : request.status === "REJECTED" ? "danger" : "info"} size="xs" className="whitespace-nowrap">{request.status}</Badge></div></Link>)}</div>}
            </section>}

            {activeTab === "DOCUMENT" && <section className={sectionClassName} data-order-detail-section="customer-document">
              <SectionHeader
                title={locale === "vi" ? "Tài liệu đơn hàng" : "Order documents"}
                icon={<FileText size={14} />}
                actions={<Button variant="secondary" size="xs" onClick={() => setDocumentPreviewOpen(true)}><Eye size={12} />{locale === "vi" ? "Xem trước" : "Preview"}</Button>}
              />
              <div className="mt-5">
                <SectionHeader title={locale === "vi" ? "Lịch sử gửi tài liệu cho khách" : "Customer document delivery history"} icon={<Send size={14} />} />
                {order.deliveryHistory?.length ? <div className="space-y-2">{[...order.deliveryHistory].reverse().map((delivery) => <div key={delivery.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"><div><div className="font-bold text-slate-800">{delivery.channel} · {delivery.recipientEmail || delivery.recipient || "—"}</div><div className="mt-1 text-slate-500">{delivery.note || delivery.fileName || (locale === "vi" ? "Bằng chứng gửi đã được lưu" : "Delivery evidence retained")}</div></div><div className="text-right text-slate-500"><div>{formatDate(delivery.sentAt, locale)}</div><div className="mt-1 font-mono text-xs">{delivery.contentFingerprint}</div></div></div>)}</div> : <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500">{locale === "vi" ? "Chưa có lần gửi nào được xác nhận." : "No customer delivery has been confirmed yet."}</div>}
              </div>
            </section>}

            {activeTab === "ACTIVITY" && <section className={sectionClassName} data-order-detail-section="activity">
              <SectionHeader title={locale === "vi" ? "Hoạt động / Bằng chứng" : "Activity / Evidence"} icon={<ClipboardList size={14} />} />
              <div className="space-y-3 text-xs">
                <div className="rounded-xl border border-slate-200 p-4"><div className="font-bold text-slate-800">{order.confirmedAt ? (locale === "vi" ? "Đã xác nhận vận hành" : "Operationally confirmed") : (locale === "vi" ? "Đơn hàng được tạo ở trạng thái Nháp" : "Order created as Draft")}</div><div className="mt-1 text-slate-500">{formatDate(order.confirmedAt || order.createdAt, locale)}</div></div>
                {order.deliveryHistory?.map((delivery) => <div key={delivery.id} className="rounded-xl border border-violet-200 bg-violet-50 p-4"><div className="font-bold text-violet-900">{locale === "vi" ? `Tài liệu đơn hàng đã gửi qua ${delivery.channel}` : `Order document sent via ${delivery.channel}`}</div><div className="mt-1 text-violet-700">{delivery.recipientEmail || delivery.recipient || "—"} · {formatDate(delivery.sentAt, locale)}</div>{delivery.note && <div className="mt-1 text-violet-600">{delivery.note}</div>}</div>)}
                {order.completion && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="font-bold text-emerald-800">{shippingRequired ? (locale === "vi" ? "Đã hoàn tất sau khi đủ bằng chứng thanh toán và giao hàng" : "Completed after payment and shipping evidence") : (locale === "vi" ? "Đã hoàn tất sau khi đủ điều kiện thanh toán và thực hiện" : "Completed after payment and fulfillment conditions")}</div><div className="mt-1 text-emerald-700">{shippingRequired && order.completion.shippingEvidenceIds?.length ? order.completion.shippingEvidenceIds.join(", ") : order.completion.evidenceId}</div></div>}
                {order.cancellation && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="font-bold text-slate-800">{locale === "vi" ? "Đã hủy" : "Cancelled"}</div><div className="mt-1 text-slate-600">{order.cancellation.reason}</div></div>}
              </div>
            </section>}
            </RecordTabTransition>
          </main>

          <OperationInsightPanel
            title={locale === "vi" ? "Điều phối đơn hàng" : "Order orchestration"}
            score={operationalScore}
            scoreLabel={locale === "vi" ? "Mức hoàn tất vận hành" : "Operational completion"}
            items={[
              { label: locale === "vi" ? "Xác nhận nội bộ" : "Internal confirmation", value: order.state === "DRAFT" ? (locale === "vi" ? "Chưa xác nhận" : "Not confirmed") : (locale === "vi" ? "Đã xác nhận" : "Confirmed"), tone: order.state === "DRAFT" ? "warning" : "success" },
              { label: locale === "vi" ? "Điều kiện thanh toán" : "Payment gate", value: paymentReadiness.ready ? (locale === "vi" ? "Đạt" : "Ready") : (locale === "vi" ? "Đang chặn" : "Blocked"), tone: paymentReadiness.ready ? "success" : "warning" },
              { label: locale === "vi" ? "Giao hàng" : "Fulfillment", value: !shippingRequired ? (locale === "vi" ? "Không cần vận đơn" : "No shipment required") : orderShipping.length === 0 ? (locale === "vi" ? "Chưa tạo vận đơn" : "No shipment") : `${deliveredBookings}/${orderShipping.length} ${locale === "vi" ? "đã giao" : "delivered"}`, tone: !shippingRequired ? "neutral" : deliveredBookings === orderShipping.length && orderShipping.length > 0 ? "success" : "info" },
              { label: locale === "vi" ? "Hoàn tất" : "Completion", value: terminalOrder ? businessStatusLabel(order.state, locale) : completionEvaluation.ready ? (locale === "vi" ? "Đủ bằng chứng" : "Evidence ready") : (locale === "vi" ? "Chưa đủ bằng chứng" : "Evidence missing"), tone: terminalOrder || completionEvaluation.ready ? "success" : "neutral" },
            ]}
            blockers={operationalBlockers}
            nextAction={order.state === "DRAFT" ? {
              title: locale === "vi" ? "Bước tiếp theo" : "Next step",
              label: locale === "vi" ? "Xác nhận vận hành" : "Confirm operationally",
              description: permissions.canConfirm ? (locale === "vi" ? "Nhân viên xác nhận nội bộ để kích hoạt kế hoạch thanh toán. Đây không phải xác nhận của khách hàng." : "An authorized employee confirms internally to activate the Payment Plan. This is not customer acceptance.") : (locale === "vi" ? "Bạn chưa có quyền hoặc đơn hàng nằm ngoài phạm vi dữ liệu được giao." : "You lack permission or the Order is outside your assigned data scope."),
              actionLabel: locale === "vi" ? "Xác nhận vận hành" : "Confirm",
              variant: "primary",
              onClick: permissions.canConfirm ? () => { void confirmOrder(); } : undefined,
            } : terminalOrder ? (activeTab === "ACTIVITY" ? undefined : { title: locale === "vi" ? "Bước tiếp theo" : "Next step", label: locale === "vi" ? "Xem bằng chứng cuối cùng" : "Review final evidence", description: locale === "vi" ? "Đơn hàng đã kết thúc. Lịch sử lưu các xác nhận và bằng chứng cuối cùng." : "The Order has ended. Activity contains the final confirmations and evidence.", actionLabel: locale === "vi" ? "Xem hoạt động" : "View activity", variant: "info", onClick: () => setActiveTab("ACTIVITY") }) : !paymentReadiness.ready ? { title: locale === "vi" ? "Bước tiếp theo" : "Next step", label: locale === "vi" ? "Xử lý điều kiện thanh toán" : "Resolve payment gate", description: locale === "vi" ? "Một kỳ thanh toán đang chặn bước vận hành tiếp theo." : "A payment schedule line is blocking the next operation.", actionLabel: locale === "vi" ? "Mở Thanh toán" : "Open payments", variant: "warning", onClick: () => setActiveTab("PAYMENT") } : shippingRequired && orderShipping.length === 0 ? { title: locale === "vi" ? "Bước tiếp theo" : "Next step", label: locale === "vi" ? "Tạo vận đơn" : "Create shipment", description: locale === "vi" ? "Đơn có hàng vật lý và đã đủ điều kiện tạo vận đơn." : "The Order contains physical goods and is ready for shipment booking.", actionLabel: locale === "vi" ? "Mở mục Vận đơn" : "Open Shipping", variant: "info", onClick: () => setActiveTab("SHIPPING") } : completionEvaluation.ready ? { title: locale === "vi" ? "Bước tiếp theo" : "Next step", label: locale === "vi" ? "Hoàn tất đơn hàng" : "Complete Order", description: locale === "vi" ? "Các điều kiện bắt buộc và bằng chứng đã đầy đủ." : "Mandatory gates and evidence are complete.", actionLabel: locale === "vi" ? "Hoàn tất" : "Complete", variant: "success", onClick: completeOrder } : { title: locale === "vi" ? "Bước tiếp theo" : "Next step", label: locale === "vi" ? "Theo dõi thực hiện" : "Monitor fulfillment", description: locale === "vi" ? "Cập nhật trạng thái giao hàng hoặc bằng chứng thực hiện để hoàn tất đơn." : "Update fulfillment status or evidence before completion.", actionLabel: locale === "vi" ? "Mở Vận đơn" : "Open Shipping", variant: "info", onClick: () => setActiveTab("SHIPPING") }}
          >
            <div className="border-t border-slate-100 pt-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{locale === "vi" ? "Vòng đời" : "Lifecycle"}</div>
              <OperationLifecycleRail steps={lifecycleSteps} />
            </div>
          </OperationInsightPanel>
        </div>
        <CommercialLineagePanel anchorType="ORDER" anchorId={order.id} locale={locale} />
      </RecordDetailFrame>
      <CommercialDocumentPreviewModal
        id="order-a4-preview-modal"
        isOpen={documentPreviewOpen}
        onClose={() => setDocumentPreviewOpen(false)}
        title={locale === "vi" ? `Xem trước đơn hàng ${order.orderNumber}` : `Preview Order ${order.orderNumber}`}
      >
        <OrderCustomerDocument order={order} customer={customer} contact={contact} customerLabel={customerLabel} contactLabel={contactLabel} locale={locale} />
      </CommercialDocumentPreviewModal>
      <CustomerDocumentDeliveryModal
        isOpen={deliveryOpen}
        documentNumber={order.orderNumber}
        documentLabel={{ vi: "Tài liệu đơn hàng", en: "Order document" }}
        locale={locale}
        idPrefix="order"
        guidanceId="orders.delivery.confirm"
        initialChannel={deliveryChannel}
        initialRecipientEmail={order.recipientEmail || contact?.email || ""}
        initialRecipient={order.recipientPhone || contact?.phone || order.recipientName || ""}
        initialFileName={deliveryFileName}
        channelLocked={deliveryChannelLocked}
        onClose={() => setDeliveryOpen(false)}
        onConfirm={confirmOrderDelivery}
      />
      <ConfirmDialog
        isOpen={cancelOpen}
        onClose={() => { setCancelOpen(false); setCancelReasonCode(cancellationReasons[0]?.code ?? ""); setCancelReason(""); }}
        onConfirm={() => { void confirmCancellation(); }}
        title={locale === "vi" ? `Hủy ${order.orderNumber}?` : `Cancel ${order.orderNumber}?`}
        message={
          <div className="space-y-3 text-left">
            <p>{locale === "vi" ? "Đây là thao tác hủy nghiệp vụ. Đơn hàng sẽ chuyển sang trạng thái Đã hủy." : "This is an explicit business cancellation. The Order will enter terminal CANCELLED state."}</p>
            <Select label={locale === "vi" ? "Mã lý do *" : "Reason code *"} value={cancelReasonCode} onChange={(event) => setCancelReasonCode(event.target.value)}><option value="">{locale === "vi" ? "Chọn lý do" : "Select reason"}</option>{cancellationReasons.map((reason) => <option key={reason.code} value={reason.code}>{locale === "vi" ? reason.labelVi : reason.labelEn}</option>)}</Select>
            <Textarea label={locale === "vi" ? "Ghi chú hủy *" : "Cancellation note *"} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
          </div>
        }
        confirmText={locale === "vi" ? "Hủy đơn hàng" : "Cancel Order"}
        cancelText={locale === "vi" ? "Giữ đơn hàng" : "Keep Order"}
        type="danger"
      />
    </div>
  );
};
