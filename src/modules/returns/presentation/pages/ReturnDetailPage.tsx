import { formatApplicationError } from "@/shared/operations";
import { createCreateCommandTarget, createDurableId, createProvisionalDocumentNumber } from "@/shared/ids";
import React, { useMemo, useState } from "react";
import {
  ClipboardCheck,
  PackageOpen,
  PackageCheck,
  RefreshCw,
  Truck,
  WalletCards,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/shared/components/ui";
import {
  RecordDetailFrame,
  RecordDetailHeader,
  RecordDetailSection,
} from "@/components/crm/detail-archetype";
import {
  OperationDetailTabs,
  OperationInsightPanel,
  OperationLifecycleRail,
} from "@/components/crm/operations";
import { getOrderListSnapshot, orderRequiresShipping, subscribeToOrderList } from "@/modules/orders";
import {
  getPaymentMethodCatalogSnapshot,
  getPaymentsSnapshot,
} from "@/modules/payments";
import {
  getReturnLocations,
  getShippingSnapshot,
  subscribeToShipping,
  syncShippingBookingCommandBoundary,
} from "@/modules/shipping";
import type { ReturnItem, ReturnMethod, ReturnResolution, ReturnResolutionIntent } from "../../domain/model/return.types";
import { approveReturnCommand, closeReturnCommand, completeReturnResolutionCommand, configureReturnMethodCommand, confirmReturnedItemsReceivedCommand, getReturnsSnapshot, rejectReturnCommand, subscribeToReturns } from "../../public/api";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { AuditTrailViewer } from "@/platform/audit";
import { useSubscribableSnapshot } from "@/platform/react";
import { executeReturnCreditRefundCommand } from "@/workflows/return-credit-refund";
import { beginReturnPickupCommand, beginReturnReplacementCommand, completeReturnRepairCommand, completeReturnReplacementFromDeliveryCommand } from "@/workflows/return-resolution";
import { getInvoicesSnapshot } from "@/modules/invoices";
import { money as createMoney, sumMoney } from "@/shared/money";
import { ReturnStatusBadge } from "../components/ReturnStatusBadge";
import { resolveReturnHeaderActionIds } from "../model/returnActionPolicy";
import { useI18n } from "@/i18n";
import { getReasonCatalog } from "@/platform/configuration-runtime";
import { EvidencePanel } from "@/shared/evidence";
import { ReturnInfo, ShippingEvidenceRow } from "../detail/ReturnDetailPrimitives";
import { acceptedQuantity, buildReturnEvidenceItems, buildReturnNextAction, buildReturnOperationalModel, eligibilityReasonLabel, inputClassName, methodLabel, reasonLabel, resolutionLabel, type LocalizedLabel } from "../detail/returnDetailModel";
import { createReturnDetailTabs, ReturnHeaderActions } from "../detail/ReturnDetailChrome";
type DetailTab = "OVERVIEW" | "ITEMS" | "RETURN_FLOW" | "RESOLUTION" | "ACTIVITY";
type ReceiveDraft = { received: number; accepted: number; rejected: number; condition: string; note: string };
export const ReturnDetailPage: React.FC = () => {
  const { returnId = "" } = useParams();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const localizedLabel = (labels: Record<string, LocalizedLabel>, key: string) => labels[key]?.[locale] ?? key;
  const access = useEffectiveAccess();
  const reduceMotion = useReducedMotion();
  const snapshot = useSubscribableSnapshot(getReturnsSnapshot, subscribeToReturns);
  const orders = useSubscribableSnapshot(getOrderListSnapshot, subscribeToOrderList);
  const shipping = useSubscribableSnapshot(getShippingSnapshot, subscribeToShipping);
  const request = snapshot.requests.find((item) => item.id === returnId);
  const intents = useMemo(() => snapshot.intents.filter((item) => item.returnId === returnId), [snapshot, returnId]);
  const order = orders.find((item) => item.id === request?.orderId);
  const returnShipping = shipping.filter((item) => item.sourceType === "RETURN" && item.sourceId === returnId);
  const pickupLocations = useMemo(() => getReturnLocations().filter((item) => item.isActive), []);
  const defaultPickup = pickupLocations.find((item) => item.isDefault) ?? pickupLocations[0];
  const [activeTab, setActiveTab] = useState<DetailTab>("OVERVIEW");
  const rejectionReasons = getReasonCatalog("RETURN_REJECTION")?.entries.filter((entry) => entry.enabled) ?? [];
  const [rejectionReasonCode, setRejectionReasonCode] = useState(rejectionReasons[0]?.code ?? "");
  const [note, setNote] = useState("");
  const [refundAmount, setRefundAmount] = useState(0);
  const [pickupWeightGrams, setPickupWeightGrams] = useState(0);
  const [outboundWeightGrams, setOutboundWeightGrams] = useState(0);
  const [exchangeDelta, setExchangeDelta] = useState(0);
  const exchangeIntentMethods = useMemo(() => getPaymentMethodCatalogSnapshot({ currency: order?.currency ?? "VND", supportsIntent: true }), [order?.currency]);
  const [exchangePaymentMethodCode, setExchangePaymentMethodCode] = useState("");
  const selectedExchangeMethodCode = exchangePaymentMethodCode || exchangeIntentMethods[0]?.code || "";
  const [returnMethod, setReturnMethod] = useState<ReturnMethod>("CARRIER_PICKUP");
  const [selfShipCarrier, setSelfShipCarrier] = useState("");
  const [selfShipTracking, setSelfShipTracking] = useState("");
  const [dropOffLocation, setDropOffLocation] = useState("");
  const [receiveDraft, setReceiveDraft] = useState<Record<string, ReceiveDraft>>({});
  const [approvalDraft, setApprovalDraft] = useState<Record<string, number>>({});
  const [repairReference, setRepairReference] = useState("");
  const [repairProvider, setRepairProvider] = useState("");
  const [repairResult, setRepairResult] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const actorId = access.memberId || access.accountId || "current-user";
  const actorName = getAuthSessionSnapshot()?.principal.displayName || actorId;
  if (!request) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Không tìm thấy Return.</div>;
  const permissions = {
    canView: access.can(CAPABILITIES.RETURNS_READ),
    canApprove: access.can(CAPABILITIES.RETURNS_UPDATE),
    canUpdate: access.can(CAPABILITIES.RETURNS_UPDATE),
    canResolve: access.can(CAPABILITIES.RETURNS_RESOLVE),
  };
  const actionIds = resolveReturnHeaderActionIds(request, permissions);
  const getBusinessPickup = () => {
    if (!defaultPickup) throw new Error("Workspace chưa có điểm lấy hàng được cấu hình.");
    return defaultPickup;
  };
  const run = async (action: () => unknown | Promise<unknown>, success: string | ((result: unknown) => string) = "Đã cập nhật Return.") => {
    try {
      const result = await action();
      setMessage(typeof success === "function" ? success(result) : success);
      setNote("");
    } catch (error) {
      setMessage(formatApplicationError(error, { locale }));
    }
  };
  const evidenceItems = buildReturnEvidenceItems(request, intents, text);
  const { approvedTotal, receivedTotal, acceptedTotal, operationalStage, blockers, operationalScore, lifecycle } = buildReturnOperationalModel(request, intents);
  const suggestedRefund = request.items.reduce((sum, item) => {
    const orderLine = order?.items.find((line) => line.id === item.orderLineId);
    if (!orderLine || orderLine.quantity <= 0) return sum;
    return sum + acceptedQuantity(item) * (orderLine.lineTotal / orderLine.quantity);
  }, 0);
  const getReceiveRow = (item: ReturnItem): ReceiveDraft => receiveDraft[item.orderLineId] ?? {
    received: item.receivedQuantity ?? 0,
    accepted: item.acceptedQuantity ?? 0,
    rejected: item.rejectedQuantity ?? 0,
    condition: item.condition ?? "",
    note: item.inspectionNote ?? "",
  };
  const updateReceiveRow = (item: ReturnItem, patch: Partial<ReceiveDraft>) => {
    setReceiveDraft((current) => ({ ...current, [item.orderLineId]: { ...getReceiveRow(item), ...patch } }));
  };
  const buildLineAllocations = (useAccepted: boolean) => request.items
    .map((item) => ({
      orderLineId: item.orderLineId,
      productId: item.productId,
      productNameSnapshot: item.productNameSnapshot,
      quantity: useAccepted ? acceptedQuantity(item) : (item.approvedQuantity ?? item.requestedQuantity),
    }))
    .filter((item) => item.quantity > 0);
  const createPickup = async () => {
    if (!order) throw new Error("Không tìm thấy Order nguồn.");
    if (!(pickupWeightGrams > 0)) throw new Error("Nhập khối lượng hàng trả thực tế trước khi booking.");
    const businessPickup = getBusinessPickup();
    if (!order.shippingAddress || !order.recipientName?.trim() || !order.recipientPhone?.trim()) {
      throw new Error("Order thiếu tên, điện thoại hoặc địa chỉ người gửi hàng trả.");
    }
    const now = new Date().toISOString();
    const id = createCreateCommandTarget("shipping");
    const shipmentGroupId = `return-pickup:${request.id}:${id}`;
    const lineAllocations = buildLineAllocations(false);
    const booking = (await beginReturnPickupCommand({
      returnId: request.id,
      shippingBooking: {
        id,
        code: createProvisionalDocumentNumber("SHP"),
        sourceType: "RETURN",
        sourceId: request.id,
        purpose: "RETURN_PICKUP",
        providerId: "manual",
        pickupLocationSnapshot: {
          ...order.shippingAddress,
          name: "Địa chỉ lấy hàng trả",
          contactName: order.recipientName,
          phone: order.recipientPhone,
        },
        returnLocationSnapshot: {
          line1: businessPickup.addressLine,
          city: businessPickup.city,
          id: businessPickup.id,
          name: businessPickup.name,
          contactName: businessPickup.contactName,
          phone: businessPickup.phone,
        },
        recipientSnapshot: {
          name: businessPickup.contactName,
          phone: businessPickup.phone,
          address: { line1: businessPickup.addressLine, city: businessPickup.city },
        },
        packageSnapshot: {
          packageCount: 1,
          totalWeightGrams: pickupWeightGrams,
          lineAllocations,
          feePayer: "SENDER",
          inspectionPolicy: "VIEW_ONLY",
          itemSummary: lineAllocations.map((item) => `${item.productNameSnapshot} × ${item.quantity}`).join(", "),
          note: note.trim() || undefined,
        },
        shipmentGroupId,
        idempotencyKey: `shipping-booking:${shipmentGroupId}:attempt:1`,
        correlationId: request.correlationId ?? `return:${request.id}`,
        actorId,
        actorName,
        now,
      },
      actorId,
      actorName,
      now,
    })).data;
    if (booking.bookingStatus !== "BOOKED") throw new Error(booking.lastErrorMessage || "Không tạo được vận đơn lấy hàng.");
  };
  const configureNonPickupMethod = async () => {
    if (returnMethod === "CARRIER_PICKUP") throw new Error("Chọn Tạo đơn lấy hàng để booking carrier pickup.");
    await configureReturnMethodCommand(request.id, {
      method: returnMethod,
      carrier: selfShipCarrier,
      trackingCode: selfShipTracking,
      dropOffLocation,
      actorId,
      actorName,
    });
  };
  const receive = () => confirmReturnedItemsReceivedCommand(request.id, {
    items: request.items.map((item) => {
      const row = getReceiveRow(item);
      return {
        orderLineId: item.orderLineId,
        receivedQuantity: row.received,
        acceptedQuantity: row.accepted,
        rejectedQuantity: row.rejected,
        condition: row.condition.trim() || undefined,
        inspectionNote: row.note.trim() || undefined,
      };
    }),
    conditionNote: note.trim() || "Đã kiểm đếm theo số lượng thực tế",
    actorId,
    actorName,
  });
  const executeRefund = async () => {
    if (!order) throw new Error("Không tìm thấy Order.");
    const amount = refundAmount || suggestedRefund;
    if (!(amount > 0)) throw new Error("Số tiền hoàn phải lớn hơn 0.");
    await executeReturnCreditRefundCommand({
      returnId: request.id,
      amount: createMoney(String(amount), order.currency ?? "VND"),
      reasonCode: "RETURN_ACCEPTED_REFUND",
      reason: note.trim() || `Hoàn tiền cho ${request.code}`,
      actorId,
      actorName,
    });
  };
  const executeReplacement = async (type: "REPLACEMENT" | "EXCHANGE"): Promise<"PAYMENT_PENDING" | "SHIPPING_BOOKED"> => {
    if (!order?.shippingAddress) throw new Error("Order thiếu địa chỉ giao hàng.");
    if (!order.recipientName?.trim() || !order.recipientPhone?.trim()) throw new Error("Order thiếu tên hoặc điện thoại người nhận.");
    if (!(outboundWeightGrams > 0)) throw new Error("Nhập khối lượng kiện hàng thay thế thực tế trước khi booking.");
    const businessPickup = getBusinessPickup();
    const lines = buildLineAllocations(true);
    if (!lines.length) throw new Error("Không có số lượng đã chấp nhận để gửi hàng thay thế.");
    const now = new Date().toISOString();
    const currency = order.currency ?? "VND";
    const method = type === "EXCHANGE" && exchangeDelta > 0
      ? exchangeIntentMethods.find((item) => item.code === selectedExchangeMethodCode)
      : undefined;
    const provider = method
      ? getPaymentsSnapshot().providerCatalog.find((item) => method.providerCodes?.includes(item.code) && item.enabled)
      : undefined;
    if (type === "EXCHANGE" && exchangeDelta > 0 && (!method || !provider)) {
      throw new Error("Chọn phương thức online đang hoạt động từ Payment catalog.");
    }
    const id = createDurableId("shipping_booking");
    const shipmentGroupId = `replacement:${request.id}:${type}`;
    const outcome = await beginReturnReplacementCommand({
      returnId: request.id,
      type,
      lines: lines.map(({ productId, productNameSnapshot, quantity }) => ({ productId, productNameSnapshot, quantity })),
      commercialAdjustmentNote: type === "EXCHANGE" ? (note.trim() || "Exchange commercial delta handled by Invoice and Payment owners") : undefined,
      commercialDelta: type === "EXCHANGE" ? exchangeDelta : undefined,
      currency,
      paymentCollection: method && provider ? {
        id: createDurableId("exchange_payment_intent"),
        buyerRef: order.buyerRef,
        orderId: order.id,
        amount: createMoney(String(exchangeDelta), currency),
        methodCode: method.code,
        providerCode: provider.code,
        returnContext: { routeKey: "returns.detail" },
        clientPayload: { returnId: request.id, returnRouteKey: "returns.detail" },
        expiresAt: new Date(new Date(now).getTime() + 30 * 60_000).toISOString(),
        idempotencyKey: `exchange-delta-collection:${request.id}:${exchangeDelta}:${currency}`,
        now,
      } : undefined,
      creditRefund: type === "EXCHANGE" && exchangeDelta < 0 ? {
        amount: createMoney(String(Math.abs(exchangeDelta)), currency),
        reasonCode: "RETURN_ACCEPTED_REFUND",
      reason: note.trim() || `Điều chỉnh giảm cho Exchange ${request.code}`,
      } : undefined,
      shippingBooking: {
        id,
        code: `SB-${id.slice(-6).toUpperCase()}`,
        sourceType: "RETURN",
        sourceId: request.id,
        purpose: "REPLACEMENT_OUTBOUND",
        providerId: "manual",
        pickupLocationSnapshot: {
          line1: businessPickup.addressLine,
          city: businessPickup.city,
          id: businessPickup.id,
          name: businessPickup.name,
          contactName: businessPickup.contactName,
          phone: businessPickup.phone,
        },
        returnLocationSnapshot: {
          line1: businessPickup.addressLine,
          city: businessPickup.city,
          id: businessPickup.id,
          name: businessPickup.name,
          contactName: businessPickup.contactName,
          phone: businessPickup.phone,
        },
        recipientSnapshot: { name: order.recipientName, phone: order.recipientPhone, address: order.shippingAddress },
        packageSnapshot: {
          packageCount: 1,
          totalWeightGrams: outboundWeightGrams,
          lineAllocations: lines,
          declaredValue: createMoney(String(Math.max(0, order.totalAmount)), currency),
          feePayer: "SENDER",
          inspectionPolicy: "VIEW_ONLY",
          itemSummary: lines.map((item) => `${item.productNameSnapshot} × ${item.quantity}`).join(", "),
          note: note.trim() || undefined,
        },
        shipmentGroupId,
        idempotencyKey: `shipping-booking:${shipmentGroupId}:attempt:1`,
        correlationId: request.correlationId ?? `return:${request.id}`,
        actorId,
        actorName,
        now,
      },
      actorId,
      actorName,
      now,
    });
    return outcome.data.status;
  };
  const completeDeliveredReplacement = async (intent: ReturnResolutionIntent) => {
    const booking = shipping.find((item) => item.id === intent.externalReference);
    const type = String(intent.payload.type) === "EXCHANGE" ? "EXCHANGE" : "REPLACEMENT";
    const lines = Array.isArray(intent.payload.lines) ? intent.payload.lines as Array<{ productId: string; productNameSnapshot: string; quantity: number }> : [];
    const commercialDelta = Number(intent.payload.commercialDelta ?? 0);
    const currency = String(intent.payload.currency ?? order?.currency ?? "VND");
    const freshIntents = getReturnsSnapshot().intents.filter((item) => item.returnId === request.id);
    const intentIds = [intent.id];
    let resolution: ReturnResolution;
    if (type === "EXCHANGE") {
      const collectionIntentId = typeof intent.payload.paymentIntentId === "string" ? intent.payload.paymentIntentId : undefined;
      if (commercialDelta > 0 && collectionIntentId) intentIds.push(collectionIntentId);
      if (commercialDelta < 0) {
        const creditIntent = freshIntents.find((item) => item.target === "INVOICE" && item.action === "CREDIT_NOTE" && item.status === "SUCCEEDED");
        if (!creditIntent) throw new Error("Exchange giảm giá trị cần Credit Note ISSUED evidence.");
        intentIds.push(creditIntent.id);
        const returnRefundIntent = freshIntents.find((item) => item.target === "PAYMENT" && item.action === "REFUND" && item.status === "SUCCEEDED");
        if (returnRefundIntent) intentIds.push(returnRefundIntent.id);
        const creditNoteIds = creditIntent.externalReferences?.length ? creditIntent.externalReferences : creditIntent.externalReference ? [creditIntent.externalReference] : [];
        const refundPaymentRecordIds = returnRefundIntent?.externalReferences?.length ? returnRefundIntent.externalReferences : returnRefundIntent?.externalReference ? [returnRefundIntent.externalReference] : [];
        const invoiceSnapshot = getInvoicesSnapshot();
        const paymentSnapshot = getPaymentsSnapshot();
        const creditedAmount = sumMoney(invoiceSnapshot.creditNotes.filter((item) => creditNoteIds.includes(item.id) && item.state === "ISSUED").map((item) => item.total), currency);
        const refundRecords = paymentSnapshot.paymentRecords.filter((item) => refundPaymentRecordIds.includes(item.id) && item.kind === "REFUND" && item.state === "SUCCEEDED");
        const refundedAmount = sumMoney(refundRecords.map((item) => item.amount), currency);
        resolution = {
          type: "EXCHANGE",
          exchangeLines: lines,
          commercialDelta,
          currency,
          commercialAdjustmentNote: String(intent.payload.commercialAdjustmentNote ?? ""),
          paymentIntentId: returnRefundIntent?.id,
          shippingBookingId: booking?.id,
          creditNoteIds,
          refundIntentIds: refundRecords.map((record) => record.refundIntentId).filter((value): value is string => Boolean(value)),
          refundPaymentRecordIds,
          creditedAmount,
          refundedAmount,
        };
      } else {
        resolution = { type: "EXCHANGE", exchangeLines: lines, commercialDelta, currency, commercialAdjustmentNote: String(intent.payload.commercialAdjustmentNote ?? ""), paymentIntentId: collectionIntentId, shippingBookingId: booking?.id };
      }
    } else {
      resolution = { type: "REPLACEMENT", replacementLines: lines, shippingBookingId: booking?.id };
    }
    await completeReturnReplacementFromDeliveryCommand({ returnId: request.id, shippingIntentId: intent.id, resolution, intentIds, actorId, actorName });
  };
  const executeRepair = async () => {
    if (!repairReference.trim()) throw new Error("Nhập mã công việc sửa chữa.");
    if (!repairResult.trim()) throw new Error("Nhập kết quả sửa chữa làm evidence hoàn tất.");
    await completeReturnRepairCommand({
      returnId: request.id,
      reference: repairReference.trim(),
      provider: repairProvider.trim() || undefined,
      result: repairResult.trim(),
      actorId,
      actorName,
    });
  };
  const rejectAfterInspection = async () => {
    if (!note.trim()) throw new Error("Nhập lý do từ chối sau kiểm tra.");
    await completeReturnResolutionCommand(request.id, {
      resolution: { type: "REJECT_AFTER_INSPECTION", reason: note.trim() },
      actorId,
      actorName,
    });
  };
  const scrollToWorkflow = (tab: DetailTab = "RETURN_FLOW") => {
    setActiveTab(tab);
    requestAnimationFrame(() => document.getElementById("return-workflow-section")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }));
  };
  const actions = <ReturnHeaderActions
    actionIds={actionIds}
    onApprove={() => void run(() => approveReturnCommand(request.id, { reason: note.trim() || "Approved after review", overrideReason: request.eligibilityResult.eligible ? undefined : (note.trim() || undefined), items: request.items.map((item) => ({ orderLineId: item.orderLineId, approvedQuantity: approvalDraft[item.orderLineId] ?? item.requestedQuantity, approvalReason: note.trim() || undefined })), actorId, actorName }))}
    onReject={() => void run(() => { if (!rejectionReasonCode || !note.trim()) throw new Error(text("Mã lý do và ghi chú từ chối là bắt buộc.", "Rejection reason code and note are required.")); return rejectReturnCommand(request.id, { reason: `${rejectionReasonCode}: ${note.trim()}`, actorId, actorName }); })}
    onOpenReturnFlow={() => scrollToWorkflow("RETURN_FLOW")}
    onOpenResolution={() => scrollToWorkflow("RESOLUTION")}
    onClose={() => void run(() => closeReturnCommand(request.id, { actorId, actorName }), "Đã đóng Return.")}
  />;
  const tabs = createReturnDetailTabs(request, intents, receivedTotal, approvedTotal, text("Kiểm toán", "Audit"));
  const nextAction = buildReturnNextAction({
    request,
    activeTab,
    openOverview: () => setActiveTab("OVERVIEW"),
    openReturnFlow: () => scrollToWorkflow("RETURN_FLOW"),
    openResolution: () => scrollToWorkflow("RESOLUTION"),
    openActivity: () => setActiveTab("ACTIVITY"),
    closeReturn: () => void run(() => closeReturnCommand(request.id, { actorId, actorName }), "Đã đóng Return."),
  });
  return (
    <RecordDetailFrame id="return-detail-page">
      <RecordDetailHeader
        id="return-detail-header"
        backLabel="Quay lại Đổi / Trả hàng"
        onBack={() => navigate("/returns")}
        identityIcon={<PackageOpen size={20} />}
        identityToneClassName="border-violet-200 bg-violet-50 text-violet-700"
        title={request.code}
        status={<ReturnStatusBadge status={request.status} />}
        metadata={<><span>Order {order?.orderNumber ?? request.orderId}</span><span>•</span><span>{localizedLabel(resolutionLabel, request.requestedResolution)}</span><span>•</span><span>{order?.customerName ?? request.buyerRef.id}</span></>}
        actions={actions}
      />
      <AnimatePresence initial={false}>
        {message && (
          <motion.div initial={reduceMotion ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -8 }} className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs font-medium text-indigo-800">
            {message}
          </motion.div>
        )}
      </AnimatePresence>
      <OperationDetailTabs items={tabs} activeKey={activeTab} onChange={(key) => setActiveTab(key as DetailTab)} ariaLabel="Các phần chi tiết đổi / trả" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <motion.div key={activeTab} initial={reduceMotion ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduceMotion ? 0 : 0.18 }} className="space-y-5">
            {activeTab === "OVERVIEW" && <>
              <RecordDetailSection title={text("Tóm tắt yêu cầu", "Request summary")}><div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4"><ReturnInfo label="Order" value={order?.orderNumber ?? request.orderId} /><ReturnInfo label={text("Khách hàng", "Customer")} value={order?.customerName ?? request.buyerRef.id} /><ReturnInfo label={text("Lý do", "Reason")} value={localizedLabel(reasonLabel, request.reason)} /><ReturnInfo label={text("Phương án yêu cầu", "Requested resolution")} value={localizedLabel(resolutionLabel, request.requestedResolution)} /></div></RecordDetailSection>
              <RecordDetailSection title={text("Điều kiện & Phê duyệt", "Eligibility & approval")}><div className="grid gap-5 p-5 md:grid-cols-3"><ReturnInfo label={text("Kết quả điều kiện", "Eligibility result")} value={request.eligibilityResult.eligible ? text("ĐỦ ĐIỀU KIỆN", "ELIGIBLE") : text("KHÔNG ĐỦ ĐIỀU KIỆN", "INELIGIBLE")} /><ReturnInfo label={text("Lý do", "Reason")} value={localizedLabel(eligibilityReasonLabel, request.eligibilityResult.reasonCode)} /><ReturnInfo label={text("Quyết định", "Decision")} value={request.decision?.outcome === "APPROVED" ? text("Đã duyệt", "Approved") : request.decision?.outcome === "REJECTED" ? text("Đã từ chối", "Rejected") : text("Chưa quyết định", "Not decided")} /></div><div className="space-y-2 px-5 pb-5 text-sm text-slate-600"><p>{request.eligibilityResult.explanation}</p>{request.decision?.override && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">{text("Đã duyệt ngoại lệ", "Exception approved")}: {request.decision.overrideReason}</p>}</div></RecordDetailSection>
              <EvidencePanel title={text("Bằng chứng Return", "Return evidence")} items={evidenceItems} locale={locale} />
            </>}
            {activeTab === "ITEMS" && <RecordDetailSection title="Sản phẩm & số lượng"><div className="space-y-4"><div className="overflow-x-auto"><table className="min-w-[1040px] w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Sản phẩm</th><th className="px-4 py-3 text-right">Đã mua</th><th className="px-4 py-3 text-right">Đã return trước</th><th className="px-4 py-3 text-right">Yêu cầu</th><th className="px-4 py-3 text-right">Được duyệt</th><th className="px-4 py-3 text-right">Đã nhận</th><th className="px-4 py-3 text-right">Chấp nhận</th><th className="px-5 py-3 text-right">Từ chối</th></tr></thead><tbody className="divide-y divide-slate-100">{request.items.map((item) => <tr key={item.orderLineId}><td className="px-5 py-4"><div className="font-medium text-slate-900">{item.productNameSnapshot}</div><div className="mt-1 text-slate-500">Line {item.orderLineId}</div></td><td className="px-4 py-4 text-right">{item.orderedQuantity}</td><td className="px-4 py-4 text-right">{item.previouslyAcceptedReturnQuantity}</td><td className="px-4 py-4 text-right font-medium text-violet-700">{item.requestedQuantity}</td><td className="px-4 py-4 text-right">{request.status === "REQUESTED" ? <input aria-label={`Số lượng duyệt ${item.productNameSnapshot}`} type="number" min={0} max={item.requestedQuantity} value={approvalDraft[item.orderLineId] ?? item.requestedQuantity} onChange={(event) => setApprovalDraft((current) => ({ ...current, [item.orderLineId]: Number(event.target.value) }))} className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-right outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /> : (item.approvedQuantity ?? "—")}</td><td className="px-4 py-4 text-right">{item.receivedQuantity ?? "—"}</td><td className="px-4 py-4 text-right text-emerald-700">{item.acceptedQuantity ?? "—"}</td><td className="px-5 py-4 text-right text-rose-700">{item.rejectedQuantity ?? "—"}</td></tr>)}</tbody></table></div>{request.status === "REQUESTED" && <div className="mx-5 mb-5 rounded-xl border border-violet-100 bg-violet-50 p-4"><div className="text-xs font-medium text-violet-900">Duyệt theo từng dòng hàng</div><div className="mt-1 text-xs text-violet-700">Nhập số lượng được duyệt cho từng dòng. Có thể duyệt một phần hoặc từ chối một dòng bằng số lượng 0; ghi chú chung được dùng làm lý do quyết định và lý do ngoại lệ eligibility.</div><select value={rejectionReasonCode} onChange={(event) => setRejectionReasonCode(event.target.value)} className="mt-3 h-10 w-full rounded-xl border border-violet-200 bg-white px-3 text-sm"><option value="">{text("Chọn mã lý do nếu từ chối", "Select a reason code when rejecting")}</option>{rejectionReasons.map((reason) => <option key={reason.code} value={reason.code}>{locale === "vi" ? reason.labelVi : reason.labelEn}</option>)}</select><textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder={text("Lý do duyệt / lý do override / ghi chú từ chối", "Approval reason / override reason / rejection note")} className="mt-3 w-full rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /></div>}</div></RecordDetailSection>}
            {activeTab === "RETURN_FLOW" && <section id="return-workflow-section" className="scroll-mt-4 space-y-5">
              {request.status === "APPROVED" && <RecordDetailSection title="1. Chọn cách thu hồi hàng"><div className="space-y-4 p-5"><div className="grid gap-3 md:grid-cols-2">{(Object.keys(methodLabel) as ReturnMethod[]).map((method) => <button key={method} type="button" onClick={() => setReturnMethod(method)} className={`rounded-xl border p-4 text-left transition ${returnMethod === method ? "border-violet-300 bg-violet-50 ring-2 ring-violet-100" : "border-slate-200 hover:border-slate-300"}`}><div className="text-sm font-medium text-slate-900">{methodLabel[method]}</div></button>)}</div>{returnMethod === "CARRIER_PICKUP" && <div className="grid gap-3 md:grid-cols-[1fr_auto]"><label className="space-y-1"><span className="text-xs font-medium text-slate-600">Khối lượng hàng trả thực tế (gram)</span><input type="number" min={1} value={pickupWeightGrams || ""} onChange={(event) => setPickupWeightGrams(Number(event.target.value))} className={inputClassName} /></label><Button type="button" actionIntent="create" size="sm" icon={<PackageCheck size={13} />} className="self-end" onClick={() => run(createPickup, "Đã tạo vận đơn lấy hàng và chuyển Return sang chờ hàng.")}>Tạo đơn lấy hàng</Button></div>}{returnMethod === "CUSTOMER_SELF_SHIP" && <div className="grid gap-3 md:grid-cols-2"><input value={selfShipCarrier} onChange={(event) => setSelfShipCarrier(event.target.value)} placeholder="Đơn vị vận chuyển" className={inputClassName} /><input value={selfShipTracking} onChange={(event) => setSelfShipTracking(event.target.value)} placeholder="Mã vận đơn khách gửi" className={inputClassName} /></div>}{returnMethod === "DROP_OFF" && <input value={dropOffLocation} onChange={(event) => setDropOffLocation(event.target.value)} placeholder="Điểm nhận hàng" className={inputClassName} />}{returnMethod !== "CARRIER_PICKUP" && <Button type="button" actionIntent="confirm" size="sm" onClick={() => run(configureNonPickupMethod, "Đã ghi nhận cách thu hồi hàng.")}>Xác nhận cách thu hồi</Button>}</div></RecordDetailSection>}
              {["APPROVED", "AWAITING_ITEM"].includes(request.status) && <RecordDetailSection title="2. Ghi nhận hàng nhận thực tế"><div className="space-y-4 p-5"><div className="overflow-x-auto"><table className="min-w-[980px] w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="px-3 py-3">Sản phẩm</th><th className="px-3 py-3">Được duyệt</th><th className="px-3 py-3">Nhận thực</th><th className="px-3 py-3">Chấp nhận</th><th className="px-3 py-3">Từ chối</th><th className="px-3 py-3">Tình trạng</th><th className="px-3 py-3">Ghi chú kiểm tra</th></tr></thead><tbody className="divide-y divide-slate-100">{request.items.map((item) => { const row = getReceiveRow(item); const approved = item.approvedQuantity ?? item.requestedQuantity; return <tr key={item.orderLineId}><td className="px-3 py-3 font-medium text-slate-900">{item.productNameSnapshot}</td><td className="px-3 py-3">{approved}</td><td className="px-3 py-3"><input type="number" min={0} max={approved} value={row.received} onChange={(event) => updateReceiveRow(item, { received: Number(event.target.value) })} className="h-9 w-20 rounded-lg border border-slate-200 px-2" /></td><td className="px-3 py-3"><input type="number" min={0} value={row.accepted} onChange={(event) => updateReceiveRow(item, { accepted: Number(event.target.value) })} className="h-9 w-20 rounded-lg border border-slate-200 px-2" /></td><td className="px-3 py-3"><input type="number" min={0} value={row.rejected} onChange={(event) => updateReceiveRow(item, { rejected: Number(event.target.value) })} className="h-9 w-20 rounded-lg border border-slate-200 px-2" /></td><td className="px-3 py-3"><input value={row.condition} onChange={(event) => updateReceiveRow(item, { condition: event.target.value })} className="h-9 w-36 rounded-lg border border-slate-200 px-2" /></td><td className="px-3 py-3"><input value={row.note} onChange={(event) => updateReceiveRow(item, { note: event.target.value })} className="h-9 w-48 rounded-lg border border-slate-200 px-2" /></td></tr>; })}</tbody></table></div><textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú tình trạng nhận hàng chung" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /><Button type="button" actionIntent="save" size="sm" icon={<ClipboardCheck size={13} />} onClick={() => run(receive, "Đã ghi nhận số lượng nhận thực tế. Hệ thống chỉ chuyển RECEIVED khi nhận đủ số lượng được duyệt.")}>Lưu nhận hàng & kiểm tra</Button></div></RecordDetailSection>}
              <RecordDetailSection title="Vận đơn thu hồi"><div className="space-y-3 p-5">{returnShipping.filter((booking) => booking.purpose === "RETURN_PICKUP").length === 0 ? <p className="text-sm text-slate-500">Chưa có vận đơn lấy hàng.</p> : returnShipping.filter((booking) => booking.purpose === "RETURN_PICKUP").map((booking) => <ShippingEvidenceRow key={booking.id} booking={booking} onOpen={() => navigate(`/shipping/${booking.id}`)} onSync={() => run(() => syncShippingBookingCommandBoundary(booking.id, { actorId, actorName }), "Đã đồng bộ trạng thái vận đơn.")} />)}</div></RecordDetailSection>
            </section>}
            {activeTab === "RESOLUTION" && <section id="return-workflow-section" className="scroll-mt-4 space-y-5"><RecordDetailSection title="Resolution"><div className="space-y-4 p-5">{request.status !== "RECEIVED" ? <p className="text-sm text-slate-500">Return phải nhận đủ và có inspection trước khi xử lý resolution.</p> : !request.inspection ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Chưa có inspection hoàn chỉnh. Hãy ghi nhận accepted/rejected quantity trước.</p> : <><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú xử lý" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /><div className="grid gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-2"><div className="space-y-3"><div className="font-medium text-slate-900">Hoàn tiền</div><div className="text-xs text-slate-500">Đề xuất theo giá trị dòng đã chấp nhận: {suggestedRefund.toLocaleString("vi-VN")} {order?.currency ?? "VND"}</div><input type="number" min={0} value={refundAmount || ""} onChange={(event) => setRefundAmount(Number(event.target.value))} placeholder={String(Math.round(suggestedRefund))} className={inputClassName} /><Button type="button" variant="danger" size="sm" icon={<WalletCards size={13} />} onClick={() => run(executeRefund, "Refund đã được phân bổ qua các Payment source và xác nhận bằng evidence đầy đủ.")}>Hoàn tiền qua Payment</Button></div><div className="space-y-3"><div className="font-medium text-slate-900">Replacement / Exchange</div><input type="number" min={1} value={outboundWeightGrams || ""} onChange={(event) => setOutboundWeightGrams(Number(event.target.value))} placeholder="Khối lượng kiện outbound (gram)" className={inputClassName} /><input type="number" value={exchangeDelta || ""} onChange={(event) => setExchangeDelta(Number(event.target.value))} placeholder="Chênh lệch Exchange: dương = thu thêm, âm = hoàn lại" className={inputClassName} />{exchangeDelta > 0 && <><select value={selectedExchangeMethodCode} onChange={(event) => setExchangePaymentMethodCode(event.target.value)} className={inputClassName}><option value="">{text("Chọn phương thức online từ catalog", "Select an online method from the catalog")}</option>{exchangeIntentMethods.map((method) => <option key={method.code} value={method.code}>{locale === "vi" ? method.displayNameVi : method.displayNameEn}</option>)}</select><div className="text-xs text-slate-500">{text("Thu thêm chỉ tạo Payment Intent; Shipping chỉ được booking sau khi provider trả evidence SUCCEEDED.", "A positive delta only creates a Payment Intent; Shipping is booked only after provider SUCCEEDED evidence.")}</div></>}<div className="flex flex-wrap gap-2"><Button type="button" actionIntent="create" size="sm" onClick={() => run(() => executeReplacement("REPLACEMENT"), "Đã tạo vận đơn hàng thay thế. Return chờ Shipping DELIVERED.")}>Replacement</Button><Button type="button" actionIntent="create" size="sm" onClick={() => run(() => executeReplacement("EXCHANGE"), (result) => result === "PAYMENT_PENDING" ? "Đã tạo Payment Intent thu chênh lệch. Chưa booking Shipping cho đến khi provider xác nhận SUCCEEDED." : "Đã tạo vận đơn hàng đổi. Return chờ Shipping DELIVERED.")}>Exchange</Button></div></div></div><div className="grid gap-4 rounded-xl border border-slate-200 p-4 md:grid-cols-2"><div className="space-y-3"><div className="font-medium text-slate-900">Sửa chữa</div><input value={repairReference} onChange={(event) => setRepairReference(event.target.value)} placeholder="Mã công việc sửa chữa" className={inputClassName} /><input value={repairProvider} onChange={(event) => setRepairProvider(event.target.value)} placeholder="Đơn vị sửa chữa (tùy chọn)" className={inputClassName} /><textarea rows={2} value={repairResult} onChange={(event) => setRepairResult(event.target.value)} placeholder="Kết quả sửa chữa / evidence" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" /><Button type="button" actionIntent="complete" size="sm" onClick={() => run(executeRepair, "Repair evidence đã hoàn tất và Return đã RESOLVED.")}>Hoàn tất sửa chữa</Button></div><div className="space-y-3"><div className="font-medium text-slate-900">Từ chối sau kiểm tra</div><div className="text-xs text-slate-500">Dùng khi hàng nhận thực tế không đạt chính sách đổi/trả sau bước inspection. Lý do phải được ghi rõ để audit.</div><Button type="button" actionIntent="destructive" size="sm" onClick={() => run(rejectAfterInspection, "Return đã được xử lý theo kết quả từ chối sau kiểm tra.")}>Từ chối sau kiểm tra</Button></div></div></>}</div></RecordDetailSection>
              <RecordDetailSection title="Downstream evidence"><div className="space-y-3 p-5">{intents.length === 0 ? <p className="text-sm text-slate-500">Chưa có downstream intent.</p> : intents.map((intent) => { const booking = intent.target === "SHIPPING" ? shipping.find((item) => item.id === intent.externalReference) : undefined; const references = intent.externalReferences?.length ? intent.externalReferences : intent.externalReference ? [intent.externalReference] : []; const canCompleteShipping = request.status === "RECEIVED" && intent.status === "PENDING" && intent.target === "SHIPPING" && booking?.externalStatus === "DELIVERED" && Boolean(booking.deliveredAt); return <div key={intent.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="text-xs font-medium text-slate-900">{intent.action} → {intent.target}</div><div className="mt-1 text-[11px] text-slate-500">{intent.status} · {references.length ? `${references.length} evidence reference(s)` : "Chưa có downstream reference"}</div>{booking && <div className="mt-1 text-[11px] text-violet-600">Shipping {booking.externalStatus}{booking.deliveredAt ? ` · ${new Date(booking.deliveredAt).toLocaleString("vi-VN")}` : ""}</div>}</div>{canCompleteShipping && <Button type="button" actionIntent="complete" size="sm" icon={<Truck size={13} />} onClick={() => run(() => completeDeliveredReplacement(intent), "Shipping DELIVERED evidence đã được xác nhận; Return đã RESOLVED.")}>Hoàn tất resolution</Button>}</div></div>; })}</div></RecordDetailSection></section>}
            {activeTab === "ACTIVITY" && <RecordDetailSection title={text("Kiểm toán", "Audit")}><div className="p-5"><AuditTrailViewer resourceKey="returns" recordId={request.id} embedded /></div></RecordDetailSection>}
          </motion.div>
        </div>
        <OperationInsightPanel
          title="Return insight"
          score={operationalScore}
          scoreLabel="Case progress"
          items={[
            { label: "Operational stage", value: operationalStage, tone: blockers.length ? "warning" : "success" },
            { label: "Tiến độ nhận hàng", value: `${receivedTotal}/${approvedTotal}`, tone: receivedTotal >= approvedTotal && approvedTotal > 0 ? "success" : "info" },
            { label: "Accepted", value: `${acceptedTotal} đơn vị`, tone: acceptedTotal > 0 ? "success" : "neutral" },
            { label: "Downstream evidence", value: `${intents.filter((item) => item.status === "SUCCEEDED").length}/${intents.length}`, tone: intents.some((item) => item.status === "PENDING") ? "warning" : "success" },
          ]}
          blockers={blockers}
          nextAction={nextAction}
        >
          <div className="border-t border-slate-100 pt-4"><div className="mb-3 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">Lifecycle</div><OperationLifecycleRail steps={lifecycle} /></div>
          <div className="border-t border-slate-100 pt-4"><div className="mb-3 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">{text("Nguồn bằng chứng", "Evidence sources")}</div><div className="space-y-2 text-[11px] font-medium"><div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-400">{text("Giao hàng:", "Delivery:")}</span> <span className="text-slate-700">{request.deliveryEvidenceShippingBookingId ? `Shipping · ${request.deliveryEvidenceShippingBookingId}` : request.manualDeliveryEvidence ? `${text("Thủ công", "Manual")} · ${request.manualDeliveryEvidence.evidenceRef} · ${request.manualDeliveryEvidence.reason} · ${request.manualDeliveryEvidence.actorName || request.manualDeliveryEvidence.actorId}` : text("Chưa có bằng chứng", "No evidence")}</span></div><div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-400">{text("Thực nhận:", "Receipt:")}</span> <span className="text-slate-700">{request.receivedAt ? new Date(request.receivedAt).toLocaleString(locale === "vi" ? "vi-VN" : "en-US") : text("Chưa nhận đủ", "Not fully received")}</span></div><div className="rounded-lg bg-slate-50 px-3 py-2"><span className="text-slate-400">{text("Kiểm tra:", "Inspection:")}</span> <span className="text-slate-700">{request.inspection ? `${request.inspection.inspectedBy} · ${new Date(request.inspection.inspectedAt).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}` : text("Chưa hoàn tất", "Not completed")}</span></div></div></div>
        </OperationInsightPanel>
      </div>
    </RecordDetailFrame>
  );
};
