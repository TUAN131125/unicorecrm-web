import type { Lead } from "../../domain/model/lead.types";
import { LeadWorkState } from "../../domain/model/leadLifecycle.canonical";

export const LEAD_DEMO_SEED: readonly Lead[] = [
  {
    id: "l1",
    name: "Nguyễn Văn Lộc",
    title: "Giám đốc Vận hành",
    companyName: "Công ty TNHH Giải pháp Số Vina",
    email: "loc.nv@vinadigital.vn",
    phone: "090 999 8888",
    zaloId: "zalo.me/0909998888",
    address: "Tòa nhà Landmark 81, Cầu Giấy, Hà Nội",
    source: "Website",
    score: 88,
    leadWorkState: LeadWorkState.NEW,
    ownerId: "unassigned", // unassigned lead
    interestedProducts: [
      {
        id: "lip_l1_1",
        productId: "prod_2",
        skuSnapshot: "CRM-PROF-SUB",
        productNameSnapshot: "CRM Professional Subscription",
        productTypeSnapshot: "subscription",
        interestLevel: "high",
        estimatedQuantity: 50,
        expectedBudget: 17500005,
        note: "Need cloud subscription for 50 users",
        createdAt: "2026-06-05T08:00:00Z"
      }
    ], // Unicore CRM Cloud Suite
    createdAt: "2026-06-05T08:00:00Z",
    companySize: "50-100 người",
    industry: "Công nghệ / Chuyển đổi số",
    notes: "Khách hàng quan tâm gói CRM 50 users Cloud, cần cấu hình phân quyền tinh gọn cho phòng Sales và phòng Tiếp nhận data.",
    activities: [
      { id: "act_l1_1", icon: "mail", title: "Mở email báo giá", description: "Khách hàng click xem chi tiết tài liệu đính kèm bảng giá gửi chiều qua.", createdAt: "2 giờ trước", author: "Hệ thống tự động", type: "email" },
      { id: "act_l1_2", icon: "call", title: "Cuộc gọi tư vấn lần 1", description: "Lộc khá hào hứng, đặt lịch để demo sản phẩm trực quan qua Teams vào tuần tới.", createdAt: "1 ngày trước", author: "Lê Văn C", type: "call" }
    ]
  },
  {
    id: "l2",
    name: "Trần Thị Mai",
    title: "Trưởng phòng Marketing",
    companyName: "CTCP Đầu tư Á Châu",
    email: "mai.tt@achauinvest.vn",
    phone: "091 222 3333",
    zaloId: "zalo.me/0912223333",
    address: "Tòa nhà Bitexco, Quận 1, TP.HCM",
    source: "Referral",
    campaignId: "campaign_referral_partner",
    score: 72,
    leadWorkState: LeadWorkState.CONTACTING,
    ownerId: "u1", // Nguyễn Văn A
    interestedProducts: [
      {
        id: "lip_l2_1",
        productId: "prod_3",
        skuSnapshot: "CRM-ENT-SUITE",
        productNameSnapshot: "CRM Enterprise Suite",
        productTypeSnapshot: "subscription",
        interestLevel: "high",
        estimatedQuantity: 100,
        expectedBudget: 50000000,
        note: "Enterprise-grade core solution",
        createdAt: "2026-06-02T10:15:00Z"
      },
      {
        id: "lip_l2_2",
        productId: "prod_2",
        skuSnapshot: "CRM-PROF-SUB",
        productNameSnapshot: "CRM Professional Subscription",
        productTypeSnapshot: "subscription",
        interestLevel: "medium",
        estimatedQuantity: 200,
        expectedBudget: 70000000,
        note: "Secondary option",
        createdAt: "2026-06-02T10:15:00Z"
      }
    ], // ERP & CRM
    createdAt: "2026-06-02T10:15:00Z",
    companySize: "200-500 người",
    industry: "Tài chính / Đầu tư",
    notes: "Nhu cầu triển khai hệ thống quản trị dữ liệu khách hàng tích hợp đa nền tảng Marketing. Sếp yêu cầu bảo mật cao.",
    activities: [
      { id: "act_l2_1", icon: "file_down", title: "Click link tài liệu", description: "Khách hàng tải Brochure giới thiệu ERP Cloud.", createdAt: "1 ngày trước", author: "Hệ thống tự động", type: "system" },
      { id: "act_l2_2", icon: "edit_note", title: "Ghi chú họp sơ bộ", description: "Cần chuẩn bị kỹ slides thuyết trình về tính năng phân quyền theo chi nhánh.", createdAt: "2 ngày trước", author: "Nguyễn Văn A", type: "note" }
    ]
  },
  {
    id: "l3",
    name: "Lê Văn C",
    title: "CEO",
    companyName: "Tập đoàn Xây dựng Hòa Bình",
    email: "c.le@hoabinhcorp.com.vn",
    phone: "098 777 6666",
    address: "Hoàng Mai, Hà Nội",
    source: "Website",
    score: 95,
    leadWorkState: LeadWorkState.VERIFYING,
    migrationReview: { rule: "LEAD_OUTCOME_REQUIRES_EVIDENCE", legacyStatus: "QUALIFIED" },
    ownerId: "u3", // Lê Văn C
    interestedProducts: [
      {
        id: "lip_l3_1",
        productId: "prod_8",
        skuSnapshot: "HRM-CORE-SUB",
        productNameSnapshot: "Core HRM Module",
        productTypeSnapshot: "subscription",
        interestLevel: "high",
        estimatedQuantity: 12,
        expectedBudget: 18000000,
        note: "12 departments pilot run",
        createdAt: "2026-05-28T09:30:00Z"
      }
    ], // Module HRM
    createdAt: "2026-05-28T09:30:00Z",
    companySize: "1000+ người",
    industry: "Xây dựng / Bất động sản",
    notes: "Cần tích hợp module chấm công và tính chỉ số KPI, nhân rộng cho 12 phòng ban lớn cấp tập đoàn.",
    activities: [
      { id: "act_l3_1", icon: "groups", title: "Họp trực tuyến thành công", description: "Đã demo thực tế tính năng tính lương, khách đồng ý điều khoản chuyển giao.", createdAt: "Hôm qua", author: "Lê Văn C", type: "meeting" }
    ]
  },
  {
    id: "l4",
    name: "Phạm Khoa",
    title: "Giám đốc IT",
    companyName: "Techcom Solutions",
    email: "khoa.pham@techcomsol.vn",
    phone: "093 444 5555",
    zaloId: "zalo.me/0934445555",
    source: "Facebook",
    campaignId: "campaign_facebook_june",
    score: 65,
    leadWorkState: LeadWorkState.NEW,
    ownerId: "u1", // Nguyễn Văn A
    interestedProducts: [
      {
        id: "lip_l4_1",
        productId: "prod_2",
        skuSnapshot: "CRM-PROF-SUB",
        productNameSnapshot: "CRM Professional Subscription",
        productTypeSnapshot: "subscription",
        interestLevel: "high",
        estimatedQuantity: 30,
        expectedBudget: 10500000,
        note: "Wants API sync features",
        createdAt: "2026-06-09T14:30:00Z"
      }
    ], // CRM Suite
    createdAt: "2026-06-09T14:30:00Z",
    companySize: "20-50 người",
    industry: "Phần mềm & Hạ tầng IT",
    notes: "Đang tìm hiểu API Integration để đồng bộ tập khách hàng từ hệ thống ERP nội bộ sang CRM.",
    activities: [
      { id: "act_l4_1", icon: "app_registration", title: "Submit Form tư vấn", description: "Liên hệ thông qua Landing Page Chiến dịch T4.", createdAt: "Vừa xong", author: "Hệ thống tự động", type: "system" }
    ]
  },
  {
    id: "l5",
    name: "Lê Văn C - Startup XYZ",
    title: "Founder",
    companyName: "Startup XYZ",
    email: "founder@xyz.io",
    phone: "090 123 4567",
    source: "Google Ads",
    campaignId: "campaign_google_search_crm",
    score: 40,
    leadWorkState: LeadWorkState.CONTACTING,
    ownerId: "u3",
    interestedProducts: [
      {
        id: "lip_l5_1",
        productId: "prod_2",
        skuSnapshot: "CRM-PROF-SUB",
        productNameSnapshot: "CRM Professional Subscription",
        productTypeSnapshot: "subscription",
        interestLevel: "medium",
        estimatedQuantity: 1,
        expectedBudget: 350000,
        createdAt: "2026-06-08T00:00:00Z"
      }
    ],
    createdAt: "2026-06-08T00:00:00Z",
    notes: "Quan tâm bản free trial, quá hạn 24 giờ phản hồi chưa có sales rep liên lạc.",
    activities: []
  },
  {
    id: "l6",
    name: "Phạm Thị D",
    title: "Trưởng phòng Kế toán",
    companyName: "SME Vina (Trùng SĐT l4)",
    email: "accountant@smevina.vn",
    phone: "093 444 5555",
    source: "Google Ads",
    campaignId: "campaign_google_search_crm",
    score: 68,
    leadWorkState: LeadWorkState.VERIFYING,
    migrationReview: { rule: "LEAD_OUTCOME_REQUIRES_EVIDENCE", legacyStatus: "CONVERTED" },
    ownerId: "u1",
    interestedProducts: [
      {
        id: "lip_l6_1",
        productId: "prod_4",
        skuSnapshot: "CRM-CUSTOM-IMPL",
        productNameSnapshot: "CRM Custom Implementation",
        productTypeSnapshot: "implementation",
        interestLevel: "high",
        estimatedQuantity: 1,
        expectedBudget: 25000000,
        createdAt: "2026-06-09T12:00:00Z"
      }
    ],
    createdAt: "2026-06-09T12:00:00Z",
    notes: "Trùng số điện thoại với lead giám đốc IT Phạm Khoa (l4).",
    activities: []
  },
  {
    id: "l7",
    name: "Bùi Thị Hải",
    title: "Marketing Manager",
    companyName: "SmartRetail JSG",
    email: "hai.bui@smartretail.vn",
    phone: "096 555 1122",
    source: "Facebook",
    campaignId: "campaign_facebook_june",
    score: 75,
    leadWorkState: LeadWorkState.VERIFYING,
    migrationReview: { rule: "LEAD_OUTCOME_REQUIRES_EVIDENCE", legacyStatus: "QUALIFIED" },
    ownerId: "u3",
    interestedProducts: [
      {
        id: "lip_l7_1",
        productId: "prod_2",
        skuSnapshot: "CRM-PROF-SUB",
        productNameSnapshot: "CRM Professional Subscription",
        productTypeSnapshot: "subscription",
        interestLevel: "medium",
        estimatedQuantity: 10,
        expectedBudget: 3500000,
        createdAt: "2026-06-05T10:00:00Z"
      }
    ],
    createdAt: "2026-06-05T10:00:00Z",
    activities: []
  },
  {
    id: "l8",
    name: "Nguyễn Trung Thực",
    title: "CFO",
    companyName: "Logistics Pro",
    email: "thuc.nt@logisticspro.com",
    phone: "097 333 4455",
    source: "Facebook",
    campaignId: "campaign_facebook_june",
    score: 92,
    leadWorkState: LeadWorkState.VERIFYING,
    migrationReview: { rule: "LEAD_OUTCOME_REQUIRES_EVIDENCE", legacyStatus: "CONVERTED" },
    ownerId: "u1",
    interestedProducts: [
      {
        id: "lip_l8_1",
        productId: "prod_3",
        skuSnapshot: "CRM-ENT-SUITE",
        productNameSnapshot: "CRM Enterprise Suite",
        productTypeSnapshot: "subscription",
        interestLevel: "high",
        estimatedQuantity: 1,
        expectedBudget: 500000,
        createdAt: "2026-06-04T15:00:00Z"
      }
    ],
    createdAt: "2026-06-04T15:00:00Z",
    activities: []
  },
  {
    id: "l9",
    name: "Đỗ Minh Tuấn",
    title: "VP of Sales",
    companyName: "Vinaplay Media",
    email: "tuan.dm@vinaplay.vn",
    phone: "098 123 4568",
    source: "Zalo",
    campaignId: "campaign_zalo_oa",
    score: 80,
    leadWorkState: LeadWorkState.VERIFYING,
    migrationReview: { rule: "LEAD_OUTCOME_REQUIRES_EVIDENCE", legacyStatus: "CONVERTED" },
    ownerId: "u3",
    interestedProducts: [
      {
        id: "lip_l9_1",
        productId: "prod_2",
        skuSnapshot: "CRM-PROF-SUB",
        productNameSnapshot: "CRM Professional Subscription",
        productTypeSnapshot: "subscription",
        interestLevel: "high",
        estimatedQuantity: 15,
        expectedBudget: 5250000,
        createdAt: "2026-06-03T11:00:00Z"
      }
    ],
    createdAt: "2026-06-03T11:00:00Z",
    activities: []
  }
];
