import { useRef as useWorkspaceBindingRef } from "react";
import { useWorkspaceContextSnapshot as useWorkflowWorkspace } from "@/platform/workspace-context";
import { useTargetBoundWorkflow } from "@/shared/presentation/useTargetBoundWorkflow";
import { formatApplicationError } from "@/shared/operations";
import { createCreateCommandTarget, createProvisionalDocumentNumber } from "@/shared/ids";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, PackageOpen, ShieldCheck } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Input, SearchableSelect } from "@/shared/components/ui";
import { toWorkspacePath } from "@/platform/navigation";
import { getOrderListSnapshot, orderRequiresShipping, resolveOrderLineFulfillmentKind, subscribeToOrderList } from "@/modules/orders";
import { getShippingSnapshot, subscribeToShipping } from "@/modules/shipping";
import { useEffectiveAccess } from "@/platform/access-control";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { resolveWorkspaceMemberName } from "@/platform/member-directory";
import { useSubscribableSnapshot } from "@/platform/react";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { useI18n } from "@/i18n";
import { createReturnRequestCommand, getReturnsSnapshot, subscribeToReturns, type RequestedReturnResolution, type ReturnReason } from "../../public/api";

const REASONS: Array<{ value: ReturnReason; vi: string; en: string }> = [
  { value: "DEFECTIVE", vi: "Sản phẩm lỗi", en: "Defective" },
  { value: "WRONG_ITEM", vi: "Giao sai sản phẩm", en: "Wrong item" },
  { value: "DAMAGED", vi: "Hư hỏng khi giao", en: "Damaged" },
  { value: "NOT_AS_DESCRIBED", vi: "Không đúng mô tả", en: "Not as described" },
  { value: "CUSTOMER_CHANGED_MIND", vi: "Khách hàng thay đổi nhu cầu", en: "Customer changed their mind" },
  { value: "OTHER", vi: "Lý do khác", en: "Other" },
];

const RESOLUTIONS: Array<{ value: RequestedReturnResolution; vi: string; en: string }> = [
  { value: "REFUND", vi: "Hoàn tiền", en: "Refund" },
  { value: "REPLACEMENT", vi: "Gửi sản phẩm thay thế", en: "Replacement" },
  { value: "EXCHANGE", vi: "Đổi sang sản phẩm khác", en: "Exchange" },
  { value: "REPAIR", vi: "Sửa chữa", en: "Repair" },
];

