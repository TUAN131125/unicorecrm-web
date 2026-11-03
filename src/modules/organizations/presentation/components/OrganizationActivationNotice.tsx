import { Button, ConfirmDialog } from "@/shared/components/ui";
import { useOrganizationActivation } from "../hooks/useOrganizationActivation";

export function OrganizationActivationNotice({ organizationId, vi, onActivated }: { organizationId: string; vi: boolean; onActivated?: () => void }) {
  const c = useOrganizationActivation(organizationId, vi, onActivated);
  if (!c.value || !c.canReadStatus || c.value.status === "active") return null;
  const prospect = c.value.status === "prospect";
  return <section className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" data-organization-activation-notice>
    <p>{prospect ? (vi ? "Tổ chức nguồn đang ở trạng thái Tiềm năng (prospect). Cần kích hoạt tổ chức trước khi lập báo giá." : "The source organization is a Prospect. Activate it before creating a quote.")
      : (vi ? "Tổ chức nguồn chưa ở trạng thái Hoạt động. Kiểm tra hồ sơ tổ chức trước khi lập báo giá." : "The source organization is not Active. Review its record before creating a quote.")}</p>
    {c.canActivate ? <Button type="button" variant="secondary" size="sm" onClick={c.show}>{vi ? "Kích hoạt tổ chức" : "Activate organization"}</Button>
      : <p className="text-xs">{vi ? "Người có quyền cập nhật trạng thái tổ chức cần kiểm tra và kích hoạt hồ sơ." : "A user permitted to update the organization status must review and activate it."}</p>}
    <ConfirmDialog isOpen={c.open} title={vi ? "Kích hoạt tổ chức?" : "Activate organization?"}
      message={vi ? "Chuyển tổ chức từ Tiềm năng sang Hoạt động để có thể lập báo giá. Thông tin hồ sơ được giữ nguyên." : "Change the organization from Prospect to Active so quotes can be created. Profile details are preserved."}
      onClose={c.close} onConfirm={c.activate} loading={c.pending}
      confirmText={c.unknown ? (vi ? "Thử lại cùng yêu cầu" : "Retry same request") : (vi ? "Kích hoạt tổ chức" : "Activate organization")}>
      {c.error && <p role="alert" className="text-sm text-red-600">{c.error}</p>}
      {c.unknown && <p className="text-sm text-amber-800">{vi ? "Kết quả chưa xác định. Thử lại cùng yêu cầu để đối chiếu; khóa và dữ liệu được giữ nguyên." : "Outcome unknown. Retry the same request to reconcile it; key and payload are preserved."}</p>}
    </ConfirmDialog>
  </section>;
}
