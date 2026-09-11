import React, { useMemo, useState } from "react";
import { HelpCircle, Search } from "lucide-react";
import { Button, Input } from "@/shared/components/ui";
import type { Customer360ReadModel } from "../model/customer360ReadModel";
import { localizeBusinessDescriptor, localizeBusinessDescriptors } from "@/shared/lib/i18n/businessDescriptorLabels";

interface CustomerDetailInfoTabProps {
  model: Customer360ReadModel;
  ownerName: string;
  isVi: boolean;
  onEdit(): void;
  onOpenSource(): void;
}

interface DetailField {
  id: string;
  label: string;
  section: string;
  value: React.ReactNode;
  textValue: string;
  isEmpty: boolean;
}

function text(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function dateTime(value: string | undefined, isVi: boolean): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(isVi ? "vi-VN" : "en-US");
}

function money(value: number | undefined, isVi: boolean): string {
  if (value === undefined || value === null) return "";
  return `${value.toLocaleString(isVi ? "vi-VN" : "en-US")} ₫`;
}

function booleanLabel(value: boolean | undefined, isVi: boolean): string {
  if (value === undefined) return "";
  return value ? (isVi ? "Có" : "Yes") : (isVi ? "Không" : "No");
}

function field(section: string, id: string, label: string, rawValue: unknown, renderValue?: React.ReactNode): DetailField {
  const textValue = text(rawValue);
  return {
    id,
    label,
    section,
    value: renderValue ?? textValue,
    textValue,
    isEmpty: textValue.trim().length === 0,
  };
}

