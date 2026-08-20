import type { DataScope, FieldAccess } from "@/platform/access-control";

export const DATA_SCOPES: readonly DataScope[] = ["OWN", "TEAM", "WORKSPACE", "CUSTOM"];
export const FIELD_ACCESS_LEVELS: readonly FieldAccess[] = ["READ_WRITE", "READ_ONLY", "MASKED", "HIDDEN"];
export const SCOPE_RESOURCES = ["leads", "contacts", "organizations", "customers", "deals", "quotes", "orders", "payments", "shipping", "returns", "support", "tasks"] as const;

export const CAPABILITY_GROUP_LABELS: Record<string, { vi: string; en: string; descriptionVi: string; descriptionEn: string }> = {
  dashboard: { vi: "Dashboard", en: "Dashboard", descriptionVi: "Truy cập Dashboard và các chỉ số tổng quan tức thời.", descriptionEn: "Access workspace dashboards and headline metrics." },
  leads: { vi: "Khách hàng tiềm năng", en: "Leads", descriptionVi: "Tiếp nhận, phân công và chuyển đổi Lead.", descriptionEn: "Capture, assign, and qualify leads." },
  contacts: { vi: "Liên hệ", en: "Contacts", descriptionVi: "Quản lý hồ sơ cá nhân và dữ liệu liên hệ.", descriptionEn: "Manage people and contact details." },
  organizations: { vi: "Tổ chức", en: "Organizations", descriptionVi: "Quản lý tài khoản tổ chức B2B.", descriptionEn: "Manage B2B organization accounts." },
  customers: { vi: "Khách hàng 360°", en: "Customer 360", descriptionVi: "Xem và quản trị quan hệ khách hàng hợp nhất.", descriptionEn: "View and manage unified customer relationships." },
  tasks: { vi: "Công việc", en: "Tasks", descriptionVi: "Tạo, giao và hoàn thành công việc.", descriptionEn: "Create, assign, and complete work." },
  deals: { vi: "Cơ hội", en: "Deals", descriptionVi: "Quản lý pipeline và chốt cơ hội.", descriptionEn: "Manage pipeline and close opportunities." },
  quotes: { vi: "Báo giá", en: "Quotes", descriptionVi: "Tạo, cập nhật và phê duyệt báo giá.", descriptionEn: "Create, update, and approve quotes." },
  orders: { vi: "Đơn hàng", en: "Orders", descriptionVi: "Quản lý vòng đời đơn hàng.", descriptionEn: "Manage the order lifecycle." },
  products: { vi: "Sản phẩm", en: "Products", descriptionVi: "Quản lý danh mục, giá và cấu hình sản phẩm.", descriptionEn: "Manage catalog, pricing, and product configuration." },
  payments: { vi: "Thanh toán", en: "Payments", descriptionVi: "Ghi nhận, hoàn tiền và đối soát thanh toán.", descriptionEn: "Record, refund, and reconcile payments." },
  shipping: { vi: "Vận đơn", en: "Shipping", descriptionVi: "Tạo và điều phối giao nhận.", descriptionEn: "Create and operate shipments." },
  returns: { vi: "Đổi trả", en: "Returns", descriptionVi: "Tiếp nhận, phê duyệt và xử lý đổi trả.", descriptionEn: "Request, approve, and resolve returns." },
  support: { vi: "Hỗ trợ", en: "Support", descriptionVi: "Quản lý phiếu hỗ trợ và SLA.", descriptionEn: "Manage support cases and SLA." },
  reports: { vi: "Báo cáo", en: "Reports", descriptionVi: "Xem và xuất báo cáo quản trị.", descriptionEn: "View and export management reports." },
  studio: { vi: "Thiết lập", en: "Studio", descriptionVi: "Xem hoặc thay đổi cấu hình workspace.", descriptionEn: "View or change workspace configuration." },
  access: { vi: "Người dùng & quyền", en: "People & Access", descriptionVi: "Xem hoặc quản trị thành viên và chính sách quyền.", descriptionEn: "View or administer members and access policies." },
  audit: { vi: "Nhật ký kiểm soát", en: "Audit", descriptionVi: "Xem hoặc cấu hình nhật ký quản trị.", descriptionEn: "View or configure governance audit." },
};

