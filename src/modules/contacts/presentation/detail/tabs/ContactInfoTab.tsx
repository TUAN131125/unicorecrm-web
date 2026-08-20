import React, { useState } from "react";
import { Contact } from "../../../domain/model/contact.types";
import { useI18n } from "@/i18n";
import { getContactStatusTranslation, getContactStatusBadgeStyle } from "../contactDetail.helpers";
import { formatPhone } from "@/shared/lib/format/phone";
import { formatVnd } from "@/shared/lib/format/currency";
import { formatDate } from "@/shared/lib/format/date";
import { Search, Info, HelpCircle } from "lucide-react";
import { Input, Badge, Button } from "@/shared/components/ui";
import { findCustomerForContact, getCustomerDisplayNameForContact } from "../../model/contactCustomerLookup";

interface ContactInfoTabProps {
  contact: Contact;
  ownerName: string;
  totalQuotedAmount: number;
  totalOrderValue: number;
  latestDealStage?: string;
}

interface DetailField {
  id: string;
  label: string;
  value: React.ReactNode;
  textValForSearch: string;
  section: string;
  isEmpty: boolean;
}

export const ContactInfoTab: React.FC<ContactInfoTabProps> = ({
  contact,
  ownerName,
  totalQuotedAmount,
  totalOrderValue,
  latestDealStage,
}) => {
  const { tx, locale } = useI18n();
  const fallback = tx("common.notAvailable", "Chưa cung cấp");

  const [fieldSearch, setFieldSearch] = useState("");
  const [showEmptyFields, setShowEmptyFields] = useState(true);

  const getDecisionRoleLabel = (role?: string) => {
    if (!role) return null;
    return tx(`contactDetail.decisionRole.${role.toLowerCase()}`, role);
  };

  const getRelationshipLevelLabel = (level?: string) => {
    if (!level) return null;
    return tx(`contactDetail.relationshipLevel.${level.toLowerCase()}`, level);
  };

  // Build the complete granular field definition array for Contact 360
  const allDetailFields: DetailField[] = [
    // GROUP A: THÔNG TIN HỒ SƠ CHUNG
    {
      id: "contactCode",
      label: tx("contactDetail.fields.contactCode", "Mã liên hệ"),
      value: contact.contactCode || contact.code ? (
        <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
          {contact.contactCode || contact.code}
        </span>
      ) : null,
      textValForSearch: contact.contactCode || contact.code || "",
      section: tx("contactDetail.sections.basicInfoTitle", "A. THÔNG TIN CHUNG HỒ SƠ"),
      isEmpty: !contact.contactCode && !contact.code,
    },
    {
      id: "fullName",
      label: tx("contactDetail.fields.fullName", "Họ và tên"),
      value: contact.fullName || contact.name ? (
        <span className="text-sm font-semibold text-slate-900">
          {contact.fullName || contact.name}
        </span>
      ) : null,
      textValForSearch: contact.fullName || contact.name || "",
      section: tx("contactDetail.sections.basicInfoTitle", "A. THÔNG TIN CHUNG HỒ SƠ"),
      isEmpty: !contact.fullName && !contact.name,
    },
    {
      id: "salutation",
      label: tx("contactDetail.fields.salutation", "Danh xưng"),
      value: contact.salutation ? (
        <span className="font-semibold text-slate-700">{contact.salutation}</span>
      ) : null,
      textValForSearch: contact.salutation || "",
      section: tx("contactDetail.sections.basicInfoTitle", "A. THÔNG TIN CHUNG HỒ SƠ"),
      isEmpty: !contact.salutation,
    },
    {
      id: "jobTitle",
      label: tx("contactDetail.fields.jobTitle", "Chức danh / Vị trí"),
      value: contact.title ? (
        <span className="font-semibold text-slate-800">{contact.title}</span>
      ) : null,
      textValForSearch: contact.title || "",
      section: tx("contactDetail.sections.basicInfoTitle", "A. THÔNG TIN CHUNG HỒ SƠ"),
      isEmpty: !contact.title,
    },
    {
      id: "department",
      label: tx("contactDetail.fields.department", "Bộ phận"),
      value: contact.department ? (
        <span className="font-semibold text-slate-800">{contact.department}</span>
      ) : null,
      textValForSearch: contact.department || "",
      section: tx("contactDetail.sections.basicInfoTitle", "A. THÔNG TIN CHUNG HỒ SƠ"),
      isEmpty: !contact.department,
    },
    {
      id: "companyNameLabel",
      label: tx("contactDetail.fields.companyNameLabel", "Công ty / Tổ chức"),
      value: contact.companyName || getCustomerDisplayNameForContact(contact) || contact.organizationName ? (
        <span className="font-semibold text-indigo-700">{contact.companyName || getCustomerDisplayNameForContact(contact) || contact.organizationName}</span>
      ) : null,
      textValForSearch: contact.companyName || getCustomerDisplayNameForContact(contact) || contact.organizationName || "",
      section: tx("contactDetail.sections.basicInfoTitle", "A. THÔNG TIN CHUNG HỒ SƠ"),
      isEmpty: !(contact.companyName || getCustomerDisplayNameForContact(contact) || contact.organizationName),
    },
    {
      id: "contactType",
      label: tx("contactDetail.fields.contactType", "Loại hình liên hệ"),
      value: contact.relationshipType ? (
        <span className="font-semibold text-slate-700">{contact.relationshipType}</span>
      ) : null,
      textValForSearch: contact.relationshipType || "",
      section: tx("contactDetail.sections.basicInfoTitle", "A. THÔNG TIN CHUNG HỒ SƠ"),
      isEmpty: !contact.relationshipType,
    },
    {
      id: "status",
      label: tx("contactDetail.fields.status", "Trạng thái nuôi dưỡng"),
      value: contact.status ? (
        <Badge variant={getContactStatusBadgeStyle(contact.status)} className="uppercase text-[9px] font-semibold tracking-wide">
          {getContactStatusTranslation(contact.status, (k) => tx(k, k))}
        </Badge>
      ) : null,
      textValForSearch: contact.status || "",
      section: tx("contactDetail.sections.basicInfoTitle", "A. THÔNG TIN CHUNG HỒ SƠ"),
      isEmpty: !contact.status,
    },
    {
      id: "owner",
      label: tx("contactDetail.fields.owner", "Người chịu trách nhiệm"),
      value: ownerName ? (
        <span className="font-semibold text-slate-800">{ownerName}</span>
      ) : null,
      textValForSearch: ownerName || "",
      section: tx("contactDetail.sections.basicInfoTitle", "A. THÔNG TIN CHUNG HỒ SƠ"),
      isEmpty: !ownerName,
    },
    {
      id: "source",
      label: tx("contactDetail.fields.source", "Nguồn khai thác"),
      value: contact.source ? (
        <span className="font-semibold text-slate-700">{contact.source}</span>
      ) : null,
      textValForSearch: contact.source || "",
      section: tx("contactDetail.sections.basicInfoTitle", "A. THÔNG TIN CHUNG HỒ SƠ"),
      isEmpty: !contact.source,
    },
    {
      id: "createdAt",
      label: tx("common.createdAt", "Ngày tạo hồ sơ"),
      value: contact.createdAt ? (
        <span className="font-mono text-slate-600">{formatDate(contact.createdAt, locale)}</span>
      ) : null,
      textValForSearch: contact.createdAt || "",
      section: tx("contactDetail.sections.basicInfoTitle", "A. THÔNG TIN CHUNG HỒ SƠ"),
      isEmpty: !contact.createdAt,
    },
    {
      id: "updatedAt",
      label: tx("common.updatedAt", "Ngày cập nhật gần nhất"),
      value: contact.updatedAt ? (
        <span className="font-mono text-slate-600">{formatDate(contact.updatedAt, locale)}</span>
      ) : null,
      textValForSearch: contact.updatedAt || "",
      section: tx("contactDetail.sections.basicInfoTitle", "A. THÔNG TIN CHUNG HỒ SƠ"),
      isEmpty: !contact.updatedAt,
    },

    // GROUP B: KÊNH LIÊN LẠC & ĐỊA CHỈ
    {
      id: "mobilePhone",
      label: tx("contactDetail.fields.mobilePhone", "Điện thoại di động"),
      value: contact.phone || contact.mobilePhone ? (
        <a href={`tel:${contact.phone || contact.mobilePhone}`} className="text-indigo-600 hover:underline font-mono font-semibold">
          {formatPhone(contact.phone || contact.mobilePhone || "")}
        </a>
      ) : null,
      textValForSearch: contact.phone || contact.mobilePhone || "",
      section: tx("contactDetail.sections.channelsTitle", "B. KÊNH CÁ NHÂN VÀ THÔNG TIN LIÊN HỆ"),
      isEmpty: !(contact.phone || contact.mobilePhone),
    },
    {
      id: "workPhone",
      label: tx("contactDetail.fields.workPhone", "Điện thoại cơ quan"),
      value: contact.workPhone || contact.otherPhone ? (
        <a href={`tel:${contact.workPhone || contact.otherPhone}`} className="text-slate-700 hover:underline font-mono font-medium">
          {formatPhone(contact.workPhone || contact.otherPhone || "")}
        </a>
      ) : null,
      textValForSearch: contact.workPhone || contact.otherPhone || "",
      section: tx("contactDetail.sections.channelsTitle", "B. KÊNH CÁ NHÂN VÀ THÔNG TIN LIÊN HỆ"),
      isEmpty: !(contact.workPhone || contact.otherPhone),
    },
    {
      id: "workEmail",
      label: tx("contactDetail.fields.workEmail", "Email công sở"),
      value: contact.workEmail || contact.email ? (
        <a href={`mailto:${contact.workEmail || contact.email}`} className="text-indigo-600 hover:underline font-semibold">
          {contact.workEmail || contact.email}
        </a>
      ) : null,
      textValForSearch: contact.workEmail || contact.email || "",
      section: tx("contactDetail.sections.channelsTitle", "B. KÊNH CÁ NHÂN VÀ THÔNG TIN LIÊN HỆ"),
      isEmpty: !(contact.workEmail || contact.email),
    },
    {
      id: "personalEmail",
      label: tx("contactDetail.fields.personalEmail", "Email cá nhân"),
      value: contact.personalEmail ? (
        <a href={`mailto:${contact.personalEmail}`} className="text-slate-600 hover:underline font-semibold">
          {contact.personalEmail}
        </a>
      ) : null,
      textValForSearch: contact.personalEmail || "",
      section: tx("contactDetail.sections.channelsTitle", "B. KÊNH CÁ NHÂN VÀ THÔNG TIN LIÊN HỆ"),
      isEmpty: !contact.personalEmail,
    },
    {
      id: "zalo",
      label: tx("contactDetail.fields.zaloId", "Liên kết Zalo"),
      value: contact.zalo || contact.zaloId ? (
        <span className="font-semibold text-slate-800">{contact.zalo || contact.zaloId}</span>
      ) : null,
      textValForSearch: contact.zalo || contact.zaloId || "",
      section: tx("contactDetail.sections.channelsTitle", "B. KÊNH CÁ NHÂN VÀ THÔNG TIN LIÊN HỆ"),
      isEmpty: !(contact.zalo || contact.zaloId),
    },
    {
      id: "preferredChannel",
      label: tx("contactDetail.fields.preferredChannel", "Phương thức kết nối ưu tiên"),
      value: contact.preferredContactChannel || contact.preferredChannel ? (
        <span className="font-semibold text-slate-800 rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] uppercase">
          {contact.preferredContactChannel || contact.preferredChannel}
        </span>
      ) : null,
      textValForSearch: contact.preferredContactChannel || contact.preferredChannel || "",
      section: tx("contactDetail.sections.channelsTitle", "B. KÊNH CÁ NHÂN VÀ THÔNG TIN LIÊN HỆ"),
      isEmpty: !(contact.preferredContactChannel || contact.preferredChannel),
    },
    {
      id: "address",
      label: tx("contactDetail.fields.address", "Địa chỉ"),
      value: contact.address ? (
        <span className="text-slate-700 leading-relaxed font-semibold">{contact.address}</span>
      ) : null,
      textValForSearch: contact.address || "",
      section: tx("contactDetail.sections.channelsTitle", "B. KÊNH CÁ NHÂN VÀ THÔNG TIN LIÊN HỆ"),
      isEmpty: !contact.address,
    },
    {
      id: "city",
      label: tx("contactDetail.fields.city", "Tỉnh / Thành phố"),
      value: contact.address && contact.address.includes(",") ? (
        <span className="font-semibold text-slate-700">{contact.address.split(",").pop()?.trim()}</span>
      ) : null,
      textValForSearch: contact.address || "",
      section: tx("contactDetail.sections.channelsTitle", "B. KÊNH CÁ NHÂN VÀ THÔNG TIN LIÊN HỆ"),
      isEmpty: !contact.address,
    },
    {
      id: "country",
      label: tx("contactDetail.fields.country", "Quốc gia"),
      value: contact.address ? (
        <span className="font-semibold text-slate-700">{tx("contactDetail.fields.vietnam", "Việt Nam")}</span>
      ) : null,
      textValForSearch: contact.address ? "Việt Nam Vietnam" : "",
      section: tx("contactDetail.sections.channelsTitle", "B. KÊNH CÁ NHÂN VÀ THÔNG TIN LIÊN HỆ"),
      isEmpty: !contact.address,
    },

    // GROUP C: BỐI CẢNH & KHAI THÁC BÁN HÀNG
    {
      id: "relationshipLevel",
      label: tx("contactDetail.fields.relationshipLevel", "Mức độ mật thiết"),
      value: contact.relationshipLevel ? (
        <span className="font-semibold text-indigo-700 bg-indigo-50/50 border border-indigo-100 px-2.5 py-0.5 rounded text-[10px]">
          {getRelationshipLevelLabel(contact.relationshipLevel)}
        </span>
      ) : null,
      textValForSearch: contact.relationshipLevel || "",
      section: tx("contactDetail.sections.nurturingTitle", "C. MỐI QUAN HỆ VÀ BỐI CẢNH BÁN HÀNG"),
      isEmpty: !contact.relationshipLevel,
    },
    {
      id: "decisionRole",
      label: tx("contactDetail.fields.decisionRole", "Vai trò quyết định thương vụ"),
      value: contact.decisionRole ? (
        <span className="font-semibold text-slate-800 bg-violet-50 border border-violet-100 px-2.5 py-0.5 rounded text-[10px]">
          {getDecisionRoleLabel(contact.decisionRole)}
        </span>
      ) : null,
      textValForSearch: contact.decisionRole || "",
      section: tx("contactDetail.sections.nurturingTitle", "C. MỐI QUAN HỆ VÀ BỐI CẢNH BÁN HÀNG"),
      isEmpty: !contact.decisionRole,
    },
    {
      id: "tags",
      label: tx("contactDetail.fields.tags", "Tags / Nhãn phân nhóm"),
      value: contact.tags && contact.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {contact.tags.map(t => (
            <span key={t} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-semibold border border-slate-200 uppercase tracking-tight">
              {t}
            </span>
          ))}
        </div>
      ) : null,
      textValForSearch: contact.tags ? contact.tags.join(" ") : "",
      section: tx("contactDetail.sections.nurturingTitle", "C. MỐI QUAN HỆ VÀ BỐI CẢNH BÁN HÀNG"),
      isEmpty: !contact.tags || contact.tags.length === 0,
    },
    {
      id: "needSummary",
      label: tx("contactDetail.fields.needSummary", "Tóm tắt nhu cầu khách hàng"),
      value: contact.needSummary || contact.notes ? (
        <p className="font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap">{contact.needSummary || contact.notes}</p>
      ) : null,
      textValForSearch: contact.needSummary || contact.notes || "",
      section: tx("contactDetail.sections.nurturingTitle", "C. MỐI QUAN HỆ VÀ BỐI CẢNH BÁN HÀNG"),
      isEmpty: !contact.needSummary && !contact.notes,
    },
    {
      id: "painPoint",
      label: tx("contactDetail.fields.painPoints", "Rào cản lớn nhất (Pain points)"),
      value: contact.painPoint ? (
        <span className="font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded">
          {contact.painPoint}
        </span>
      ) : null,
      textValForSearch: contact.painPoint || "",
      section: tx("contactDetail.sections.nurturingTitle", "C. MỐI QUAN HỆ VÀ BỐI CẢNH BÁN HÀNG"),
      isEmpty: !contact.painPoint,
    },
    {
      id: "buyingReadiness",
      label: tx("contactDetail.fields.buyingReadiness", "Mức độ sẵn sàng giao thương"),
      value: <span className="font-semibold text-slate-800 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">Ấm / Sẵn sàng bàn luận (Warm)</span>,
      textValForSearch: "Warm Am San sang",
      section: tx("contactDetail.sections.nurturingTitle", "C. MỐI QUAN HỆ VÀ BỐI CẢNH BÁN HÀNG"),
      isEmpty: false,
    },
    {
      id: "nextFollowUpAt",
      label: tx("contactDetail.fields.nextFollowUp", "Lịch hẹn chăm sóc tiếp theo"),
      value: contact.nextFollowUpAt ? (
        <span className="font-semibold text-slate-900 border-l-2 border-amber-500 pl-2 font-mono">
          {formatDate(contact.nextFollowUpAt, locale)}
        </span>
      ) : null,
      textValForSearch: contact.nextFollowUpAt || "",
      section: tx("contactDetail.sections.nurturingTitle", "C. MỐI QUAN HỆ VÀ BỐI CẢNH BÁN HÀNG"),
      isEmpty: !contact.nextFollowUpAt,
    },
    {
      id: "lastInteractionAt",
      label: tx("contactDetail.fields.lastContacted", "Tương tác gần nhất"),
      value: contact.lastInteractionAt || contact.lastContactedAt ? (
        <span className="font-mono text-slate-600 font-semibold">
          {formatDate(contact.lastInteractionAt || contact.lastContactedAt || "", locale)}
        </span>
      ) : null,
      textValForSearch: contact.lastInteractionAt || contact.lastContactedAt || "",
      section: tx("contactDetail.sections.nurturingTitle", "C. MỐI QUAN HỆ VÀ BỐI CẢNH BÁN HÀNG"),
      isEmpty: !contact.lastInteractionAt && !contact.lastContactedAt,
    },
    {
      id: "openOpportunities",
      label: tx("contactDetail.sections.activeOpps", "Cơ hội kinh doanh đang mở"),
      value: (
        <span className="font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded font-mono">
          {contact.openOpportunityCount || 0}
        </span>
      ),
      textValForSearch: "open count opportunity",
      section: tx("contactDetail.sections.nurturingTitle", "C. MỐI QUAN HỆ VÀ BỐI CẢNH BÁN HÀNG"),
      isEmpty: false,
    },
    {
      id: "latestOppStage",
      label: tx("contactDetail.sections.latestOppStage", "Trạng thái cơ hội mới nhất"),
      value: latestDealStage ? (
        <span className="font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded">
          {latestDealStage}
        </span>
      ) : null,
      textValForSearch: latestDealStage || "",
      section: tx("contactDetail.sections.nurturingTitle", "C. MỐI QUAN HỆ VÀ BỐI CẢNH BÁN HÀNG"),
      isEmpty: !latestDealStage,
    },

    // GROUP D: LIÊN KẾT KHÁCH HÀNG & AN TOÀN
    {
      id: "linkedCustomer",
      label: tx("contactDetail.fields.linkedCustomer", "Hồ sơ Khách hàng liên kết"),
      value: findCustomerForContact(contact)?.id ? (
        <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg flex items-center justify-between font-sans">
          <div>
            <p className="font-semibold text-slate-800">{getCustomerDisplayNameForContact(contact)}</p>
            <p className="text-[10px] text-slate-400 font-semibold">MISA-ID: {findCustomerForContact(contact)?.id}</p>
          </div>
        </div>
      ) : null,
      textValForSearch: getCustomerDisplayNameForContact(contact) || "",
      section: tx("contactDetail.sections.linkageTitle", "D. LIÊN KẾT KHÁCH HÀNG VÀ TẦM ẢNH HƯỞNG"),
      isEmpty: !findCustomerForContact(contact)?.id,
    },
    {
      id: "isPrimaryContact",
      label: tx("contactDetail.fields.primary", "Đầu mối trao đổi chính (Primary)"),
      value: contact.isPrimaryContact ? (
        <Badge variant="warning" className="text-[9px] py-0.5 font-semibold tracking-wider px-2 block w-fit">
          Đúng (Primary Contact)
        </Badge>
      ) : <span className="font-semibold text-slate-400">Không</span>,
      textValForSearch: "is primary contact true false",
      section: tx("contactDetail.sections.linkageTitle", "D. LIÊN KẾT KHÁCH HÀNG VÀ TẦM ẢNH HƯỞNG"),
      isEmpty: false,
    },
    {
      id: "totalQuoted",
      label: tx("contactDetail.sections.totalQuotedAmount", "Tổng giá trị báo giá đã gửi"),
      value: totalQuotedAmount > 0 ? (
        <span className="font-mono font-semibold text-slate-800">{formatVnd(totalQuotedAmount, locale)}</span>
      ) : null,
      textValForSearch: totalQuotedAmount.toString(),
      section: tx("contactDetail.sections.linkageTitle", "D. LIÊN KẾT KHÁCH HÀNG VÀ TẦM ẢNH HƯỞNG"),
      isEmpty: totalQuotedAmount === 0,
    },
    {
      id: "totalOrders",
      label: tx("contactDetail.sections.totalOrderValue", "Tổng giá trị đơn hàng thực tế"),
      value: totalOrderValue > 0 ? (
        <span className="font-mono font-semibold text-emerald-700">{formatVnd(totalOrderValue, locale)}</span>
      ) : null,
      textValForSearch: totalOrderValue.toString(),
      section: tx("contactDetail.sections.linkageTitle", "D. LIÊN KẾT KHÁCH HÀNG VÀ TẦM ẢNH HƯỞNG"),
      isEmpty: totalOrderValue === 0,
    },
    {
      id: "doNotContact",
      label: tx("contactDetail.sections.doNotContactLabel", "Giới hạn tương tác Outbound"),
      value: contact.doNotContact ? (
        <span className="text-rose-700 bg-rose-50 border border-rose-100 p-2 rounded-lg font-semibold block max-w-md">
          🛑 Hạn chế: {contact.doNotContactReason || tx("contactDetail.toast.doNotContactReasonPlaceholder", "Dừng mọi hoạt động tiếp thị.")}
        </span>
      ) : null,
      textValForSearch: contact.doNotContactReason || "",
      section: tx("contactDetail.sections.linkageTitle", "D. LIÊN KẾT KHÁCH HÀNG VÀ TẦM ẢNH HƯỞNG"),
      isEmpty: !contact.doNotContact,
    },
    {
      id: "archived",
      label: tx("contactDetail.fields.archivedStatus", "Lưu trữ hệ thống"),
      value: contact.status === "archived" ? (
        <span className="text-amber-700 bg-amber-50 border border-amber-100 px-3 py-1 rounded font-semibold">
          Đang lưu trữ
        </span>
      ) : null,
      textValForSearch: "archived",
      section: tx("contactDetail.sections.linkageTitle", "D. LIÊN KẾT KHÁCH HÀNG VÀ TẦM ẢNH HƯỞNG"),
      isEmpty: contact.status !== "archived",
    },

    // GROUP E: TÓM TẮT GHI CHÚ
    {
      id: "latestNotes",
      label: tx("contactDetail.fields.latestNote", "Ghi chú tóm tắt (Latest)"),
      value: contact.notes ? (
        <p className="font-sans text-xs text-slate-700 font-semibold italic bg-slate-50 border border-slate-200/60 p-3 rounded-lg leading-relaxed">{contact.notes}</p>
      ) : null,
      textValForSearch: contact.notes || "",
      section: tx("contactDetail.sections.notesSummaryTitle", "E. TÓM TẮT GHI CHÚ CHĂM SÓC SKILLS"),
      isEmpty: !contact.notes,
    },
    {
      id: "consultingNote",
      label: tx("contactDetail.fields.internalNotes", "Ý kiến phản hồi / chăm sóc"),
      value: contact.consultingNote || contact.internalNotes ? (
        <p className="font-sans text-xs text-slate-700 font-semibold bg-slate-50 border border-slate-200/60 p-3 rounded-lg leading-relaxed">{contact.consultingNote || contact.internalNotes}</p>
      ) : null,
      textValForSearch: contact.consultingNote || contact.internalNotes || "",
      section: tx("contactDetail.sections.notesSummaryTitle", "E. TÓM TẮT GHI CHÚ CHĂM SÓC SKILLS"),
      isEmpty: !contact.consultingNote && !contact.internalNotes,
    },
    {
      id: "followUpNote",
      label: tx("contactDetail.fields.followUpNote", "Ghi chú hẹn tiếp theo"),
      value: contact.followUpNote ? (
        <p className="font-sans text-xs text-slate-700 font-semibold bg-slate-50 border border-slate-200/60 p-3 rounded-lg leading-relaxed">{contact.followUpNote}</p>
      ) : null,
      textValForSearch: contact.followUpNote || "",
      section: tx("contactDetail.sections.notesSummaryTitle", "E. TÓM TẮT GHI CHÚ CHĂM SÓC SKILLS"),
      isEmpty: !contact.followUpNote,
    },
  ];

  // Unique sorted sections
  const detailSections = Array.from(new Set(allDetailFields.map(f => f.section)));

  return (
    <div id="contact-info-tab" className="space-y-6 animate-fade-in text-[11px] text-slate-600 text-left">
      
      {/* 1. COMPACT SEARCH & OPTIONS HEADER (Bản mẫu Lead CRM) */}
      <div className="rounded-xl bg-slate-50/70 border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
            <Input
              type="text"
              value={fieldSearch}
              onChange={e => setFieldSearch(e.target.value)}
              placeholder={tx("contactDetail.info.searchPlaceholder", "Tìm kiếm thuộc tính trường thông tin liên hệ...")}
              className="pl-8 text-xs h-9 bg-white border-slate-200 focus:border-indigo-500 rounded-xl w-full"
            />
          </div>
          <label className="flex items-center gap-2 select-none cursor-pointer font-semibold text-slate-600 shrink-0 select-none pb-0.5 sm:pb-0">
            <input
              type="checkbox"
              checked={showEmptyFields}
              onChange={e => setShowEmptyFields(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 border-slate-200 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="text-[11px] font-semibold text-slate-700">{tx("contactDetail.info.showEmpty", "Hiển thị dữ liệu trống")}</span>
          </label>
        </div>
      </div>

      {/* 2. DYNAMIC FIELD SECTIONS ACCORDING TO SEARCH/EMPTY FILTERS */}
      <div className="space-y-7">
        {detailSections.map(secTitle => {
          const secFields = allDetailFields.filter(f => {
            if (f.section !== secTitle) return false;
            if (!showEmptyFields && f.isEmpty) return false;
            if (fieldSearch) {
              const matchedLabel = f.label.toLowerCase().includes(fieldSearch.toLowerCase());
              const matchedVal = f.textValForSearch.toLowerCase().includes(fieldSearch.toLowerCase());
              const matchedId = f.id.toLowerCase().includes(fieldSearch.toLowerCase());
              return matchedLabel || matchedVal || matchedId;
            }
            return true;
          });

          if (secFields.length === 0) return null;

          return (
            <section key={secTitle} className="space-y-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 hover:text-indigo-500 transition duration-150 border-b border-indigo-50 pb-1 flex items-center gap-1.5">
                <span>{secTitle}</span>
              </h3>
              
              <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-inner-sm overflow-hidden">
                {secFields.map(f => (
                  <div key={f.id} className="grid grid-cols-1 gap-1 px-4 py-3 md:grid-cols-[260px_minmax(0,1fr)] md:gap-4 hover:bg-slate-50/40 transition">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center md:items-start pt-0.5 select-none font-sans">
                      {f.label}
                    </dt>
                    <dd className="min-w-0 font-semibold text-slate-800 break-words flex items-center leading-relaxed">
                      {f.value || (
                        <span className="text-slate-400 italic font-medium">{fallback}</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          );
        })}

        {/* 3. EMPTY STATE IF NOTHING MATCHES FILTER */}
        {detailSections.every(sec => allDetailFields.filter(f => {
          if (f.section !== sec) return false;
          if (!showEmptyFields && f.isEmpty) return false;
          if (fieldSearch) {
            const matchedLabel = f.label.toLowerCase().includes(fieldSearch.toLowerCase());
            const matchedVal = f.textValForSearch.toLowerCase().includes(fieldSearch.toLowerCase());
            const matchedId = f.id.toLowerCase().includes(fieldSearch.toLowerCase());
            return matchedLabel || matchedVal || matchedId;
          }
          return true;
        }).length === 0) && (
          <div className="p-10 text-center bg-white border border-slate-200 rounded-xl space-y-2">
            <HelpCircle className="mx-auto text-slate-300 w-8 h-8" />
            <h4 className="font-semibold text-slate-700">{tx("contactDetail.info.noFieldsMatched", "Không tìm thấy thông tin phù hợp")}</h4>
            <p className="text-slate-400 text-[10px]">{tx("contactDetail.info.noFieldsMatchedDesc", "Không có trường dữ liệu nào khớp với từ khóa tìm kiếm của bạn.")}</p>
            <Button size="xs" variant="secondary" onClick={() => { setFieldSearch(""); setShowEmptyFields(true); }}>
              {tx("contactDetail.info.resetFilters", "Đặt lại bộ lọc")}
            </Button>
          </div>
        )}
      </div>

    </div>
  );
};
