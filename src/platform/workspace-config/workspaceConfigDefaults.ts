import type { CrmWorkspaceConfig } from "./workspaceConfig.types";

export const CRM_WORKSPACE_CONFIG_PRESETS: { nameKey: string; config: CrmWorkspaceConfig }[] = [
  {
    nameKey: "settings.crmConfig.presets.b2bSaas",
    config: {
      id: "preset_b2b_saas",
      workspaceId: "ws_default",
      name: "B2B SaaS / Enterprise Sales",
      businessModel: "B2B",
      workflow: {
        dealUsageMode: "OPTIONAL",
        quoteUsageMode: "QUOTE",
        defaultCustomerType: "COMPANY",
        defaultRevenueModel: "SUBSCRIPTION",
        salesMotion: "ENTERPRISE_SALES",
        pipelineTemplate: "B2B_SALES"
      },
      terminology: {},
      modules: {
        leads: true,
        customers: true,
        contacts: true,
        deals: true,
        quotes: true,
        orders: true,
        support: true,
        organizations: true,
        tasks: true,
        payments: true,
        invoices: true,
        shipping: true,
        returns: true
      }
    }
  },
  {
    nameKey: "settings.crmConfig.presets.b2bService",
    config: {
      id: "preset_b2b_service",
      workspaceId: "ws_default",
      name: "B2B Service / Project Sales",
      businessModel: "B2B",
      workflow: {
        dealUsageMode: "OPTIONAL",
        quoteUsageMode: "PROPOSAL",
        defaultCustomerType: "COMPANY",
        defaultRevenueModel: "PROJECT",
        salesMotion: "PROJECT_BASED",
        pipelineTemplate: "PROJECT_SALES"
      },
      terminology: {},
      modules: {
        leads: true,
        customers: true,
        contacts: true,
        deals: true,
        quotes: true,
        orders: true,
        support: true,
        organizations: true,
        tasks: true,
        payments: true,
        invoices: true,
        shipping: true,
        returns: true
      }
    }
  },
  {
    nameKey: "settings.crmConfig.presets.b2cConsultative",
    config: {
      id: "preset_b2c_consultative",
      workspaceId: "ws_default",
      name: "B2C Consultative Sales",
      businessModel: "B2C",
      workflow: {
        dealUsageMode: "OPTIONAL",
        quoteUsageMode: "OFFER",
        defaultCustomerType: "INDIVIDUAL",
        defaultRevenueModel: "PACKAGE",
        salesMotion: "CONSULTATIVE_SALES",
        pipelineTemplate: "B2C_CONSULTATIVE"
      },
      terminology: {},
      modules: {
        leads: true,
        customers: true,
        contacts: false,
        deals: true,
        quotes: true,
        orders: true,
        support: true,
        organizations: true,
        tasks: true,
        payments: true,
        invoices: true,
        shipping: true,
        returns: true
      }
    }
  },
  {
    nameKey: "settings.crmConfig.presets.retailOrderBased",
    config: {
      id: "preset_retail_order",
      workspaceId: "ws_default",
      name: "Retail / Order-Based",
      businessModel: "B2C",
      workflow: {
        dealUsageMode: "DISABLED",
        quoteUsageMode: "DISABLED",
        defaultCustomerType: "INDIVIDUAL",
        defaultRevenueModel: "ORDER",
        salesMotion: "ORDER_BASED",
        pipelineTemplate: "ORDER_BASED"
      },
      terminology: {},
      modules: {
        leads: true,
        customers: true,
        contacts: false,
        deals: false,
        quotes: false,
        orders: true,
        support: true,
        organizations: true,
        tasks: true,
        payments: true,
        invoices: true,
        shipping: true,
        returns: true
      }
    }
  },
  {
    nameKey: "settings.crmConfig.presets.serviceBooking",
    config: {
      id: "preset_service_booking",
      workspaceId: "ws_default",
      name: "Service Booking / Clinic / Spa",
      businessModel: "B2C",
      workflow: {
        dealUsageMode: "OPTIONAL",
        quoteUsageMode: "OFFER",
        defaultCustomerType: "INDIVIDUAL",
        defaultRevenueModel: "PACKAGE",
        salesMotion: "SERVICE_BOOKING",
        pipelineTemplate: "SERVICE_BOOKING"
      },
      terminology: {},
      modules: {
        leads: true,
        customers: true,
        contacts: false,
        deals: true,
        quotes: true,
        orders: true,
        support: true,
        organizations: true,
        tasks: true,
        payments: true,
        invoices: true,
        shipping: true,
        returns: true
      }
    }
  },
  {
    nameKey: "settings.crmConfig.presets.hybrid",
    config: {
      id: "preset_hybrid",
      workspaceId: "ws_default",
      name: "Hybrid B2B + B2C",
      businessModel: "HYBRID",
      workflow: {
        dealUsageMode: "OPTIONAL",
        quoteUsageMode: "QUOTE",
        defaultCustomerType: "COMPANY",
        defaultRevenueModel: "CONTRACT",
        salesMotion: "CONSULTATIVE_SALES",
        pipelineTemplate: "B2B_SALES"
      },
      terminology: {},
      modules: {
        leads: true,
        customers: true,
        contacts: true,
        deals: true,
        quotes: true,
        orders: true,
        support: true,
        organizations: true,
        tasks: true,
        payments: true,
        invoices: true,
        shipping: true,
        returns: true
      }
    }
  }
];

