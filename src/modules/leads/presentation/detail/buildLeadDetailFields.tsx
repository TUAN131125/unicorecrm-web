import React from "react";
import type { Lead } from "../../domain/model/lead.types";

import { formatVnd } from "@/shared/lib/format/currency";
import { formatDate, formatDateTime } from "@/shared/lib/format/date";
import { formatPhone } from "@/shared/lib/format/phone";

export interface LeadDetailField {
  section: string;
  id: string;
  label: React.ReactNode;
  value: React.ReactNode;
  isEmpty: boolean;
}

interface BuildLeadDetailFieldsInput {
  lead: Lead;
  locale: string;
  ownerName: string;
  campaignName: string;
}

export function buildLeadDetailFields({
  lead: l,
  locale,
  ownerName,
  campaignName,
}: BuildLeadDetailFieldsInput): LeadDetailField[] {
  return [
    { section: locale === "vi" ? "Thông tin chung" : "General Information", id: "code", label: locale === "vi" ? "Mã khách hàng tiềm năng" : "Lead ID", value: `CN-${l.id.substring(8, 12).toUpperCase()}`, isEmpty: false },
    { section: locale === "vi" ? "Thông tin chung" : "General Information", id: "name", label: locale === "vi" ? "Họ và tên" : "Full Name", value: l.name, isEmpty: !l.name },
    { section: locale === "vi" ? "Thông tin chung" : "General Information", id: "title", label: locale === "vi" ? "Chức danh / Vị trí" : "Job Title", value: l.title, isEmpty: !l.title },
    { section: locale === "vi" ? "Thông tin chung" : "General Information", id: "priority", label: locale === "vi" ? "Mức độ ưu tiên" : "Priority Level", value: l.priority === "high" ? (locale === "vi" ? "ƯU TIÊN CAO" : "HIGH PRIORITY") : l.priority === "medium" ? (locale === "vi" ? "TRUNG BÌNH" : "MEDIUM") : (locale === "vi" ? "THẤP" : "LOW"), isEmpty: false },
    { section: locale === "vi" ? "Thông tin chung" : "General Information", id: "nextFollowUpAt", label: locale === "vi" ? "Hẹn liên hệ tiếp theo" : "Next Follow-up", value: l.nextFollowUpAt ? formatDate(l.nextFollowUpAt, locale) : "", isEmpty: !l.nextFollowUpAt },

    { section: locale === "vi" ? "Thông tin cá nhân" : "Personal Information", id: "salutation", label: locale === "vi" ? "Danh xưng xưng hô" : "Salutation", value: l.title?.toLowerCase().includes("vợ") || l.title?.toLowerCase().includes("chị") || l.name.toLowerCase().includes("thị") ? (locale === "vi" ? "Chị" : "Mrs./Ms.") : (locale === "vi" ? "Anh" : "Mr."), isEmpty: false },
    { section: locale === "vi" ? "Thông tin cá nhân" : "Personal Information", id: "phone", label: locale === "vi" ? "Số điện thoại di động" : "Mobile Phone", value: l.phone ? formatPhone(l.phone) : "", isEmpty: !l.phone },
    { section: locale === "vi" ? "Thông tin cá nhân" : "Personal Information", id: "zaloId", label: locale === "vi" ? "Tài khoản MXH Zalo" : "Zalo Account", value: l.zaloId || "", isEmpty: !l.zaloId },
    { section: locale === "vi" ? "Thông tin cá nhân" : "Personal Information", id: "email", label: locale === "vi" ? "Email" : "Email", value: l.email ? <a href={`mailto:${l.email}`} className="text-indigo-600 hover:underline">{l.email}</a> : "", isEmpty: !l.email },
    { section: locale === "vi" ? "Thông tin cá nhân" : "Personal Information", id: "preferredChannel", label: locale === "vi" ? "Kênh liên lạc quen dùng" : "Preferred Channel", value: l.preferredChannel || (locale === "vi" ? "Mới thu thập" : "Newly Collected"), isEmpty: !l.preferredChannel },

    { section: locale === "vi" ? "Thông tin tổ chức" : "Organization Information", id: "companyName", label: locale === "vi" ? "Tên công ty doanh nghiệp" : "Company / Business Name", value: l.companyName || (locale === "vi" ? "Cá nhân tự do (Individual)" : "Individual"), isEmpty: !l.companyName },
    { section: locale === "vi" ? "Thông tin tổ chức" : "Organization Information", id: "companySize", label: locale === "vi" ? "Quy mô nhân viên" : "Employee Scale", value: l.companySize || "", isEmpty: !l.companySize },
    { section: locale === "vi" ? "Thông tin tổ chức" : "Organization Information", id: "industry", label: locale === "vi" ? "Lĩnh vực hoạt động" : "Industry / Domain", value: l.industry || "", isEmpty: !l.industry },
    { section: locale === "vi" ? "Thông tin tổ chức" : "Organization Information", id: "website", label: locale === "vi" ? "Website" : "Website", value: l.companyName ? `${l.companyName.toLowerCase().replace(/[^a-z0-9]/g, "")}.com.vn` : "", isEmpty: !l.companyName },

    { section: locale === "vi" ? "Thông tin địa chỉ" : "Address Information", id: "address", label: locale === "vi" ? "Địa chỉ liên hệ chính" : "Primary Address", value: l.address || "", isEmpty: !l.address },
    { section: locale === "vi" ? "Thông tin địa chỉ" : "Address Information", id: "city", label: locale === "vi" ? "Tỉnh / Thành phố" : "City / State", value: l.address ? (l.address.includes("Hà Nội") ? "Hà Nội" : "TP. Hồ Chí Minh") : "Hà Nội", isEmpty: !l.address },

    { section: locale === "vi" ? "Thông tin mô tả" : "Description Information", id: "painPoint", label: locale === "vi" ? "Nhu cầu đau đớn (Painpoint)" : "Client Painpoint", value: l.painPoint || "", isEmpty: !l.painPoint },
    { section: locale === "vi" ? "Thông tin mô tả" : "Description Information", id: "expectedValue", label: locale === "vi" ? "Ngân sách cơ hội mong đợi" : "Expected Budget", value: l.expectedValue ? formatVnd(l.expectedValue, locale) : "", isEmpty: !l.expectedValue },
    { section: locale === "vi" ? "Thông tin mô tả" : "Description Information", id: "purchaseTimeline", label: locale === "vi" ? "Thời hạn ra quyết định" : "Decision Timeline", value: l.purchaseTimeline || "", isEmpty: !l.purchaseTimeline },
    { section: locale === "vi" ? "Thông tin mô tả" : "Description Information", id: "description", label: locale === "vi" ? "Mô tả yêu cầu chi tiết" : "Detailed Description", value: l.description || "", isEmpty: !l.description },

    { section: locale === "vi" ? "Thông tin hệ thống" : "System Information", id: "owner", label: locale === "vi" ? "Nhân viên phụ trách" : "Owner Rep", value: ownerName, isEmpty: false },
    { section: locale === "vi" ? "Thông tin hệ thống" : "System Information", id: "source", label: locale === "vi" ? "Nguồn gốc ghi nhận (Source)" : "Recording Source", value: l.source, isEmpty: !l.source },
    { section: locale === "vi" ? "Thông tin hệ thống" : "System Information", id: "campaign", label: locale === "vi" ? "Chiến dịch mục tiêu" : "Target Campaign", value: campaignName, isEmpty: !l.campaignId },
    { section: locale === "vi" ? "Thông tin hệ thống" : "System Information", id: "createdAt", label: locale === "vi" ? "Thời điểm ghi nhận" : "Recorded At", value: formatDateTime(l.createdAt, locale), isEmpty: false },
    { section: locale === "vi" ? "Thông tin hệ thống" : "System Information", id: "tags", label: locale === "vi" ? "Nhãn dán cơ sở (Tags)" : "Base Tags", value: l.tags && l.tags.length > 0 ? l.tags.join(", ") : "", isEmpty: !l.tags || l.tags.length === 0 },
  ];
}

export function getLeadDetailSections(locale: string): string[] {
  return locale === "vi"
    ? ["Thông tin chung", "Thông tin cá nhân", "Thông tin tổ chức", "Thông tin địa chỉ", "Thông tin mô tả", "Thông tin hệ thống"]
    : ["General Information", "Personal Information", "Organization Information", "Address Information", "Description Information", "System Information"];
}
