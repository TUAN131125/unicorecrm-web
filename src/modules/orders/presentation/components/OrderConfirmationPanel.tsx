import { useEffect, useRef, useState } from "react";
import { Button, Modal } from "@/shared/components/ui";
import { listPaymentPlansAuthoritative, type PaymentPlan } from "@/modules/payments";
import { executeOrderConfirmationCommand } from "@/workflows/order-confirmation";
import { createDurableId } from "@/shared/ids";
import { formatApplicationError } from "@/shared/operations";
import { formatMoneyDto } from "@/shared/money";
import { normalizeApplicationError } from "@/shared/domain";
import type { CustomerOrder } from "../../domain/model/order.types";
import { orderRequiresShipping } from "../../domain/rules/orderFulfillment";

export function OrderConfirmationPanel({ order, open, vi, onClose, onCommitted }: {
  order: CustomerOrder; open: boolean; vi: boolean; onClose: () => void; onCommitted: () => Promise<unknown>;
}) {
  const [plans, setPlans] = useState<PaymentPlan[]>([]); const [loaded, setLoaded] = useState(false);
  const [review, setReview] = useState(false); const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false); const [error, setError] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState(order.recipientName ?? ""); const [recipientPhone, setRecipientPhone] = useState(order.recipientPhone ?? "");
  const [line1, setLine1] = useState(order.shippingAddress?.line1 ?? ""); const [city, setCity] = useState(order.shippingAddress?.city ?? "");
  const needsShipping = orderRequiresShipping(order);
  const busy = useRef(false); const active = useRef(true);
  const attempt = useRef<{ payload: string; key: string; version: number } | null>(null);
  useEffect(() => {
    active.current = true; const controller = new AbortController(); setLoaded(false);
    void listPaymentPlansAuthoritative(order.id, controller.signal).then(value => { if (!controller.signal.aborted) { setPlans(value); setLoaded(true); } })
      .catch(cause => { if (!controller.signal.aborted) setError(formatApplicationError(cause, { locale: vi ? "vi" : "en" })); });
    return () => { active.current = false; controller.abort(); };
  }, [order.id, order.resourceVersion, vi]);
  const plan = plans.find(value => value.state === (order.state === "DRAFT" ? "DRAFT" : "ACTIVE"));
  const submit = async () => {
    if (busy.current || !plan || order.resourceVersion === undefined) return;
    busy.current = true; setPending(true); setError(null);
    const command = { orderId: order.id, paymentPlanId: plan.id, expectedPaymentPlanVersion: plan.version, operationalReviewConfirmed: review, operationalReviewNotes: notes,
      ...(needsShipping ? { fulfillment: { recipientName, recipientPhone, shippingAddress: { line1, city } } } : {}) };
    const payload = JSON.stringify(command);
    if (attempt.current?.payload !== payload) attempt.current = { payload, key: createDurableId("order_confirmation"), version: order.resourceVersion };
    const intent = attempt.current;
    try {
      await executeOrderConfirmationCommand(command, { expectedVersion: intent.version, idempotencyKey: intent.key });
      await onCommitted();
      const fresh = await listPaymentPlansAuthoritative(order.id);
      if (active.current) { setPlans(fresh); onClose(); }
    } catch (cause) { if (active.current) {
      const code = normalizeApplicationError(cause).code;
      const messages: Record<string, [string, string]> = {
        OPERATIONAL_APPROVAL_REQUIRED: ["Cần phê duyệt và ghi chú kiểm tra vận hành.", "Operational approval and review notes are required."],
        FULFILLMENT_INFORMATION_REQUIRED: ["Bổ sung người nhận, số điện thoại và địa chỉ giao hàng hợp lệ.", "Complete the recipient, phone and valid shipping address."],
        PAYMENT_PLAN_DRAFT_REQUIRED: ["Cần kế hoạch thanh toán nháp cho đơn hàng này.", "A draft payment plan is required for this order."],
        PAYMENT_PLAN_VERSION_CONFLICT: ["Payment Plan đã thay đổi. Làm mới đơn hàng và kiểm tra lại.", "The Payment Plan changed. Refresh the Order and review again."],
        COMMERCIAL_SNAPSHOT_MISMATCH: ["Thông tin đơn hàng không khớp báo giá đã chấp nhận. Vui lòng tải lại và kiểm tra.", "Order details differ from the accepted quote. Reload and review."],
        CREDIT_APPROVAL_REQUIRED: ["Cần phê duyệt tín dụng trước khi xác nhận.", "Credit approval is required before confirmation."],
        VERIFIED_SIGNER_AUTHORITY_REQUIRED: ["Cần xác minh người đại diện trước khi tiếp tục.", "The customer representative must be verified before continuing."],
      };
      setError(messages[code]?.[vi ? 0 : 1] ?? formatApplicationError(cause, { locale: vi ? "vi" : "en" }));
    } }
    finally { busy.current = false; if (active.current) setPending(false); }
  };
  return <section data-order-confirmation="panel" className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
    <h2 className="font-semibold">{vi ? "Kế hoạch thanh toán & Xác nhận vận hành" : "Payment Plan & operational confirmation"}</h2>
    {!loaded ? <p role="status">{vi ? "Đang tải Payment Plan…" : "Loading Payment Plan…"}</p> : !plan ? <p role="alert">{vi ? "Chưa có Payment Plan tương ứng. Chưa thể xác nhận; hãy làm mới sau khi hệ thống khôi phục." : "A matching Payment Plan is missing. Confirmation is blocked; refresh after recovery."}</p> : <>
      <p className="mt-2">{vi ? "Kế hoạch thanh toán" : "Payment plan"}: <strong>{plan.state === "DRAFT" ? (vi ? "Nháp" : "Draft") : (vi ? "Đang hiệu lực" : "Active")}</strong></p>
      {plan.agreementSnapshot.lines.map(line => <p key={line.id}>{line.label}: {formatMoneyDto(line.previewAmount, vi ? "vi" : "en")}</p>)}
    </>}
    {order.state === "DRAFT" && order.acceptance?.operationalApprovalRequired && <p className="mt-2">{vi ? "Cần kiểm tra và phê duyệt vận hành trước khi xác nhận." : "Operational review and approval are required before confirmation."}</p>}
    {error && <p role="alert" className="mt-2 text-rose-700">{error}</p>}
    <Modal isOpen={open && order.state === "DRAFT"} onClose={() => { if (!pending) onClose(); }} title={vi ? "Xác nhận đơn hàng" : "Confirm Order"} size="sm">
      <div className="space-y-4" data-order-confirmation="dialog">
        <p>{vi ? "Kiểm tra báo giá, người mua, giá trị, điều khoản thanh toán và giao nhận trước khi xác nhận." : "Review the quote, buyer, amount, payment terms and delivery details before confirming."}</p>
        <p>{vi ? "Khoản tiền chưa được ghi nhận là đã thu." : "Payment has not been recorded as collected."}</p>
        <label className="flex gap-2"><input type="checkbox" checked={review} onChange={event => setReview(event.target.checked)} disabled={pending} />{vi ? "Tôi đã kiểm tra và phê duyệt điều kiện vận hành." : "I have reviewed and approved operational readiness."}</label>
        <label className="block">{vi ? "Ghi chú kiểm tra vận hành" : "Operational review notes"}<textarea className="mt-1 w-full rounded border p-2" maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} disabled={pending} /></label>
        {needsShipping && <fieldset className="space-y-2"><legend>{vi ? "Giao nhận hàng vật lý" : "Physical goods fulfillment"}</legend>
          <label className="block">{vi ? "Người nhận" : "Recipient"}<input className="block w-full rounded border p-2" maxLength={240} value={recipientName} onChange={event => setRecipientName(event.target.value)} disabled={pending} /></label>
          <label className="block">{vi ? "Số điện thoại người nhận" : "Recipient phone"}<input className="block w-full rounded border p-2" maxLength={80} value={recipientPhone} onChange={event => setRecipientPhone(event.target.value)} disabled={pending} /></label>
          <label className="block">{vi ? "Địa chỉ giao hàng" : "Shipping address"}<input className="block w-full rounded border p-2" maxLength={300} value={line1} onChange={event => setLine1(event.target.value)} disabled={pending} /></label>
          <label className="block">{vi ? "Tỉnh / thành phố" : "City"}<input className="block w-full rounded border p-2" maxLength={120} value={city} onChange={event => setCity(event.target.value)} disabled={pending} /></label>
        </fieldset>}
        {error && <p role="alert" className="text-rose-700">{error}</p>}
        <div className="flex gap-2"><Button onClick={() => void submit()} disabled={pending || !plan || !review || !notes.trim() || needsShipping && (!recipientName.trim() || !recipientPhone.trim() || !line1.trim() || !city.trim())}>{pending ? (vi ? "Đang xác nhận…" : "Confirming…") : (vi ? "Xác nhận Order & kích hoạt Payment Plan" : "Confirm Order & activate Payment Plan")}</Button><Button variant="secondary" disabled={pending} onClick={onClose}>{vi ? "Hủy" : "Cancel"}</Button></div>
      </div>
    </Modal>
  </section>;
}
