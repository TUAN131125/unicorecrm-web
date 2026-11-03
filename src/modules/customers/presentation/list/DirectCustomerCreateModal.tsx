import { Link } from "react-router-dom";
import { Button, Checkbox, ConfirmDialog, Input, Modal, Select, Textarea } from "@/shared/components/ui";
import { CAPABILITIES } from "@/platform/access-control";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";
import { toWorkspacePath } from "@/platform/navigation";
import { useDirectCustomerCreation } from "../hooks/useDirectCustomerCreation";

export function DirectCustomerCreateModal({ open, onClose, onCreated, vi }: {
  open: boolean; onClose(): void; onCreated(id: string): void; vi: boolean;
}) {
  const c = useDirectCustomerCreation(open, onClose, onCreated, vi);
  const { draft, update } = c; const workspace = useWorkspaceContextSnapshot();
  const nameKey = draft.type === "B2C" ? "fullName" : "displayName";
  const sourceField = (field: string) => c.access.getFieldAccess(c.sourceResource, field.toLowerCase());
  const customerField = (field: string) => c.access.getFieldAccess("customers", field.toLowerCase());
  const readable = (field: string) => ["READ_WRITE", "READ_ONLY"].includes(sourceField(field));
  const optional = (field: string) => ["READ_WRITE", "READ_ONLY"].includes(customerField(field));
  return <>
    <Modal variant="form" isOpen={open} onClose={c.requestClose} size="lg" title={vi ? "Tạo Customer" : "Create Customer"}>
      <form noValidate onSubmit={event => { event.preventDefault(); void c.save(); }} className="crm-form-surface space-y-5" data-direct-customer-form data-guidance-id="customers.form.direct-create">
        <fieldset disabled={c.lifecycle.pending || c.unknown} className="space-y-5">
          <Select id="direct-customer-type" label={vi ? "Loại khách hàng" : "Customer type"} value={draft.type} onChange={e => update("type", e.target.value as typeof draft.type)} error={c.fields.type}>
            <option value="B2C">{vi ? "Cá nhân · B2C" : "Person · B2C"}</option><option value="B2B">{vi ? "Doanh nghiệp · B2B" : "Business · B2B"}</option>
          </Select>
          <p className="text-xs text-slate-500">{vi ? "Nhập thông tin khách hàng mới. Khi số điện thoại đã được sử dụng, hãy đối chiếu hồ sơ trước khi lưu." : "Enter the new customer's details. If the phone number is already in use, review the existing profiles before saving."}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {readable(nameKey) && <Input id="direct-customer-name" label={draft.type === "B2C" ? (vi ? "Họ và tên" : "Full name") : (vi ? "Tên doanh nghiệp" : "Business name")} required value={draft.name} onChange={e => update("name", e.target.value)} disabled={sourceField(nameKey) !== "READ_WRITE"} error={c.fields.name}/>}
            <Input label={vi ? "Người phụ trách" : "Owner"} value={getAuthSessionSnapshot()?.principal.displayName || "—"} readOnly/>
            {readable(draft.type === "B2C" ? "mobilePhone" : "phone") && <Input id="direct-customer-phone" label={vi ? "Số điện thoại" : "Phone"} type="tel" value={draft.phone} onChange={e => update("phone", e.target.value)} disabled={sourceField(draft.type === "B2C" ? "mobilePhone" : "phone") !== "READ_WRITE"} error={c.fields.phone}/>}
            {readable(draft.type === "B2C" ? "workEmail" : "email") && <Input id="direct-customer-email" label="Email" type="email" value={draft.email} onChange={e => update("email", e.target.value)} disabled={sourceField(draft.type === "B2C" ? "workEmail" : "email") !== "READ_WRITE"} error={c.fields.email}/>}
            {draft.type === "B2B" && readable("legalName") && <Input id="direct-customer-legalName" label={vi ? "Tên pháp lý" : "Legal name"} value={draft.legalName} onChange={e => update("legalName", e.target.value)} disabled={sourceField("legalName") !== "READ_WRITE"} error={c.fields.legalName}/>}
            {draft.type === "B2B" && readable("taxCode") && <Input id="direct-customer-taxCode" label={vi ? "Mã số thuế" : "Tax code"} value={draft.taxCode} onChange={e => update("taxCode", e.target.value)} disabled={sourceField("taxCode") !== "READ_WRITE"} error={c.fields.taxCode}/>}
            {readable("address") && <Input id="direct-customer-address" label={vi ? "Địa chỉ" : "Address"} value={draft.address} onChange={e => update("address", e.target.value)} disabled={sourceField("address") !== "READ_WRITE"} error={c.fields.address}/>}
            {optional("segment") && <Input id="direct-customer-segment" label={vi ? "Phân khúc" : "Segment"} value={draft.segment} onChange={e => update("segment", e.target.value)} disabled={customerField("segment") !== "READ_WRITE"} error={c.fields.segment}/>}
            {optional("tags") && <Input id="direct-customer-tags" label={vi ? "Nhãn, cách nhau bằng dấu phẩy" : "Tags, comma separated"} value={draft.tags} onChange={e => update("tags", e.target.value)} disabled={customerField("tags") !== "READ_WRITE"} error={c.fields.tags}/>}
            {optional("tier") && <Select id="direct-customer-tier" label={vi ? "Hạng khách hàng" : "Customer tier"} value={draft.tier} onChange={e => update("tier", e.target.value as typeof draft.tier)} disabled={customerField("tier") !== "READ_WRITE"} error={c.fields.tier}><option value="">—</option>{["STANDARD", "SILVER", "GOLD", "PLATINUM", "STRATEGIC"].map(t => <option key={t}>{t}</option>)}</Select>}
            {optional("serviceLevel") && <Select id="direct-customer-serviceLevel" label={vi ? "Mức dịch vụ" : "Service level"} value={draft.serviceLevel} onChange={e => update("serviceLevel", e.target.value as typeof draft.serviceLevel)} disabled={customerField("serviceLevel") !== "READ_WRITE"} error={c.fields.serviceLevel}><option value="">—</option>{["STANDARD", "PRIORITY", "PREMIUM", "ENTERPRISE"].map(t => <option key={t}>{t}</option>)}</Select>}
          </div>
          {c.matches.length > 0 && <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4" data-direct-customer-phone-matches>
            <p className="text-sm font-medium text-amber-900">{vi ? "Số điện thoại này đã được sử dụng" : "This phone number is already in use"}</p>
            <p className="text-xs text-amber-800">{vi ? "Chỉ hiển thị hồ sơ được phép xem. Tên hoặc số điện thoại giống nhau không tự động gộp danh tính." : "Only accessible records are shown. A matching name or phone never automatically merges identities."}</p>
            {c.matches.map(match => <div key={`${match.relationshipRef.type}:${match.relationshipRef.id}`} className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-200 pt-2 text-sm"><div><span>{match.displayName}</span><small className="block text-slate-500">{match.relationshipRef.type === "CONTACT" ? (vi ? "Liên hệ" : "Contact") : (vi ? "Tổ chức" : "Organization")}{match.archived || match.customerStatus === "ARCHIVED" ? (vi ? " · Đã lưu trữ" : " · Archived") : ""}</small></div>
              {match.customerId ? <Link target="_blank" className="text-violet-700 underline" to={toWorkspacePath(workspace.workspaceKey, "crm", `customers/${match.customerId}`)}>{vi ? "Mở Customer" : "Open Customer"}</Link>
                : <Button type="button" size="xs" variant="secondary" disabled={match.archived || !c.access.can(CAPABILITIES.CUSTOMERS_ONBOARD_EXISTING)} onClick={() => void c.onboard(match)}>{vi ? "Sử dụng hồ sơ hiện có" : "Use existing profile"}</Button>}
            </div>)}
            <Checkbox label={vi ? "Đây là khách hàng khác; vẫn tạo Customer mới" : "This is a different customer; create a new Customer"} checked={draft.different} onChange={e => update("different", e.target.checked)}/>
            <p className="text-xs text-amber-800">{vi ? "Dùng nguồn hiện có giữ nguyên thông tin hồ sơ nguồn. Hệ thống kiểm tra lại số điện thoại khi lưu." : "Using an existing source preserves its profile. Phone matches are checked again on save."}</p>
          </section>}
          {c.phoneError && <p role="status" className="text-xs text-amber-700">{c.phoneError}</p>}
          {readable("notes") && <Textarea id="direct-customer-notes" label={vi ? "Ghi chú" : "Notes"} rows={3} value={draft.notes} onChange={e => update("notes", e.target.value)} disabled={sourceField("notes") !== "READ_WRITE"} error={c.fields.notes}/>}
        </fieldset>
        {!c.permitted && <p role="status" className="text-sm text-amber-800">{vi ? "Bạn chưa có đủ quyền tạo Customer và hồ sơ nguồn tương ứng." : "You need permission to create this Customer and its source profile."}</p>}
        {c.error && <p role="alert" className="text-sm text-red-600">{c.error}</p>}
        {c.unknown && <p role="status" className="text-sm text-amber-800">{vi ? "Kết quả lưu chưa xác định. Thử lại cùng yêu cầu để đối chiếu kết quả; dữ liệu và khóa yêu cầu được giữ nguyên." : "Save outcome is unknown. Retry the same request to reconcile it; payload and request key are preserved."}</p>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="secondary" onClick={c.requestClose} disabled={c.lifecycle.pending || c.unknown}>{vi ? "Hủy" : "Cancel"}</Button><Button type="submit" loading={c.lifecycle.pending} disabled={c.lifecycle.pending || !c.permitted}>{c.unknown ? (vi ? "Thử lại cùng yêu cầu" : "Retry same request") : (vi ? "Tạo Customer" : "Create Customer")}</Button></div>
      </form>
    </Modal>
    <ConfirmDialog isOpen={c.lifecycle.confirmOpen} onClose={() => c.lifecycle.setConfirmOpen(false)} onConfirm={c.lifecycle.discard} title={vi ? "Bỏ thay đổi chưa lưu?" : "Discard unsaved changes?"} message={vi ? "Thông tin chưa lưu sẽ bị bỏ." : "Unsaved information will be discarded."} confirmText={vi ? "Bỏ thay đổi" : "Discard"} variant="danger"/>
  </>;
}
