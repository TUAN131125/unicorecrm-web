import { formatDateTime } from "@/shared/lib/format/date";
import { useWorkspaceRuntimeSettings } from "@/platform/workspace-config";
import type { CustomerOrder } from "../../domain/model/order.types";
import { formatMoneyDto } from "@/shared/money";
export function OrderAcceptanceSummary({ order, vi }: { order: CustomerOrder; vi: boolean }) {
  const { timeZone } = useWorkspaceRuntimeSettings();
  if (!order.acceptance) return null;
  return <section data-order-acceptance="summary" className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
    <h2 className="font-semibold">{vi ? "Chấp nhận báo giá nguồn" : "Source Quote acceptance"}</h2>
    <p className="mt-2">{order.acceptance.source === "CUSTOMER_LINK" ? (vi ? "Khách hàng xác nhận" : "Customer confirmed") : (vi ? "Nhân viên ghi nhận" : "Recorded by staff")} · {formatDateTime(order.acceptance.acceptedAt, vi ? "vi" : "en", { timeZone })}</p>
    {order.acceptance.source === "STAFF_RECORDED" && <p>{order.acceptance.evidence}</p>}
    <p>{vi ? "Chưa xác minh người đại diện." : "The customer representative has not been verified."}</p>
    {order.state === "DRAFT" && order.acceptance.operationalApprovalRequired && <p className="mt-2">{vi ? "Cần phê duyệt bổ sung trước khi xác nhận vận hành." : "Additional approval is required before operational confirmation."}</p>}
    {order.paymentAgreementSnapshot && <div className="mt-3"><h3 className="font-semibold">{vi ? "Thỏa thuận thanh toán từ báo giá" : "Payment agreement from Quote"}</h3>{order.paymentAgreementSnapshot.lines.map(line => <p key={line.id}>{line.label}: {formatMoneyDto(line.previewAmount, vi ? "vi" : "en")}</p>)}</div>}
  </section>;
}

export function OrderConfirmationOrigin({ order, vi }: { order: CustomerOrder; vi: boolean }) {
  const { timeZone } = useWorkspaceRuntimeSettings();
  if (order.confirmationOrigin !== "WORKSPACE_POLICY") return null;
  return <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{vi ? "Đã xác nhận tự động theo chính sách Workspace" : "Automatically confirmed by Workspace policy"} · <time dateTime={order.confirmedAt}>{formatDateTime(order.confirmedAt, vi ? "vi" : "en", { timeZone })}</time></p>;
}