export const DEFAULT_CRM_WORKSPACE_CONFIG: CrmWorkspaceConfig = {
  ...CRM_WORKSPACE_CONFIG_PRESETS[0].config,
  moduleSettings: {
    leads: {
      stages: [
        { id: "s1", key: "NEW", label: "Mới", order: 1 },
        { id: "s2", key: "CONTACTING", label: "Đang liên hệ", order: 2 },
        { id: "s3", key: "VERIFYING", label: "Đang xác minh", order: 3 },
        { id: "s4", key: "CLOSED", label: "Đã giải quyết", order: 4 }
      ],
      conversionOptions: {
        allowConvertToContact: true
      },
      qualification: {
        enabled: true,
        mode: "BANT_CHECKLIST",
        minQualifyScore: 75,
        minConvertScore: 75,
        requireNeedConfirmed: true,
        requireNoNotFitCriteria: true,
        allowQualificationOverride: false,
        criteria: [
          {
            key: "budget",
            label: "Ngân sách",
            shortLabel: "Budget",
            enabled: true,
            weight: 20,
            requiredForQualification: false,
            question: "Khách đã có ngân sách dự kiến cho giải pháp CRM chưa?",
            evidencePlaceholder: "Ví dụ: 100–150 triệu cho giai đoạn đầu, hoặc 12 triệu/tháng...",
            nextQuestion: "Ngân sách này đã được phê duyệt hay mới là dự kiến?"
          },
          {
            key: "authority",
            label: "Người quyết định",
            shortLabel: "Authority",
            enabled: true,
            weight: 20,
            requiredForQualification: false,
            question: "Người đang trao đổi có quyền quyết định hoặc ảnh hưởng đến quyết định mua không?",
            evidencePlaceholder: "Ví dụ: Giám đốc vận hành đề xuất, CEO phê duyệt cuối cùng...",
            nextQuestion: "Ai là người phê duyệt cuối cùng cho dự án này?"
          },
          {
            key: "need",
            label: "Nhu cầu",
            shortLabel: "Need",
            enabled: true,
            weight: 30,
            requiredForQualification: true,
            question: "Nhu cầu hoặc vấn đề cần giải quyết đã rõ chưa?",
            evidencePlaceholder: "Ví dụ: cần quản lý lead, phân quyền sales, chăm sóc khách hàng sau bán...",
            nextQuestion: "Vấn đề nào đang ảnh hưởng lớn nhất đến đội sales hiện tại?"
          },
          {
            key: "timeline",
            label: "Thời điểm",
            shortLabel: "Timeline",
            enabled: true,
            weight: 20,
            requiredForQualification: false,
            question: "Khách dự kiến mua hoặc triển khai trong khoảng thời gian nào?",
            evidencePlaceholder: "Ví dụ: muốn chạy thử trong tháng 6, triển khai chính thức quý 3...",
            nextQuestion: "Doanh nghiệp muốn bắt đầu triển khai trong tháng hoặc quý nào?"
          }
        ],
        dataQualityRules: [
          {
            key: "hasContactChannel",
            label: "Có số điện thoại hoặc Zalo",
            enabled: true,
            weight: 5
          },
          {
            key: "hasEmailOrCompany",
            label: "Có email hoặc tên doanh nghiệp",
            enabled: true,
            weight: 5
          }
        ]
      },
      detail: {
        tabs: {
          overview: true,
          qualification: true,
          products: true,
          attachments: true,
          related: true
        },
        timeline: {
          enabled: true,
          defaultVisible: true,
          quickActions: {
            call: true,
            email: true,
            zalo: true,
            task: true,
            meeting: true,
            note: true
          }
        }
      }
    },
    opportunities: {
      stages: [
        { id: "o1", key: "DISCOVERY", label: "Khám phá", order: 1 },
        { id: "o2", key: "QUALIFIED", label: "Đã xác nhận", order: 2 },
        { id: "o3", key: "SOLUTION", label: "Giải pháp", order: 3 },
        { id: "o4", key: "PROPOSAL", label: "Đề xuất", order: 4 },
        { id: "o5", key: "NEGOTIATION", label: "Đàm phán", order: 5 },
        { id: "o6", key: "WON", label: "Thành công (Won)", order: 6, isTerminal: true, isWon: true },
        { id: "o7", key: "LOST", label: "Thất bại (Lost)", order: 7, isTerminal: true, isLost: true }
      ],
      allowCustomStages: true
    },
    quotes: {
      approval: {
        policyVersion: "quote-policy-v1",
        alwaysRequireApproval: false,
        maxLineDiscountPercentWithoutApproval: 10,
        maxTotalDiscountPercentWithoutApproval: 10,
        maxGrandTotalWithoutApproval: 100000000,
        maxPostpaidDaysWithoutApproval: 30,
        requireApprovalForCustomPaymentTerms: true,
        approverRoleLabel: "Quản lý kinh doanh",
      },
    },
    products: {
      enabledProductTypes: ["physical_product", "service", "subscription", "package", "implementation", "support_sla", "addon", "license", "maintenance"],
      primaryProductType: "subscription",
      allowMixedProductTypes: true,
      defaultBillingCycle: "monthly",
      fulfillmentPolicy: "BY_PRODUCT_TYPE",
    },
    support: {
      mode: "HYBRID",
      ownershipStrategy: "RELATIONSHIP_OWNER",
      enabledCategories: ["request", "consultation", "complaint", "follow_up", "onboarding", "usage_issue", "post_purchase"],
      enabledSources: ["manual", "customer_360", "email", "phone", "chat", "web_form", "order", "product"],
      defaultPriority: "medium",
      proactiveFollowUp: {
        enabled: true,
        postPurchaseDelayDays: 3,
        repeatEveryDays: 30,
      },
      commitments: {
        enabled: false,
        firstResponseHours: { critical: 0.5, high: 1, medium: 4, low: 24 },
        resolutionHours: { critical: 4, high: 8, medium: 24, low: 72 },
      },
    }
  }
};
