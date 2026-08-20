import { formatApplicationError } from "@/shared/operations";
import { formatMoneyDto } from "@/shared/money";
import { createCreateCommandTarget, createProvisionalDocumentNumber } from "@/shared/ids";
import React, { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Activity,
  Box,
  CheckCircle2,
  ClipboardList,
  MapPin,
  PackageSearch,
  RefreshCw,
  RotateCcw,
  Route,
  Settings2,
  Truck,
  Users,
  WalletCards,
  XCircle,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, ConfirmDialog, SearchableSelect, Select, Textarea } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import {
  RecordDetailFrame,
  RecordDetailHeader,
  RecordDetailSection,
  recordDetailHeaderActionButtonClassName,
} from "@/components/crm/detail-archetype";
import {
  OperationDetailTabs,
  OperationInsightPanel,
  OperationLifecycleRail,
} from "@/components/crm/operations";
import { cancelShippingBookingCommandBoundary, changeShippingProviderCommandBoundary, getShippingSnapshot, getShippingProviderSnapshot, listShippingProviders, retryShippingBookingCommandBoundary, subscribeToShipping } from "../../public/api";
import { useEffectiveAccess } from "@/platform/access-control";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { getOrderListSnapshot, subscribeToOrderList } from "@/modules/orders";
import { getReturnsSnapshot, subscribeToReturns } from "@/modules/returns";
import { getOperationalAuditSnapshot, subscribeToOperationalAudit } from "@/platform/operational-audit";
import { useSubscribableSnapshot } from "@/platform/react";
import { syncShippingAndPaymentCodEvidence } from "@/workflows/shipping-cod-evidence";
import { ShippingBookingStatusBadge, ShippingCarrierStatusBadge } from "../components/ShippingStatusBadges";
import { resolveShippingHeaderActionIds } from "../model/shippingActionPolicy";
import { CommercialLineagePanel } from "@/components/crm/CommercialLineagePanel";
import { EvidencePanel, type EvidenceItem } from "@/shared/evidence";
import { getReasonCatalog } from "@/platform/configuration-runtime";

const purposeLabel: Record<string, string> = {
  ORDER_OUTBOUND: "Giao đơn hàng",
  RETURN_PICKUP: "Lấy hàng trả",
  REPLACEMENT_OUTBOUND: "Giao hàng thay thế",
  RETURN_TO_CUSTOMER: "Trả hàng lại khách",
};
const Info: React.FC<{ label: string; value: React.ReactNode; hint?: React.ReactNode }> = ({ label, value, hint: _hint }) => <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"><div className="text-[10px] font-medium uppercase tracking-[0.13em] text-slate-400">{label}</div><div className="mt-1 break-words text-sm font-medium text-slate-900">{value}</div></div>;
type ShippingDetailTab = "OVERVIEW" | "PARTIES" | "PACKAGE" | "JOURNEY" | "ATTEMPTS";