export const CustomerDetailInfoTab: React.FC<CustomerDetailInfoTabProps> = ({
  model,
  ownerName,
  isVi,
  onEdit,
  onOpenSource,
}) => {
  const [fieldSearch, setFieldSearch] = useState("");
  const [showEmptyFields, setShowEmptyFields] = useState(true);
  const fallback = isVi ? "Chưa cung cấp" : "Not provided";

  const fields = useMemo<DetailField[]>(() => {
    const { customer, identity, metrics } = model;
    const contact = identity.contact ?? identity.primaryContact;
    const organization = identity.organization;

    const customerSection = isVi ? "A. QUAN HỆ KHÁCH HÀNG" : "A. CUSTOMER RELATIONSHIP";
    const identitySection = isVi ? "B. NHẬN DẠNG VÀ LIÊN HỆ" : "B. IDENTITY AND COMMUNICATION";
    const organizationSection = isVi ? "C. TỔ CHỨC VÀ MẠNG LƯỚI LIÊN HỆ" : "C. ORGANIZATION AND CONTACT NETWORK";
    const commercialSection = isVi ? "D. THƯƠNG MẠI VÀ LỊCH SỬ MUA HÀNG" : "D. COMMERCIAL AND PURCHASE HISTORY";
    const serviceSection = isVi ? "E. CHĂM SÓC, HỖ TRỢ VÀ CÔNG VIỆC" : "E. CARE, SUPPORT AND WORK";
    const systemSection = isVi ? "F. THÔNG TIN HỆ THỐNG" : "F. SYSTEM INFORMATION";

    const result: DetailField[] = [
      field(customerSection, "customerCode", isVi ? "Mã khách hàng" : "Customer code", customer.customerCode),
      field(customerSection, "customerType", isVi ? "Loại khách hàng" : "Customer type", customer.type),
      field(customerSection, "status", isVi ? "Trạng thái" : "Status", customer.status),
      field(customerSection, "health", isVi ? "Sức khỏe quan hệ" : "Relationship health", customer.health),
      field(customerSection, "segment", isVi ? "Phân khúc" : "Segment", customer.segment, localizeBusinessDescriptor(customer.segment, isVi ? "vi" : "en")),
      field(customerSection, "tags", isVi ? "Nhãn" : "Tags", customer.tags, localizeBusinessDescriptors(customer.tags, isVi ? "vi" : "en").join(", ")),
      field(customerSection, "careOwner", isVi ? "Người phụ trách quan hệ" : "Relationship owner", ownerName),
      field(customerSection, "firstPurchaseAt", isVi ? "Mua hàng lần đầu" : "First purchase", dateTime(customer.firstPurchaseAt ?? undefined, isVi)),
      field(customerSection, "lastPurchaseAt", isVi ? "Mua hàng gần nhất" : "Latest purchase", dateTime(customer.lastPurchaseAt ?? undefined, isVi)),
      field(customerSection, "nextCareAt", isVi ? "Chăm sóc tiếp theo" : "Next care", dateTime(customer.nextCareAt, isVi)),
      field(customerSection, "lastCareAt", isVi ? "Chăm sóc gần nhất" : "Latest care", dateTime(customer.lastCareAt, isVi)),

      field(identitySection, "displayName", isVi ? "Tên hiển thị" : "Display name", identity.displayName),
      field(identitySection, "salutation", isVi ? "Danh xưng" : "Salutation", contact?.salutation),
      field(identitySection, "jobTitle", isVi ? "Chức danh" : "Job title", contact?.roleTitle || contact?.title || contact?.roleAtCompany),
      field(identitySection, "department", isVi ? "Bộ phận" : "Department", contact?.department),
      field(identitySection, "decisionRole", isVi ? "Vai trò ra quyết định" : "Decision role", contact?.decisionRole),
      field(identitySection, "relationshipLevel", isVi ? "Mức độ quan hệ" : "Relationship level", contact?.relationshipLevel),
      field(identitySection, "email", "Email", identity.email),
      field(identitySection, "workEmail", isVi ? "Email công việc" : "Work email", contact?.workEmail),
      field(identitySection, "personalEmail", isVi ? "Email cá nhân" : "Personal email", contact?.personalEmail),
      field(identitySection, "phone", isVi ? "Điện thoại chính" : "Primary phone", identity.phone),
      field(identitySection, "mobilePhone", isVi ? "Điện thoại di động" : "Mobile phone", contact?.mobilePhone),
      field(identitySection, "workPhone", isVi ? "Điện thoại công việc" : "Work phone", contact?.workPhone),
      field(identitySection, "otherPhone", isVi ? "Điện thoại khác" : "Other phone", contact?.otherPhone),
      field(identitySection, "zalo", "Zalo", contact?.zalo || contact?.zaloId),
      field(identitySection, "facebook", "Facebook", contact?.facebook),
      field(identitySection, "preferredChannel", isVi ? "Kênh liên hệ ưu tiên" : "Preferred channel", contact?.preferredContactChannel || contact?.preferredChannel),
      field(identitySection, "communicationConsent", isVi ? "Đồng ý nhận liên hệ" : "Communication consent", booleanLabel(contact?.communicationConsent, isVi)),
      field(identitySection, "doNotCall", isVi ? "Không gọi điện" : "Do not call", booleanLabel(contact?.doNotCall, isVi)),
      field(identitySection, "doNotEmail", isVi ? "Không gửi email" : "Do not email", booleanLabel(contact?.doNotEmail, isVi)),
      field(identitySection, "doNotContact", isVi ? "Không liên hệ" : "Do not contact", booleanLabel(contact?.doNotContact, isVi)),
      field(identitySection, "doNotContactReason", isVi ? "Lý do hạn chế liên hệ" : "Contact restriction reason", contact?.doNotContactReason),
      field(identitySection, "address", isVi ? "Địa chỉ" : "Address", identity.address),
      field(identitySection, "source", isVi ? "Nguồn" : "Source", contact?.source || organization?.source),
      field(identitySection, "painPoint", isVi ? "Nhu cầu / Pain point" : "Pain point", contact?.painPoint),
      field(identitySection, "needSummary", isVi ? "Tóm tắt nhu cầu" : "Need summary", contact?.needSummary),
      field(identitySection, "consultingNote", isVi ? "Ghi chú tư vấn" : "Consulting note", contact?.consultingNote),
      field(identitySection, "followUpNote", isVi ? "Ghi chú theo dõi" : "Follow-up note", contact?.followUpNote),
    ];

    if (customer.type === "B2B") {
      result.push(
        field(organizationSection, "legalName", isVi ? "Tên pháp lý" : "Legal name", organization?.legalName),
        field(organizationSection, "taxCode", isVi ? "Mã số thuế" : "Tax code", organization?.taxCode),
        field(organizationSection, "domain", "Domain", organization?.domain),
        field(organizationSection, "website", "Website", organization?.website),
        field(organizationSection, "industry", isVi ? "Ngành nghề" : "Industry", organization?.industry),
        field(organizationSection, "sizeBand", isVi ? "Quy mô" : "Size band", organization?.sizeBand),
        field(organizationSection, "employeeCount", isVi ? "Số nhân viên" : "Employee count", organization?.employeeCount),
        field(organizationSection, "annualRevenue", isVi ? "Doanh thu năm" : "Annual revenue", organization?.annualRevenue, organization?.annualRevenue ? money(organization.annualRevenue, isVi) : ""),
        field(organizationSection, "organizationStatus", isVi ? "Trạng thái tổ chức" : "Organization status", organization?.status),
        field(organizationSection, "organizationRelationship", isVi ? "Mức độ quan hệ tổ chức" : "Organization relationship", organization?.relationshipLevel),
        field(organizationSection, "primaryContact", isVi ? "Liên hệ chính" : "Primary contact", identity.primaryContact?.fullName || identity.primaryContact?.name),
        field(organizationSection, "contactCount", isVi ? "Số Contact liên quan" : "Related Contact count", identity.contacts.length),
        field(organizationSection, "organizationNotes", isVi ? "Ghi chú tổ chức" : "Organization notes", organization?.notes),
      );
    }

    result.push(
      field(commercialSection, "sourceLeadCount", isVi ? "Lead nguồn liên quan" : "Linked source leads", metrics.leadCount),
      field(commercialSection, "leadSources", isVi ? "Nguồn Lead" : "Lead sources", Array.from(new Set(model.leads.map((lead) => lead.source).filter(Boolean)))),
      field(commercialSection, "qualificationOutcomes", isVi ? "Kết quả Lead" : "Lead outcomes", Array.from(new Set(model.leads.map((lead) => lead.qualificationOutcome).filter(Boolean)))),
      field(commercialSection, "revenue", isVi ? "Doanh thu hoàn tất" : "Completed revenue", metrics.revenue, money(metrics.revenue, isVi)),
      field(commercialSection, "purchaseCount", isVi ? "Số bằng chứng mua hàng" : "Purchase evidence count", metrics.purchaseCount),
      field(commercialSection, "orderCount", isVi ? "Tổng đơn hàng" : "Order count", metrics.orderCount),
      field(commercialSection, "openDealCount", isVi ? "Cơ hội đang mở" : "Open opportunities", metrics.openDealCount),
      field(commercialSection, "quoteCount", isVi ? "Tổng báo giá" : "Quote count", metrics.quoteCount),
      field(commercialSection, "productCount", isVi ? "Mặt hàng đã mua" : "Purchased product count", metrics.productCount),
      field(commercialSection, "paymentObligations", isVi ? "Nghĩa vụ thanh toán" : "Payment obligations", model.paymentObligations.length),
      field(commercialSection, "paymentTransactions", isVi ? "Giao dịch thanh toán" : "Payment transactions", model.paymentTransactions.length),
      field(commercialSection, "shippingBookings", isVi ? "Vận đơn" : "Shipping bookings", model.shippingBookings.length),
      field(commercialSection, "returns", isVi ? "Yêu cầu đổi / trả" : "Return requests", model.returns.length),

      field(serviceSection, "careCards", isVi ? "Phiếu hỗ trợ" : "Care cards", model.careCards.length),
      field(serviceSection, "openTasks", isVi ? "Công việc đang mở" : "Open tasks", metrics.openTaskCount),
      field(serviceSection, "allTasks", isVi ? "Tổng công việc" : "All tasks", model.tasks.length),
      field(serviceSection, "openSupport", isVi ? "Phiếu hỗ trợ đang mở" : "Open support tickets", metrics.openSupportCount),
      field(serviceSection, "allSupport", isVi ? "Tổng phiếu hỗ trợ" : "All support tickets", model.supportCases.length),
      field(serviceSection, "activityCount", isVi ? "Tổng sự kiện timeline" : "Timeline event count", model.timeline.length),

      field(systemSection, "customerId", "Customer ID", customer.id),
      field(systemSection, "workspaceId", "Workspace ID", customer.workspaceId),
      field(systemSection, "relationshipRef", isVi ? "Tham chiếu quan hệ nguồn" : "Source relationship reference", `${customer.relationshipRef.type}:${customer.relationshipRef.id}`),
      field(systemSection, "legacyAliases", isVi ? "Mã tương thích cũ" : "Legacy aliases", customer.legacyAliases),
      field(systemSection, "createdAt", isVi ? "Ngày tạo Customer" : "Customer created at", dateTime(customer.createdAt, isVi)),
      field(systemSection, "updatedAt", isVi ? "Cập nhật Customer" : "Customer updated at", dateTime(customer.updatedAt, isVi)),
      field(systemSection, "archivedAt", isVi ? "Ngày lưu trữ" : "Archived at", dateTime(customer.archivedAt, isVi)),
    );

    return result;
  }, [isVi, model, ownerName]);

  const sections = useMemo(() => Array.from(new Set(fields.map((item) => item.section))), [fields]);
  const normalizedSearch = fieldSearch.trim().toLocaleLowerCase();
  const visibleBySection = sections.map((section) => ({
    section,
    fields: fields.filter((item) => {
      if (item.section !== section) return false;
      if (!showEmptyFields && item.isEmpty) return false;
      if (!normalizedSearch) return true;
      return [item.id, item.label, item.textValue].some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
    }),
  })).filter((group) => group.fields.length > 0);

  return (
    <div className="space-y-5 animate-fade-in text-left">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search size={14} className="absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            value={fieldSearch}
            onChange={(event) => setFieldSearch(event.target.value)}
            placeholder={isVi ? "Tìm kiếm thuộc tính Customer, Contact, Tổ chức..." : "Search Customer, Contact and Organization fields..."}
            className="h-9 w-full rounded-xl border-slate-200 bg-white pl-8 text-xs focus:border-indigo-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer select-none items-center gap-2 font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={showEmptyFields}
              onChange={(event) => setShowEmptyFields(event.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-slate-200 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-[11px] font-semibold text-slate-700">{isVi ? "Hiển thị dữ liệu trống" : "Show empty fields"}</span>
          </label>
          <Button size="sm" variant="secondary" onClick={onOpenSource}>{isVi ? "Mở hồ sơ nguồn" : "Open source record"}</Button>
          <Button size="sm" variant="primary" onClick={onEdit}>{isVi ? "Sửa toàn bộ thông tin" : "Edit full profile"}</Button>
        </div>
      </div>

      <div className="space-y-7">
        {visibleBySection.map((group) => (
          <section key={group.section} className="space-y-3">
            <h3 className="flex items-center gap-1.5 border-b border-indigo-50 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400 transition hover:text-indigo-500">
              {group.section}
            </h3>
            <dl className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-inner-sm">
              {group.fields.map((item) => (
                <div key={item.id} className="grid grid-cols-1 gap-1 px-4 py-3 transition hover:bg-slate-50/40 md:grid-cols-[260px_minmax(0,1fr)] md:gap-4">
                  <dt className="select-none pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{item.label}</dt>
                  <dd className="flex min-w-0 items-center break-words font-semibold leading-relaxed text-slate-800">
                    {item.isEmpty ? <span className="font-medium italic text-slate-400">{fallback}</span> : item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        {visibleBySection.length === 0 && (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-10 text-center">
            <HelpCircle className="mx-auto h-8 w-8 text-slate-300" />
            <h4 className="font-semibold text-slate-700">{isVi ? "Không tìm thấy thông tin phù hợp" : "No matching information"}</h4>
            <p className="text-[10px] text-slate-400">{isVi ? "Không có trường dữ liệu nào khớp bộ lọc hiện tại." : "No fields match the current filters."}</p>
            <Button size="xs" variant="secondary" onClick={() => { setFieldSearch(""); setShowEmptyFields(true); }}>
              {isVi ? "Đặt lại bộ lọc" : "Reset filters"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