export const ACTION_LABELS: Record<string, { vi: string; en: string }> = {
  read: { vi: "Xem", en: "View" },
  view: { vi: "Xem", en: "View" },
  create: { vi: "Tạo mới", en: "Create" },
  update: { vi: "Chỉnh sửa", en: "Edit" },
  edit: { vi: "Chỉnh sửa", en: "Edit" },
  delete: { vi: "Xóa", en: "Delete" },
  export: { vi: "Xuất dữ liệu", en: "Export" },
  bulk: { vi: "Thao tác hàng loạt", en: "Bulk actions" },
  assign: { vi: "Phân công", en: "Assign" },
  qualify: { vi: "Đánh giá Lead", en: "Qualify" },
  close: { vi: "Chốt cơ hội", en: "Close" },
  approve: { vi: "Phê duyệt", en: "Approve" },
  complete: { vi: "Hoàn tất", en: "Complete" },
  configure: { vi: "Cấu hình", en: "Configure" },
  record: { vi: "Ghi nhận", en: "Record" },
  refund: { vi: "Hoàn tiền", en: "Refund" },
  reconcile: { vi: "Đối soát", en: "Reconcile" },
  resolve: { vi: "Giải quyết", en: "Resolve" },
  retry: { vi: "Thử lại", en: "Retry" },
  cancel: { vi: "Hủy", en: "Cancel" },
  sync: { vi: "Đồng bộ", en: "Sync" },
  manageProviders: { vi: "Quản lý nhà cung cấp", en: "Manage providers" },
  create_system: { vi: "Tạo từ hệ thống", en: "System create" },
  archive: { vi: "Lưu trữ", en: "Archive" },
};

export const RESOURCE_LABELS: Record<string, { vi: string; en: string }> = Object.fromEntries(
  Object.entries(CAPABILITY_GROUP_LABELS).map(([key, value]) => [key, { vi: value.vi, en: value.en }]),
);

export const DATA_SCOPE_OPTIONS: Array<{ value: DataScope; vi: string; en: string; descriptionVi: string; descriptionEn: string }> = [
  { value: "OWN", vi: "Dữ liệu của chính mình", en: "Own records", descriptionVi: "Chỉ bản ghi do thành viên sở hữu.", descriptionEn: "Only records owned by the member." },
  { value: "TEAM", vi: "Dữ liệu của nhóm", en: "Team records", descriptionVi: "Bản ghi của thành viên và các nhóm đang tham gia.", descriptionEn: "Records owned by the member or their teams." },
  { value: "WORKSPACE", vi: "Toàn workspace", en: "Entire workspace", descriptionVi: "Mọi bản ghi trong workspace.", descriptionEn: "All records in the workspace." },
  { value: "CUSTOM", vi: "Chủ sở hữu được chọn", en: "Selected owners", descriptionVi: "Chỉ bản ghi thuộc các chủ sở hữu đã chọn.", descriptionEn: "Only records owned by selected members." },
];

export const FIELD_ACCESS_OPTIONS: Array<{ value: FieldAccess; vi: string; en: string; descriptionVi: string; descriptionEn: string }> = [
  { value: "READ_WRITE", vi: "Xem và sửa", en: "Read & write", descriptionVi: "Được xem và chỉnh sửa giá trị.", descriptionEn: "Can view and edit the value." },
  { value: "READ_ONLY", vi: "Chỉ xem", en: "Read only", descriptionVi: "Được xem nhưng không được chỉnh sửa.", descriptionEn: "Can view but cannot edit." },
  { value: "MASKED", vi: "Che dữ liệu", en: "Masked", descriptionVi: "Hiển thị giá trị đã che.", descriptionEn: "Shows a masked value." },
  { value: "HIDDEN", vi: "Ẩn hoàn toàn", en: "Hidden", descriptionVi: "Không trả trường này về giao diện.", descriptionEn: "The field is omitted from the UI." },
];

export const SENSITIVE_FIELDS = [
  { resourceKey: "deals", fieldKey: "amount", labelVi: "Giá trị cơ hội", labelEn: "Deal amount" },
  { resourceKey: "contacts", fieldKey: "phone", labelVi: "Số điện thoại liên hệ", labelEn: "Contact phone" },
  { resourceKey: "payments", fieldKey: "externalReference", labelVi: "Mã giao dịch bên ngoài", labelEn: "External transaction reference" },
] as const;

export function capabilityPresentation(capability: string, vi: boolean): { group: string; groupLabel: string; actionLabel: string; technical: string } {
  const [group, ...actionParts] = capability.split(".");
  const action = actionParts.join(".");
  return {
    group,
    groupLabel: CAPABILITY_GROUP_LABELS[group]?.[vi ? "vi" : "en"] || group,
    actionLabel: ACTION_LABELS[action]?.[vi ? "vi" : "en"] || action,
    technical: capability,
  };
}