export const ReturnFormPage: React.FC = () => {
  const navigate = useNavigate();
  const [routeParams] = useSearchParams();
  const targetLifecycle = useTargetBoundWorkflow(routeParams.toString(), "return-form");
  const workflowWorkspace = useWorkflowWorkspace().workspaceId;
  const currentWorkflowWorkspace = useWorkspaceBindingRef(workflowWorkspace);
  currentWorkflowWorkspace.current = workflowWorkspace;
  const openingWorkspace = useWorkspaceBindingRef({ cycle: targetLifecycle.cycle, id: workflowWorkspace });
  if (openingWorkspace.current.cycle !== targetLifecycle.cycle) openingWorkspace.current = { cycle: targetLifecycle.cycle, id: workflowWorkspace };
  const ownsWorkspace = () => openingWorkspace.current.id === currentWorkflowWorkspace.current;
  const lifecycle = { ...targetLifecycle,
    begin: () => ownsWorkspace() && targetLifecycle.begin(),
    isCurrent: () => ownsWorkspace() && targetLifecycle.isCurrent(),
    register: (dirty: boolean, reset: () => void, save: () => Promise<boolean>) => {
      targetLifecycle.register(dirty, reset, () => ownsWorkspace() ? save() : Promise.resolve(false));
    },
  };
  const params = useMemo(() => new URLSearchParams(lifecycle.targetId), [lifecycle.targetId]);
  const { locale } = useI18n();
  const vi = locale === "vi";
  const access = useEffectiveAccess();
  const workspace = useWorkspaceContextSnapshot();
  const orders = useSubscribableSnapshot(getOrderListSnapshot, subscribeToOrderList);
  const shipping = useSubscribableSnapshot(getShippingSnapshot, subscribeToShipping);
  const returnsSnapshot = useSubscribableSnapshot(getReturnsSnapshot, subscribeToReturns);
  const visibleOrders = useMemo(() => orders.filter((order) => access.canAccessRecord("orders", order)), [access, orders]);
  const requestedOrderId = params.get("orderId") || "";
  const requestedShippingBookingId = params.get("shippingBookingId") || "";
  const requestedOrder = requestedOrderId ? visibleOrders.find((order) => order.id === requestedOrderId) : undefined;
  const candidateOrders = useMemo(
    () => visibleOrders.filter((order) => order.state !== "CANCELLED" && orderRequiresShipping(order)),
    [visibleOrders],
  );
  const [orderId, setOrderId] = useState(requestedOrderId);
  const [reason, setReason] = useState<ReturnReason>("DEFECTIVE");
  const [requestedResolution, setRequestedResolution] = useState<RequestedReturnResolution>("REFUND");
  const [note, setNote] = useState("");
  const [manualDeliveredAt, setManualDeliveredAt] = useState("");
  const [manualEvidenceReason, setManualEvidenceReason] = useState("");
  const [manualEvidenceRef, setManualEvidenceRef] = useState("");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!orderId && !requestedOrderId && candidateOrders[0]) setOrderId(candidateOrders[0].id);
  }, [candidateOrders, orderId, requestedOrderId]);

  const liveSelectedOrder = candidateOrders.find((order) => order.id === orderId);
  const openingOrder = useRef(liveSelectedOrder);
  if (openingOrder.current?.id !== orderId) openingOrder.current = liveSelectedOrder ? structuredClone(liveSelectedOrder) : undefined;
  const selectedOrder = openingOrder.current;
  const deliveredBooking = useMemo(
    () => shipping
      .filter((booking) => booking.sourceType === "ORDER" && booking.sourceId === orderId && booking.externalStatus === "DELIVERED" && booking.deliveredAt)
      .sort((a, b) => {
        if (a.id === requestedShippingBookingId) return -1;
        if (b.id === requestedShippingBookingId) return 1;
        return (b.deliveredAt || "").localeCompare(a.deliveredAt || "");
      })[0],
    [shipping, orderId, requestedShippingBookingId],
  );
  const previouslyAcceptedByLine = useMemo(() => {
    const totals = new Map<string, number>();
    for (const request of returnsSnapshot.requests.filter((item) => item.orderId === orderId && item.status !== "REJECTED")) {
      for (const item of request.items) totals.set(item.orderLineId, (totals.get(item.orderLineId) ?? 0) + (item.acceptedQuantity ?? 0));
    }
    return totals;
  }, [orderId, returnsSnapshot.requests]);
  const physicalItems = selectedOrder?.items.filter((item) => resolveOrderLineFulfillmentKind(item) === "PHYSICAL_SHIPMENT" && item.quantity - (previouslyAcceptedByLine.get(item.id) ?? 0) > 0) ?? [];
  const manualEvidenceStarted = Boolean(manualDeliveredAt || manualEvidenceReason.trim() || manualEvidenceRef.trim());
  const manualEvidenceComplete = Boolean(manualDeliveredAt && manualEvidenceReason.trim() && manualEvidenceRef.trim());
  const evidenceReady = Boolean(deliveredBooking?.deliveredAt) || manualEvidenceComplete;

  const sourceIssue = !requestedOrderId
    ? undefined
    : !requestedOrder
      ? (vi ? "Không tìm thấy Order nguồn hoặc bạn không có quyền truy cập." : "The source Order was not found or is not accessible.")
      : requestedOrder.state === "CANCELLED"
        ? (vi ? "Order đã hủy không thể tạo yêu cầu đổi/trả." : "A cancelled Order cannot create a return request.")
        : !orderRequiresShipping(requestedOrder)
          ? (vi ? "Order chỉ có dịch vụ hoặc sản phẩm số. Hãy dùng quy trình điều chỉnh/hoàn tiền dịch vụ thay vì luồng trả hàng vật lý." : "This Order only contains services or digital products. Use the service adjustment/refund workflow instead of a physical return.")
          : undefined;

  useEffect(() => setSelected({}), [orderId]);

  const returnListPath = toWorkspacePath(workspace.workspaceKey, "crm", "returns");
  const toggle = (lineId: string, max: number) => {
    setSelected((current) => current[lineId]
      ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== lineId))
      : { ...current, [lineId]: Math.min(1, max) });
    setFieldErrors((current) => ({ ...current, items: "" }));
  };

  const fingerprint = JSON.stringify({ orderId, reason, requestedResolution, note, manualDeliveredAt, manualEvidenceReason, manualEvidenceRef, selected }, (_key, field: unknown) => typeof field === "string" ? field.trim() : field);
  const baseline = useRef<string | null>(null);
  const intentId = useRef(createCreateCommandTarget("return"));
  useEffect(() => { if (baseline.current === null && orderId) baseline.current = fingerprint; }, [fingerprint, orderId]);
  const baselineCycle = useRef(lifecycle.cycle);
  useEffect(() => {
    if (baselineCycle.current === lifecycle.cycle) return;
    baselineCycle.current = lifecycle.cycle; baseline.current = null;
    intentId.current = createCreateCommandTarget("return");
    setOrderId(requestedOrderId); setReason("DEFECTIVE"); setRequestedResolution("REFUND"); setNote(""); setSelected({});
    setManualDeliveredAt(""); setManualEvidenceReason(""); setManualEvidenceRef(""); setMessage(null); setFieldErrors({});
  }, [lifecycle.cycle, requestedOrderId]);
  lifecycle.register(baseline.current !== null && baseline.current !== fingerprint, () => {
    setOrderId(requestedOrderId || candidateOrders[0]?.id || ""); setReason("DEFECTIVE"); setRequestedResolution("REFUND");
    setNote(""); setManualDeliveredAt(""); setManualEvidenceReason(""); setManualEvidenceRef(""); setSelected({}); setMessage(null); setFieldErrors({});
    baseline.current = null;
  }, async () => false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (lifecycle.pending) return;
    setMessage(null);
    const items = physicalItems
      .filter((item) => selected[item.id])
      .map((item) => ({
        orderLineId: item.id,
        productId: item.productId,
        productNameSnapshot: item.productNameSnapshot,
        orderedQuantity: item.quantity,
        previouslyAcceptedReturnQuantity: previouslyAcceptedByLine.get(item.id) ?? 0,
        requestedQuantity: selected[item.id],
      }));
    const nextErrors: Record<string, string> = {};
    if (!selectedOrder) nextErrors.orderId = vi ? "Vui lòng chọn đơn hàng có hàng vật lý." : "Select an order with physical goods.";
    if (!items.length) nextErrors.items = vi ? "Chọn ít nhất một dòng hàng và số lượng cần đổi/trả." : "Select at least one order line and return quantity.";
    if (manualEvidenceStarted && !manualDeliveredAt) nextErrors.manualDeliveredAt = vi ? "Chọn thời điểm giao." : "Select the delivery time.";
    if (manualEvidenceStarted && !manualEvidenceReason.trim()) nextErrors.manualEvidenceReason = vi ? "Nhập lý do dùng bằng chứng thủ công." : "Enter the manual evidence reason.";
    if (manualEvidenceStarted && !manualEvidenceRef.trim()) nextErrors.manualEvidenceRef = vi ? "Nhập mã chứng từ hoặc tham chiếu." : "Enter an evidence reference.";
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      const fieldOrder = ["orderId", "items", "manualDeliveredAt", "manualEvidenceReason", "manualEvidenceRef"];
      const firstField = fieldOrder.find((field) => Boolean(nextErrors[field]));
      requestAnimationFrame(() => {
        const control = firstField ? document.getElementById(`return-${firstField}`) : null;
        control?.scrollIntoView({ behavior: "smooth", block: "center" });
        control?.focus({ preventScroll: true });
      });
      return;
    }
    setFieldErrors({});
    if (!selectedOrder || !lifecycle.begin()) return;
    try {
      const session = getAuthSessionSnapshot();
      const actorId = session?.principal.memberId || access.memberId || access.accountId || "current-user";
      const memberName = resolveWorkspaceMemberName(actorId);
      const actorName = session?.principal.displayName || (memberName !== "—" ? memberName : actorId);
      const id = intentId.current;
      const request = (await createReturnRequestCommand({
        id,
        code: createProvisionalDocumentNumber("RET"),
        orderId: selectedOrder.id,
        buyerRef: selectedOrder.buyerRef,
        ownerId: actorId,
        items,
        reason,
        requestedResolution,
        note,
        deliveredAt: deliveredBooking?.deliveredAt,
        deliveryEvidenceShippingBookingId: deliveredBooking?.id,
        manualDeliveryEvidence: !deliveredBooking && manualEvidenceComplete ? {
          deliveredAt: new Date(manualDeliveredAt).toISOString(),
          reason: manualEvidenceReason,
          evidenceRef: manualEvidenceRef,
        } : undefined,
        actorId,
        actorName,
        correlationId: `corr_${id}`,
      })).data;
      if (!lifecycle.isCurrent()) return;
      baseline.current = fingerprint;
      navigate(toWorkspacePath(workspace.workspaceKey, "crm", `returns/${request.id}`));
    } catch (error) {
      if (lifecycle.isCurrent()) setMessage(formatApplicationError(error, { locale }));
    } finally { lifecycle.finish(); }
  };

  return (
    <form onSubmit={submit} className="crm-form-page mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-sm" noValidate>
      <div className="border-b border-slate-200 px-6 py-5">
        <button type="button" onClick={() => navigate(returnListPath)} className="inline-flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-indigo-700"><ArrowLeft size={14} />{vi ? "Quay lại" : "Back"}</button>
        <div className="mt-3 flex items-center gap-3"><div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600"><PackageOpen size={20} /></div><h1 className="text-xl font-semibold text-slate-950">{vi ? "Tạo yêu cầu Đổi / Trả hàng" : "Create return request"}</h1></div>
      </div>

      <div className="space-y-6 bg-slate-50/70 p-6">
        {sourceIssue && <p role="alert" className="text-sm text-slate-600">{sourceIssue}</p>}
        {message && <p role="alert" className="text-sm text-slate-600">{message}</p>}

        <div className="grid gap-4 md:grid-cols-2">
          <SearchableSelect disabled={lifecycle.pending}
            id="return-orderId"
            label={vi ? "Đơn hàng nguồn" : "Source order"}
            value={orderId}
            error={fieldErrors.orderId}
            selectedLabel={orderId === requestedOrderId ? requestedOrder?.orderNumber : undefined}
            onChange={(value) => { setOrderId(value); setFieldErrors((current) => ({ ...current, orderId: "", items: "" })); }}
            placeholder={vi ? "Chọn Order có hàng vật lý" : "Select an Order with physical goods"}
            searchPlaceholder={vi ? "Tìm theo mã Order..." : "Search by Order number..."}
            clearable={false}
            options={candidateOrders.map((order) => ({ value: order.id, label: order.orderNumber, description: order.customerName || order.buyerRef.id }))}
          />
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-xs font-medium text-slate-600">{vi ? "Bằng chứng giao hàng từ Shipping" : "Shipping delivery evidence"}</div>
            <div className="mt-1 text-sm font-medium text-slate-800">{deliveredBooking?.deliveredAt ? `${new Date(deliveredBooking.deliveredAt).toLocaleString(vi ? "vi-VN" : "en-US")} · ${deliveredBooking.code}` : (vi ? "Chưa có bằng chứng giao thành công" : "No successful delivery evidence")}</div>
          </div>
        </div>

        {!deliveredBooking?.deliveredAt && selectedOrder && (
          <section className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="flex items-start gap-3"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-amber-700" /><div><div className="text-sm font-semibold text-amber-950">{vi ? "Bằng chứng giao hàng thủ công" : "Manual delivery evidence"}</div><div className="mt-1 text-xs font-medium text-amber-800">{vi ? "Chỉ dùng khi có chứng từ kiểm toán độc lập. Để trống toàn bộ nếu yêu cầu cần được ghi nhận ở trạng thái chưa đủ điều kiện." : "Use only with independent auditable evidence. Leave all fields empty to record an ineligible request for review."}</div></div></div>
            <div className="grid gap-4 md:grid-cols-3">
              <Input disabled={lifecycle.pending} id="return-manualDeliveredAt" label={vi ? "Thời điểm giao" : "Delivered at"} type="datetime-local" value={manualDeliveredAt} onChange={(event) => { setManualDeliveredAt(event.target.value); setFieldErrors((current) => ({ ...current, manualDeliveredAt: "" })); }} error={fieldErrors.manualDeliveredAt} />
              <Input disabled={lifecycle.pending} id="return-manualEvidenceReason" label={vi ? "Lý do dùng bằng chứng thủ công" : "Manual evidence reason"} value={manualEvidenceReason} onChange={(event) => { setManualEvidenceReason(event.target.value); setFieldErrors((current) => ({ ...current, manualEvidenceReason: "" })); }} error={fieldErrors.manualEvidenceReason} />
              <Input disabled={lifecycle.pending} id="return-manualEvidenceRef" label={vi ? "Mã chứng từ / tham chiếu" : "Evidence reference"} value={manualEvidenceRef} onChange={(event) => { setManualEvidenceRef(event.target.value); setFieldErrors((current) => ({ ...current, manualEvidenceRef: "" })); }} error={fieldErrors.manualEvidenceRef} />
            </div>
          </section>
        )}

        {selectedOrder && (
          <div className={`rounded-xl border px-4 py-3 text-xs font-medium ${evidenceReady ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
            <div className="flex items-start gap-2">{evidenceReady ? <CheckCircle2 size={15} className="shrink-0" /> : <AlertTriangle size={15} className="shrink-0" />}<span>{evidenceReady ? (vi ? "Đã có nguồn bằng chứng giao hàng để đánh giá điều kiện tự động." : "Delivery evidence is available for automatic eligibility evaluation.") : (vi ? "Yêu cầu sẽ được ghi nhận là chưa đủ điều kiện và chỉ có thể phê duyệt bằng quyết định ngoại lệ có lý do." : "The request will be recorded as ineligible and can only be approved through a reasoned override decision.")}</span></div>
          </div>
        )}

        <section id="return-items" tabIndex={-1}>
          <div className="mb-2 text-xs font-medium text-slate-600">{vi ? "Hàng cần đổi/trả" : "Items to return"}</div>
          {fieldErrors.items ? <p className="mb-2 text-xs text-rose-600" role="alert">{fieldErrors.items}</p> : null}
          <div className="space-y-2">
            {physicalItems.map((item) => {
              const active = Boolean(selected[item.id]);
              const previous = previouslyAcceptedByLine.get(item.id) ?? 0;
              const remaining = Math.max(0, item.quantity - previous);
              return <div key={item.id} className={`grid gap-3 rounded-xl border p-4 md:grid-cols-[auto_1fr_160px] md:items-center ${active ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white"}`}><input disabled={lifecycle.pending} type="checkbox" checked={active} onChange={() => toggle(item.id, remaining)} className="h-4 w-4" /><div><div className="font-medium text-slate-900">{item.productNameSnapshot}</div><div className="text-xs text-slate-500">{vi ? "Đã mua" : "Purchased"}: {item.quantity} · {vi ? "Đã nhận return trước" : "Previously accepted"}: {previous} · {vi ? "Còn có thể trả" : "Remaining returnable"}: {remaining}</div></div><label className="text-xs font-medium text-slate-600">{vi ? "Số lượng" : "Quantity"}<input type="number" min={1} max={remaining} disabled={(lifecycle.pending) || (!active)} value={selected[item.id] || 1} onChange={(event) => setSelected((current) => ({ ...current, [item.id]: Math.min(remaining, Math.max(1, Number(event.target.value))) }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100" /></label></div>;
            })}
            {selectedOrder && physicalItems.length === 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">{vi ? "Order không còn dòng hàng vật lý có thể chọn." : "The Order has no physical line available for return."}</div>}
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs font-medium text-slate-600">{vi ? "Lý do" : "Reason"}<select disabled={lifecycle.pending} value={reason} onChange={(event) => setReason(event.target.value as ReturnReason)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">{REASONS.map((item) => <option key={item.value} value={item.value}>{vi ? item.vi : item.en}</option>)}</select></label>
          <label className="text-xs font-medium text-slate-600">{vi ? "Yêu cầu xử lý" : "Requested resolution"}<select disabled={lifecycle.pending} value={requestedResolution} onChange={(event) => setRequestedResolution(event.target.value as RequestedReturnResolution)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">{RESOLUTIONS.map((item) => <option key={item.value} value={item.value}>{vi ? item.vi : item.en}</option>)}</select></label>
        </div>
        <label className="block text-xs font-medium text-slate-600">{vi ? "Ghi chú" : "Notes"}<textarea disabled={lifecycle.pending} rows={4} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" /></label>
      </div>

      <div data-mobile-action-bar="true" className="crm-form-action-bar flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
        <Button type="button" variant="secondary" size="md" className="min-w-28" onClick={() => navigate(returnListPath)}>{vi ? "Hủy" : "Cancel"}</Button>
        <Button type="submit" disabled={lifecycle.pending} variant="primary" size="md" className="min-w-36">{vi ? "Tạo yêu cầu" : "Create request"}</Button>
      </div>
    </form>
  );
};
