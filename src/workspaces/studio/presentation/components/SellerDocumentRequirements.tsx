import type { BusinessAddress, WorkspaceBusinessInformation } from "@/platform/workspace-config";

/** Draft-form guidance only; official issuance readiness is always verified by Backend. */
export function SellerDocumentRequirements({ business, addresses, vi }: {
  business: WorkspaceBusinessInformation; addresses: readonly BusinessAddress[]; vi: boolean;
}) {
  const registered = addresses.filter(x => x.active && x.purposes.includes("REGISTERED"));
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(business.email.trim());
  const phone = /^[+0-9 ()\-.]+$/u.test(business.phone.trim()) && business.phone.replace(/\D/gu, "").length >= 7;
  const checks = [
    { ok: Boolean(business.legalName.trim() && business.displayName.trim()), text: vi ? "Tên pháp lý và tên hiển thị." : "Legal and display names." },
    { ok: registered.length === 1 && Boolean(registered[0]?.addressLine1.trim()) && registered[0]?.countryCode.length === 2, text: vi ? "Đúng một địa chỉ đăng ký đang hoạt động, có địa chỉ và quốc gia." : "Exactly one active registered address with address and country." },
    { ok: email || phone, text: vi ? "Ít nhất một email hoặc số điện thoại hợp lệ." : "At least one valid email or phone." },
    { ok: !business.logoReference.trim(), text: vi ? "Logo tùy chọn; logo được cấu hình cần nguồn tài nguyên được xác minh." : "Logo is optional; a configured logo needs a trusted asset source." },
  ];
  return <section data-seller-document-requirements="true" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
    <h2 className="font-semibold">{vi ? "Thông tin bên bán cho tài liệu Báo giá" : "Seller information for Quote documents"}</h2>
    <ul className="my-2 space-y-1">{checks.map(x => <li key={x.text}>{x.ok ? "✓" : "○"} {x.text}</li>)}</ul>
    <p>{vi ? "Lưu cấu hình bằng quyền quản trị hiện có. Các điều kiện được kiểm tra lại khi phát hành; chỉ báo này không cấp quyền phát hành. Mã số thuế chỉ nhập theo thông tin thật. Thay đổi sau này không sửa PDF đã phát hành." : "Save using existing administration rights. Issuance conditions are checked again when issuing; this guidance grants no issuance rights. Enter only the actual tax ID. Later changes do not modify issued PDFs."}</p>
  </section>;
}
