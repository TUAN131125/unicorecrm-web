import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui";
import { toWorkspacePath } from "@/platform/navigation";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import type { DealDetailController } from "./dealDetailView.types";

export function DealDetailOrderWorkspace({ controller: c }: { controller: DealDetailController }) {
  const workspace = useWorkspaceContextSnapshot(); const vi = c.locale === "vi";
  if (!c.connected) return null;
  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" data-deal-confirmed-orders>
    <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">{vi ? "Đơn hàng đã xác nhận" : "Confirmed Orders"}</h2><Button size="xs" variant="secondary" disabled={c.orderQuery.loading} onClick={c.orderQuery.reload}>{vi ? "Tải lại" : "Refresh"}</Button></div>
    {!c.orderQuery.permitted ? <p>{vi ? "Bạn chưa có quyền đọc đơn hàng liên quan." : "You cannot read related Orders."}</p>
      : c.orderQuery.loading ? <p role="status">{vi ? "Đang tải đơn hàng…" : "Loading Orders…"}</p>
      : c.orderQuery.error ? <p role="alert" className="text-sm text-red-600">{c.orderQuery.error}</p>
      : c.linkedOrders.length ? <ul className="space-y-2">{c.linkedOrders.map(order => <li key={order.id} className="flex justify-between gap-2 text-sm"><Link className="text-violet-700 underline" to={toWorkspacePath(workspace.workspaceKey, "crm", `orders/${order.id}`)}>{order.orderNumber}</Link><span>{order.state}</span></li>)}</ul>
      : <p className="text-sm text-slate-500">{vi ? "Chưa có đơn hàng đã xác nhận được phép đọc." : "No accessible confirmed Order."}</p>}
    <p className="text-xs text-slate-500">{vi ? "Khi chốt thắng, máy chủ kiểm tra lại Order, người mua và báo giá nguồn. Xác nhận Order không đồng nghĩa đã thanh toán hay hoàn tất giao hàng." : "On closing the win, the server verifies Order, buyer and source Quote. Confirmation does not imply payment or completed fulfillment."}</p>
  </section>;
}