export const ShippingBookingDetailPage: React.FC = () => {
  const { shippingBookingId = "" } = useParams();
  const navigate = useNavigate();
  const { locale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;
  const access = useEffectiveAccess();
  const reduceMotion = useReducedMotion();
  const records = useSubscribableSnapshot(getShippingSnapshot, subscribeToShipping);
  const orders = useSubscribableSnapshot(getOrderListSnapshot, subscribeToOrderList);
  const returnsSnapshot = useSubscribableSnapshot(getReturnsSnapshot, subscribeToReturns);
  const audit = useSubscribableSnapshot(() => getOperationalAuditSnapshot("shipping", shippingBookingId), subscribeToOperationalAudit);
  const record = records.find((item) => item.id === shippingBookingId);
  const [activeTab, setActiveTab] = useState<ShippingDetailTab>("OVERVIEW");
  const [providerId, setProviderId] = useState(record?.providerId ?? "manual");
  const [message, setMessage] = useState<string | null>(null);
  const cancellationReasons = getReasonCatalog("SHIPPING_CANCELLATION")?.entries.filter((entry) => entry.enabled) ?? [];
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReasonCode, setCancelReasonCode] = useState(cancellationReasons[0]?.code ?? "");
  const [cancelNote, setCancelNote] = useState("");
  const providers = useMemo(() => listShippingProviders(), []);
  const actorId = access.memberId || access.accountId || "current-user";
  const actorName = getAuthSessionSnapshot()?.principal.displayName || actorId;

  if (!record) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-600">Không tìm thấy vận đơn.</div>;

  const shipmentGroupId = record.shipmentGroupId;
  const attempts = records
    .filter((item) => item.shipmentGroupId === shipmentGroupId)
    .sort((a, b) => (a.attemptNo ?? 1) - (b.attemptNo ?? 1));
  const sourceReference = record.sourceType === "ORDER"
    ? orders.find((order) => order.id === record.sourceId)?.orderNumber ?? text("Đơn hàng liên quan", "Related order")
    : returnsSnapshot.requests.find((request) => request.id === record.sourceId)?.code ?? text("Yêu cầu đổi / trả liên quan", "Related return request");
  const sourceTypeLabel = record.sourceType === "ORDER" ? text("Đơn hàng", "Order") : text("Đổi / Trả hàng", "Return");
  const permissions = {
    canView: access.canPerform("shipping", "read"),
    canSync: access.canPerform("shipping", "sync"),
    canRetry: access.canPerform("shipping", "retry"),
    canCancel: access.canPerform("shipping", "cancel"),
  };
  const configuredProvider = getShippingProviderSnapshot(record.providerId);
  const actionIds = resolveShippingHeaderActionIds(record, permissions, configuredProvider);
  const run = async (action: () => unknown | Promise<unknown>, success: string) => {
    try { await action(); setMessage(success); } catch (error) { setMessage(formatApplicationError(error, { locale })); }
  };
  const deliveryEvidence: EvidenceItem[] = [
    ...(record.deliveredAt ? [{
      id: `delivery:${record.id}`,
      type: "DELIVERY_POD" as const,
      externalReference: record.trackingCode || record.externalBookingId || record.id,
      capturedAt: record.deliveredAt,
      capturedBy: record.providerNameSnapshot,
      verificationState: "VERIFIED" as const,
      notes: text("Carrier xác nhận giao thành công.", "Carrier confirmed successful delivery."),
      lockedByBusinessEvent: true,
      createdAt: record.deliveredAt,
    }] : []),
    ...(record.codCollectedAt ? [{
      id: `cod:${record.id}`,
      type: "COD_REMITTANCE" as const,
      externalReference: record.trackingCode || record.id,
      capturedAt: record.codCollectedAt,
      capturedBy: record.providerNameSnapshot,
      verificationState: "VERIFIED" as const,
      notes: text("Bằng chứng carrier đã thu COD; việc merchant nhận tiền vẫn thuộc Payment reconciliation.", "Carrier COD collection evidence; merchant receipt remains a Payment reconciliation concern."),
      lockedByBusinessEvent: true,
      createdAt: record.codCollectedAt,
    }] : []),
  ];

  const actions = actionIds.map((actionId) => {
    if (actionId === "sync") return <Button key={actionId} type="button" actionIntent="sync" size="sm" icon={<RefreshCw size={13} />} className={recordDetailHeaderActionButtonClassName} onClick={() => run(() => syncShippingAndPaymentCodEvidence(record.id, { actorId, actorName }), "Đã đồng bộ carrier; COD collection evidence (nếu có) đã được chuyển sang Payment.")}>Đồng bộ</Button>;
    if (actionId === "retry") return <Button key={actionId} type="button" actionIntent="retry" size="sm" icon={<RotateCcw size={13} />} className={recordDetailHeaderActionButtonClassName} onClick={() => run(() => retryShippingBookingCommandBoundary(record.id, { id: createCreateCommandTarget("shipping"), code: createProvisionalDocumentNumber("SHP"), actorId, actorName }), "Đã tạo attempt retry mới; booking cũ được giữ nguyên.")}>Thử lại</Button>;
    if (actionId === "change-provider") return <Button key={actionId} type="button" actionIntent="retry" size="sm" icon={<Settings2 size={13} />} className={recordDetailHeaderActionButtonClassName} onClick={() => run(() => changeShippingProviderCommandBoundary(record.id, { id: createCreateCommandTarget("shipping"), code: createProvisionalDocumentNumber("SHP"), providerId, actorId, actorName }), "Đã tạo booking mới với provider khác.")}>Đổi provider</Button>;
    if (actionId === "label") return <Button key={actionId} type="button" actionIntent="neutral" size="sm" icon={<ClipboardList size={13} />} className={recordDetailHeaderActionButtonClassName} onClick={() => { const content = `LABEL\n${record.code}\n${record.recipientSnapshot.name}\n${record.recipientSnapshot.address.line1}`; const blob = new Blob([content], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${record.code}-label.txt`; anchor.click(); URL.revokeObjectURL(url); }}>{text("Tải nhãn", "Download label")}</Button>;
    if (actionId === "cancel") return <Button key={actionId} type="button" actionIntent="destructive" size="sm" icon={<XCircle size={13} />} className={recordDetailHeaderActionButtonClassName} onClick={() => setCancelOpen(true)}>Hủy booking</Button>;
    return null;
  });
  if (record.sourceType === "ORDER" && record.externalStatus === "DELIVERED" && record.deliveredAt && access.canPerform("returns", "create")) {
    actions.push(<Button key="create-return" type="button" actionIntent="create" size="sm" icon={<RotateCcw size={13} />} className={recordDetailHeaderActionButtonClassName} onClick={() => navigate(`/returns/new?orderId=${record.sourceId}&shippingBookingId=${record.id}`)}>{text("Tạo yêu cầu đổi/trả", "Create return request")}</Button>);
  }

  const blockers = [
    ...(record.readiness?.missingRequired ?? []).map((item) => `Thiếu dữ liệu booking: ${item}`),
    ...(record.bookingStatus === "FAILED" ? [record.lastErrorMessage || "Booking attempt thất bại."] : []),
    ...(record.externalStatus === "DELIVERY_FAILED" ? ["Carrier báo giao thất bại; cần xử lý lại tuyến giao."] : []),
    ...(record.lastErrorCode || record.lastErrorMessage ? [`Sync/provider error: ${record.lastErrorCode || record.lastErrorMessage}`] : []),
  ];
  const baseReadiness = record.readiness?.score ?? 100;
  const operationalScore = Math.max(0, Math.min(100, baseReadiness - (record.bookingStatus === "FAILED" ? 25 : 0) - (record.externalStatus === "DELIVERY_FAILED" ? 20 : 0)));
  const nextAction = record.bookingStatus === "FAILED"
    ? { title: "Bước vận hành tiếp theo", label: "Tạo lần giao mới", description: "Thử lại trong cùng nhóm giao hàng để giữ đúng yêu cầu và toàn bộ lịch sử.", actionLabel: "Retry booking", variant: "warning" as const, onClick: () => run(() => retryShippingBookingCommandBoundary(record.id, { id: createCreateCommandTarget("shipping"), code: createProvisionalDocumentNumber("SHP"), actorId, actorName }), "Đã tạo attempt retry mới.") }
    : record.bookingStatus === "BOOKED" && record.externalStatus !== "DELIVERED"
      ? { title: "Bước vận hành tiếp theo", label: "Đồng bộ đơn vị vận chuyển", description: "Cập nhật hành trình và chuyển bằng chứng COD sang Thanh toán nếu có.", actionLabel: "Đồng bộ", variant: "info" as const, onClick: () => run(() => syncShippingAndPaymentCodEvidence(record.id, { actorId, actorName }), "Đã đồng bộ carrier.") }
      : { title: "Bước vận hành tiếp theo", label: "Mở nguồn liên quan", description: "Xem đơn hàng hoặc yêu cầu đổi / trả đã tạo yêu cầu giao hàng này.", actionLabel: "Mở hồ sơ nguồn", variant: "info" as const, onClick: () => navigate(record.sourceType === "ORDER" ? `/orders/${record.sourceId}` : `/returns/${record.sourceId}`) };

  const lifecycle = [
    { key: "ready", label: "Booking readiness", description: `${record.readiness?.score ?? 0}%`, state: record.readiness?.ready ? "done" as const : "blocked" as const },
    { key: "booked", label: "Đặt vận chuyển", description: record.bookingStatus, state: record.bookingStatus === "BOOKED" ? "done" as const : record.bookingStatus === "FAILED" ? "blocked" as const : "current" as const },
    { key: "pickup", label: "Lấy hàng", description: record.externalStatus, state: ["PICKED_UP", "IN_TRANSIT", "DELIVERED"].includes(record.externalStatus) ? "done" as const : record.externalStatus === "DELIVERY_FAILED" ? "blocked" as const : "current" as const },
    { key: "transit", label: "Đang vận chuyển", description: record.externalStatus, state: ["IN_TRANSIT", "DELIVERED"].includes(record.externalStatus) ? "done" as const : ["PICKED_UP", "WAITING_PICKUP"].includes(record.externalStatus) ? "current" as const : "next" as const },
    { key: "delivery", label: "Giao thành công", description: record.deliveredAt ? new Date(record.deliveredAt).toLocaleString("vi-VN") : "Chưa có deliveredAt evidence", state: record.externalStatus === "DELIVERED" && record.deliveredAt ? "done" as const : record.externalStatus === "DELIVERY_FAILED" ? "blocked" as const : "next" as const },
  ];

  const tabItems = [
    { key: "OVERVIEW", label: "Tổng quan", icon: <Truck size={14} /> },
    { key: "PARTIES", label: "Người gửi & nhận", icon: <Users size={14} /> },
    { key: "PACKAGE", label: "Kiện hàng", icon: <Box size={14} />, count: record.packageSnapshot.lineAllocations?.length ?? 0 },
    { key: "JOURNEY", label: "Hành trình", icon: <Route size={14} /> },
    { key: "ATTEMPTS", label: "Lần thử & hoạt động", icon: <Activity size={14} />, count: attempts.length + audit.length, alert: record.bookingStatus === "FAILED" },
  ];

  return (
    <RecordDetailFrame id="shipping-detail-page">
      <RecordDetailHeader
        id="shipping-detail-header"
        backLabel="Quay lại Vận đơn"
        onBack={() => navigate("/shipping")}
        identityIcon={<Truck size={20} />}
        identityToneClassName="border-sky-200 bg-sky-50 text-sky-700"
        title={record.code}
        status={<ShippingBookingStatusBadge status={record.bookingStatus} />}
        metadata={<><span>{record.providerNameSnapshot}</span><span>•</span><span>{purposeLabel[record.purpose]}</span><span>•</span><span>{record.transportMode || record.packageSnapshot.transportMode || "DOMESTIC"}</span><span>•</span><ShippingCarrierStatusBadge status={record.externalStatus} /></>}
        actions={actions}
      />

      <AnimatePresence>{message && <motion.div initial={reduceMotion ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs font-medium text-sky-800">{message}</motion.div>}</AnimatePresence>

      <OperationDetailTabs items={tabItems} activeKey={activeTab} onChange={(key) => setActiveTab(key as ShippingDetailTab)} ariaLabel="Các phần chi tiết vận đơn" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={activeTab} initial={reduceMotion ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={reduceMotion ? undefined : { opacity: 0, x: -8 }} className="space-y-5">
              {activeTab === "OVERVIEW" && <>
                <RecordDetailSection title="Tổng quan vận đơn"><div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4"><Info label={text("Nguồn", "Source")} value={`${sourceTypeLabel} · ${sourceReference}`} /><Info label={text("Mục đích", "Purpose")} value={purposeLabel[record.purpose]} /><Info label={text("Đợt giao hàng", "Shipment attempts")} value={`${attempts.length} ${text("lần thử", "attempts")}`} /><Info label={text("Lần hiện tại", "Current attempt")} value={`${record.attemptNo ?? 1}/${attempts.length}`} /><Info label="Tracking" value={record.trackingCode || "—"} /><Info label="Dịch vụ" value={record.serviceNameSnapshot || record.serviceCode || "—"} /><Info label="Provider" value={record.providerNameSnapshot} /><Info label="Provider updated" value={record.providerUpdatedAt ? new Date(record.providerUpdatedAt).toLocaleString("vi-VN") : "—"} /></div></RecordDetailSection>

                <RecordDetailSection title="Booking & carrier truth"><div className="grid gap-4 p-5 md:grid-cols-2"><div className="rounded-2xl border border-sky-200 bg-sky-50 p-4"><div className="text-[10px] font-medium uppercase tracking-[0.13em] text-sky-500">Internal booking state</div><div className="mt-3"><ShippingBookingStatusBadge status={record.bookingStatus} /></div><div className="mt-3 text-xs font-medium leading-relaxed text-sky-700">Quản lý booking attempt, retry và cancellation. Không thay thế carrier status.</div></div><div className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><div className="text-[10px] font-medium uppercase tracking-[0.13em] text-violet-500">External carrier state</div><div className="mt-3"><ShippingCarrierStatusBadge status={record.externalStatus} /></div><div className="mt-3 text-xs font-medium leading-relaxed text-violet-700">Order completion chỉ đọc canonical DELIVERED cùng deliveredAt evidence.</div></div></div></RecordDetailSection>

                <RecordDetailSection title="Nguồn liên quan"><div className="p-5"><button type="button" onClick={() => navigate(record.sourceType === "ORDER" ? `/orders/${record.sourceId}` : `/returns/${record.sourceId}`)} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-violet-100 bg-violet-50 p-4 text-left transition hover:border-violet-200 hover:shadow-sm"><div><div className="text-[10px] font-medium uppercase tracking-wider text-violet-500">{record.sourceType === "ORDER" ? "Đơn hàng" : "Đổi / Trả hàng"}</div><div className="mt-1 font-medium text-violet-900">{sourceReference}</div></div><Route size={18} className="text-violet-600" /></button></div></RecordDetailSection>
              </>}

              {activeTab === "PARTIES" && <>
                <RecordDetailSection title="Người nhận"><div className="grid gap-3 p-5 md:grid-cols-2"><Info label="Tên người nhận" value={record.recipientSnapshot.name} hint={record.recipientSnapshot.phone} /><Info label="Địa chỉ giao" value={`${record.recipientSnapshot.address.line1}, ${record.recipientSnapshot.address.city}`} hint={[record.recipientSnapshot.address.district, record.recipientSnapshot.address.ward].filter(Boolean).join(" · ") || "Không có district/ward snapshot"} /></div></RecordDetailSection>
                <RecordDetailSection title="Điểm lấy & hoàn hàng"><div className="grid gap-3 p-5 md:grid-cols-2"><Info label="Điểm lấy hàng" value={record.pickupLocationSnapshot?.name || record.pickupLocationSnapshot?.line1 || "—"} hint={record.pickupLocationSnapshot ? `${record.pickupLocationSnapshot.contactName || "—"} · ${record.pickupLocationSnapshot.phone || "—"}` : "Authoritative pickup projection not included"} /><Info label="Địa chỉ hoàn thất bại" value={record.returnLocationSnapshot?.name || record.returnLocationSnapshot?.line1 || "Chưa tách riêng"} hint={record.returnLocationSnapshot ? `${record.returnLocationSnapshot.city}` : "Đang dùng policy mặc định"} /></div></RecordDetailSection>
                <RecordDetailSection title="Delivery instructions"><div className="p-5"><div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium leading-relaxed text-slate-700">{record.packageSnapshot.deliveryNote || "Không có ghi chú giao hàng."}</div></div></RecordDetailSection>
              </>}

              {activeTab === "PACKAGE" && <>
                <RecordDetailSection title={text("Kiện hàng & COD boundary", "Package & COD boundary")}><div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4"><Info label={text("Số kiện", "Package count")} value={record.packageSnapshot.packageCount} /><Info label={text("Trọng lượng thực", "Actual weight")} value={`${new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(record.packageSnapshot.totalWeightGrams)} g`} /><Info label={text("Khối lượng quy đổi", "Volumetric weight")} value={record.packageSnapshot.volumetricWeightGrams ? `${new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(record.packageSnapshot.volumetricWeightGrams)} g` : "—"} /><Info label={text("Kích thước", "Dimensions")} value={record.packageSnapshot.lengthCm && record.packageSnapshot.widthCm && record.packageSnapshot.heightCm ? `${record.packageSnapshot.lengthCm} × ${record.packageSnapshot.widthCm} × ${record.packageSnapshot.heightCm} cm` : "—"} /><Info label={text("Loại hàng", "Goods type")} value={record.packageSnapshot.goodsType || "PARCEL"} /><Info label={text("Phương thức lấy / giao", "Pickup / delivery method")} value={`${record.packageSnapshot.pickupMethod || "ADDRESS"} / ${record.packageSnapshot.deliveryMethod || "ADDRESS"}`} /><Info label="COD requested" value={record.codAmount ? formatMoneyDto(record.codAmount, locale === "vi" ? "vi-VN" : "en-US") : "—"} hint={text("Shipping chỉ mang yêu cầu thu hộ", "Shipping only carries the collection instruction")} /><Info label="Fee payer" value={record.packageSnapshot.feePayer || "—"} /><Info label="Inspection" value={record.packageSnapshot.inspectionPolicy || "—"} /><Info label="Declared value" value={record.packageSnapshot.declaredValue ? formatMoneyDto(record.packageSnapshot.declaredValue, locale === "vi" ? "vi-VN" : "en-US") : "—"} /><Info label={text("Nội dung", "Contents")} value={record.packageSnapshot.itemSummary || "—"} /><Info label={text("Mã khuyến mại", "Promotion code")} value={record.packageSnapshot.promotionCode || "—"} /><Info label={text("Bảo hiểm", "Insurance")} value={record.packageSnapshot.insuranceRequested ? text("Có", "Yes") : text("Không", "No")} /></div></RecordDetailSection>
                <RecordDetailSection title={text("Tính chất hàng hóa", "Goods characteristics")}><div className="flex flex-wrap gap-2 p-5">{Object.entries(record.packageSnapshot.handling || {}).filter(([, enabled]) => enabled).length ? Object.entries(record.packageSnapshot.handling || {}).filter(([, enabled]) => enabled).map(([key]) => <span key={key} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-800">{key}</span>) : <span className="text-xs font-medium text-slate-500">{text("Không có thuộc tính xử lý đặc biệt.", "No special handling characteristics.")}</span>}</div></RecordDetailSection>
                <RecordDetailSection title="Line allocation"><div className="overflow-x-auto">{record.packageSnapshot.lineAllocations?.length ? <table className="min-w-[760px] w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Sản phẩm</th><th className="px-4 py-3">SKU</th><th className="px-4 py-3 text-right">Số lượng</th><th className="px-4 py-3 text-right">{text("Khối lượng", "Weight")}</th><th className="px-4 py-3">{text("HS Code", "HS Code")}</th><th className="px-4 py-3">{text("Xuất xứ", "Origin")}</th><th className="px-5 py-3 text-right">{text("Khai giá", "Declared value")}</th></tr></thead><tbody className="divide-y divide-slate-100">{record.packageSnapshot.lineAllocations.map((line) => <tr key={`${line.orderLineId}:${line.productId}`} className="hover:bg-sky-50/30"><td className="px-5 py-4 font-medium text-slate-900">{line.productNameSnapshot}</td><td className="px-4 py-4 text-slate-500">{line.skuSnapshot || "—"}</td><td className="px-4 py-4 text-right font-medium">{line.quantity}</td><td className="px-4 py-4 text-right">{line.weightGrams ? `${new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US").format(line.weightGrams)} g` : "—"}</td><td className="px-4 py-4 text-slate-500">{line.hsCode || "—"}</td><td className="px-4 py-4 text-slate-500">{line.countryOfOrigin || "—"}</td><td className="px-5 py-4 text-right">{line.declaredValue ? formatMoneyDto(line.declaredValue, "vi-VN") : "—"}</td></tr>)}</tbody></table> : <div className="p-5 text-xs font-medium text-amber-700">Booking cũ chưa có line allocation có cấu trúc.</div>}</div></RecordDetailSection>
                {record.packageSnapshot.customs && <RecordDetailSection title={text("Hải quan & chứng từ", "Customs & documents")}><div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4"><Info label={text("Mô tả khai báo", "Customs description")} value={record.packageSnapshot.customs.contentsDescription || "—"} /><Info label={text("Số hóa đơn", "Invoice number")} value={record.packageSnapshot.customs.invoiceNumber || "—"} /><Info label={text("Mã số thuế / định danh", "Tax / identity number")} value={record.packageSnapshot.customs.taxIdentificationNumber || "—"} /><Info label={text("Chứng từ", "Documents")} value={record.packageSnapshot.customs.documentNames?.join(", ") || "—"} /></div></RecordDetailSection>}
              </>}

              {activeTab === "JOURNEY" && <>
                <RecordDetailSection title="Hành trình vận chuyển"><div className="p-5"><OperationLifecycleRail steps={lifecycle} /></div></RecordDetailSection>
                <RecordDetailSection title="Delivery evidence"><div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4"><Info label="Delivered at" value={record.deliveredAt ? new Date(record.deliveredAt).toLocaleString("vi-VN") : "Chưa có evidence"} /><Info label="External booking ID" value={record.externalBookingId || "—"} /><Info label="Correlation" value={record.correlationId} /><Info label="COD collected" value={record.codCollectedAt ? new Date(record.codCollectedAt).toLocaleString("vi-VN") : "Chưa có carrier evidence"} /></div></RecordDetailSection>
                <EvidencePanel title={text("Bằng chứng vận chuyển", "Shipping evidence")} items={deliveryEvidence} locale={locale} />
              </>}

              {activeTab === "ATTEMPTS" && <>
                <RecordDetailSection title="Shipment attempts"><div className="space-y-3 p-5">{attempts.map((attempt) => <button key={attempt.id} type="button" onClick={() => navigate(`/shipping/${attempt.id}`)} className={`flex w-full flex-col gap-3 rounded-xl border p-4 text-left transition hover:border-sky-200 hover:bg-sky-50/40 sm:flex-row sm:items-center sm:justify-between ${attempt.id === record.id ? "border-sky-300 bg-sky-50" : "border-slate-200"}`}><div><div className="font-medium text-slate-900">{text("Lần thử", "Attempt")} {attempt.attemptNo ?? 1} · {attempt.code}</div><div className="mt-1 text-xs font-medium text-slate-500">{attempt.providerNameSnapshot} · {attempt.serviceNameSnapshot || attempt.serviceCode || "No service"}</div></div><div className="flex items-center gap-2"><ShippingBookingStatusBadge status={attempt.bookingStatus} /><ShippingCarrierStatusBadge status={attempt.externalStatus} /></div></button>)}</div></RecordDetailSection>
                <RecordDetailSection title="Audit trail"><div className="space-y-0 p-5">{audit.length ? audit.map((event, index) => <div key={event.id} className="relative flex gap-3 pb-5 last:pb-0">{index < audit.length - 1 && <div className="absolute left-[7px] top-4 h-[calc(100%-6px)] w-px bg-slate-200" />}<div className="relative z-10 mt-1 h-4 w-4 shrink-0 rounded-full border-4 border-sky-100 bg-sky-600" /><div className="min-w-0"><div className="text-xs font-medium text-slate-800">{event.action}</div><div className="mt-1 break-words text-xs font-medium text-slate-500">{event.actorName || event.actorId} · {new Date(event.occurredAt).toLocaleString("vi-VN")}</div></div></div>) : <div className="text-xs text-slate-500">Chưa có hoạt động.</div>}</div></RecordDetailSection>
              </>}
            </motion.div>
          </AnimatePresence>
        </div>

        <OperationInsightPanel
          title="Shipping insight"
          score={operationalScore}
          scoreLabel="Operational readiness"
          items={[
            { label: "Booking", value: record.bookingStatus, tone: record.bookingStatus === "BOOKED" ? "success" : record.bookingStatus === "FAILED" ? "danger" : "warning" },
            { label: "Carrier", value: record.externalStatus, tone: record.externalStatus === "DELIVERED" ? "success" : record.externalStatus === "DELIVERY_FAILED" ? "danger" : "info" },
            { label: "Attempt", value: `#${record.attemptNo ?? 1} / ${attempts.length}`, tone: "neutral" },
            { label: "COD", value: record.codAmount ? formatMoneyDto(record.codAmount, "vi-VN") : "Không có", tone: record.codAmount ? "warning" : "neutral" },
          ]}
          blockers={blockers}
          nextAction={nextAction}
        >
          {actionIds.includes("change-provider") && <div className="border-t border-slate-100 pt-4"><div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-700"><Settings2 size={14} />Provider recovery</div><SearchableSelect value={providerId} onChange={setProviderId} clearable={false} placeholder={locale === "vi" ? "Chọn đơn vị vận chuyển" : "Select carrier"} searchPlaceholder={locale === "vi" ? "Tìm đơn vị vận chuyển..." : "Search carriers..."} options={providers.map((provider) => ({ value: provider.id, label: provider.name, description: provider.id }))} /><div className="mt-2 text-[11px] font-medium leading-relaxed text-slate-500">Đổi provider tạo attempt mới, không sửa hoặc mất lịch sử booking cũ.</div></div>}
          <div className="border-t border-slate-100 pt-4"><div className="mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400"><ClipboardList size={13} />Booking checklist</div><div className="space-y-2">{[
            ["Người nhận", Boolean(record.recipientSnapshot.name && record.recipientSnapshot.phone)],
            ["Địa chỉ giao", Boolean(record.recipientSnapshot.address.line1 && record.recipientSnapshot.address.city)],
            ["Điểm lấy hàng", Boolean(record.pickupLocationSnapshot?.line1 && record.pickupLocationSnapshot?.city)],
            ["Khối lượng thực", record.packageSnapshot.totalWeightGrams > 0],
            ["Line allocation", Boolean(record.packageSnapshot.lineAllocations?.length)],
            ["Dịch vụ", Boolean(record.serviceCode || record.serviceNameSnapshot)],
          ].map(([label, ready]) => <div key={String(label)} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-medium"><span className="text-slate-600">{label}</span><span className={ready ? "text-emerald-700" : "text-rose-700"}>{ready ? "Đủ" : "Thiếu"}</span></div>)}</div></div>
        </OperationInsightPanel>
      </div>

      <ConfirmDialog isOpen={cancelOpen} onClose={() => { setCancelOpen(false); setCancelReasonCode(cancellationReasons[0]?.code ?? ""); setCancelNote(""); }} onConfirm={() => run(async () => { if (!cancelReasonCode || !cancelNote.trim()) throw new Error(text("Mã lý do và ghi chú hủy là bắt buộc.", "Reason code and cancellation note are required.")); await cancelShippingBookingCommandBoundary(record.id, { reason: `${cancelReasonCode}: ${cancelNote.trim()}`, actorId, actorName }); setCancelOpen(false); setCancelNote(""); }, "Đã hủy booking; record và lịch sử vẫn được giữ lại.")} title={text("Hủy vận đơn", "Cancel shipping booking")} message={<div className="space-y-3 text-left"><p>{text(`Hủy booking ${record.code}. Đây không phải trạng thái Order FAILED và không xóa record.`, `Cancel booking ${record.code}. This does not set the Order to FAILED and does not delete the record.`)}</p><Select label={text("Mã lý do *", "Reason code *")} value={cancelReasonCode} onChange={(event) => setCancelReasonCode(event.target.value)}><option value="">{text("Chọn lý do", "Select reason")}</option>{cancellationReasons.map((reason) => <option key={reason.code} value={reason.code}>{locale === "vi" ? reason.labelVi : reason.labelEn}</option>)}</Select><Textarea label={text("Ghi chú hủy *", "Cancellation note *")} value={cancelNote} onChange={(event) => setCancelNote(event.target.value)} /></div>} confirmText={text("Hủy vận đơn", "Cancel booking")} cancelText={text("Quay lại", "Go back")} variant="danger" />
      <CommercialLineagePanel anchorType="SHIPPING" anchorId={record.id} locale={locale} />
    </RecordDetailFrame>
  );
};
