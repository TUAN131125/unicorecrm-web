import { DealStage, type Deal } from "../domain/model/deal.types";

export const MOCK_DEALS: Deal[] = [
  {
    id: "d1",
    name: "Triển khai hệ thống ERP Phase 1",
    buyerRef: { type: "ORGANIZATION_ACCOUNT", id: "org_c1" },
    customerId: "c1",
    customerName: "Công ty TNHH TechVision",
    organizationAccountId: "org_c1",
    organizationAccountName: "Công ty TNHH TechVision",
    contactId: "con1",
    contactName: "Nguyễn Văn An",
    contactTitle: "Giám đốc IT",
    contactEmail: "an.nguyen@techvision.com.vn",
    contactPhone: "+84 905 123 456",
    stage: DealStage.NEGOTIATION,
    amount: 305910000,
    opportunityScore: 60,
    ownerId: "u4",
    expectedCloseDate: "2026-06-30",
    createdAt: "2026-05-10T00:00:00Z",
    updatedAt: "2026-06-10T00:00:00Z",
    interestedProducts: ["prod_3", "prod_8", "prod_4"],
    lineItems: [
      { id: "dl1_1", productId: "prod_3", productName: "License ERP Core (User)", description: "Gói tiêu chuẩn hàng năm (50 users)", quantity: 50, unitPrice: 3500000, discountPercent: 10 },
      { id: "dl1_2", productId: "prod_8", productName: "Module Quản trị Nhân sự", description: "Add-on trọn đời", quantity: 1, unitPrice: 85000000, discountPercent: 5 },
      { id: "dl1_3", productId: "prod_4", productName: "Dịch vụ Triển khai & Đào tạo", description: "Estimate 120 giờ", quantity: 1, unitPrice: 45000000, discountPercent: 0 }
    ],
    nextActionAt: "2026-06-18T17:00:00+07:00",
    nextActionSummary: "Gửi bản thảo hợp đồng để review",
    nextActionRef: { type: "MANUAL" },
    activities: [
      {
        id: "act_init_1",
        type: "system",
        title: "Cơ hội được tạo",
        description: "Hệ thống tự động ghi nhận cơ hội \"Triển khai hệ thống ERP Phase 1\" đã được tạo.",
        createdAt: "2026-05-10T00:00:00Z",
        author: "System"
      }
    ]
  },
  {
    id: "d2",
    name: "Bản quyền bổ sung Unicore CRM Suite",
    buyerRef: { type: "ORGANIZATION_ACCOUNT", id: "org_c2" },
    customerId: "c2",
    customerName: "Công ty TNHH TechHub",
    organizationAccountId: "org_c2",
    organizationAccountName: "Công ty TNHH TechHub",
    contactId: "con3",
    contactName: "Lê Văn Cường",
    contactTitle: "Trưởng nhóm vận hành CRM",
    contactEmail: "c.le@techhub.vn",
    contactPhone: "0904 123 456",
    stage: DealStage.PROPOSAL,
    amount: 120000000,
    opportunityScore: 40,
    ownerId: "u3",
    expectedCloseDate: "2026-07-15",
    createdAt: "2026-06-01T00:00:00Z",
    updatedAt: "2026-06-09T00:00:00Z",
    interestedProducts: ["prod_2"],
    lineItems: [
      { id: "dl2_1", productId: "prod_2", productName: "CRM Enterprise License", description: "Bản đầy đủ tính năng, từ 50 user", quantity: 1, unitPrice: 120000000, discountPercent: 0 }
    ],
    nextActionAt: "2026-06-20T09:00:00+07:00",
    nextActionSummary: "Follow up báo giá và xác nhận blocker",
    nextActionRef: { type: "MANUAL" },
    riskBadge: "Rủi ro chậm phản hồi",
    activities: [
      {
        id: "act_init_2",
        type: "system",
        title: "Cơ hội được tạo",
        description: "Hệ thống tự động ghi nhận cơ hội \"Bản quyền bổ sung Unicore CRM Suite\" đã được tạo.",
        createdAt: "2026-06-01T00:00:00Z",
        author: "System"
      }
    ]
  }
];
