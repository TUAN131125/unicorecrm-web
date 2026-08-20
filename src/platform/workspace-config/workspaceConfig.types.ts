import type { QuoteApprovalPolicyConfig } from "@/shared/order-to-cash";

export type { QuoteApprovalPolicyConfig } from "@/shared/order-to-cash";

/** Workspace-level customer archetype used to configure CRM workflows. */
export type WorkspaceCustomerType = "COMPANY" | "INDIVIDUAL";

export type BusinessModel = "B2B" | "B2C" | "HYBRID";

export type SalesMotion =
  | "CONSULTATIVE_SALES"
  | "ENTERPRISE_SALES"
  | "ORDER_BASED"
  | "SUBSCRIPTION"
  | "SERVICE_BOOKING"
  | "RETAIL"
  | "PROJECT_BASED";

export type RevenueModel =
  | "ONE_TIME"
  | "SUBSCRIPTION"
  | "CONTRACT"
  | "PACKAGE"
  | "ORDER"
  | "PROJECT";

export type DealUsageMode = "OPTIONAL" | "DISABLED";
export type QuoteUsageMode = "QUOTE" | "OFFER" | "PROPOSAL" | "DISABLED";

export type PipelineTemplateKey =
  | "B2B_SALES"
  | "B2C_CONSULTATIVE"
  | "ORDER_BASED"
  | "SERVICE_BOOKING"
  | "PROJECT_SALES";

export type CrmModuleVisibilityConfig = {
  leads: boolean;
  /** Customer business module visibility. */
  customers: boolean;
  contacts: boolean;
  deals: boolean;
  quotes: boolean;
  orders: boolean;
  support: boolean;
  organizations?: boolean;
  tasks?: boolean;
  payments?: boolean;
  invoices?: boolean;
  shipping?: boolean;
  returns?: boolean;
};

export type CrmWorkflowConfig = {
  dealUsageMode: DealUsageMode;
  quoteUsageMode: QuoteUsageMode;
  quoteRequirement?: "OPTIONAL" | "REQUIRED";
  paymentMode?: "NATIVE" | "EXTERNAL" | "NONE";
  orderMode?: "NATIVE" | "EXTERNAL";
  defaultCustomerType: WorkspaceCustomerType;
  defaultRevenueModel: RevenueModel;
  salesMotion: SalesMotion;
  pipelineTemplate: PipelineTemplateKey;
};

export type CrmTerminologyConfig = {
  leadLabel?: string;
  customerLabel?: string;
  companyLabel?: string;
  contactLabel?: string;
  dealLabel?: string;
  quoteLabel?: string;
  offerLabel?: string;
  proposalLabel?: string;
  orderLabel?: string;
  subscriptionLabel?: string;
};

export interface ModuleStage {
  id: string;
  key: string;
  label: string;
  order: number;
  color?: string;
  isTerminal?: boolean;
  isWon?: boolean;
  isLost?: boolean;
}

export type BantCriterionKey = "budget" | "authority" | "need" | "timeline";

export type LeadQualificationReadiness =
  | "insufficient_data"
  | "needs_clarification"
  | "potential"
  | "ready_to_qualify";

export interface LeadBantCriterionConfig {
  key: BantCriterionKey;
  label: string;
  shortLabel?: string;
  enabled: boolean;
  weight: number;
  requiredForQualification: boolean;
  question: string;
  evidencePlaceholder: string;
  nextQuestion: string;
}

export interface LeadDataQualityRuleConfig {
  key: string;
  label: string;
  enabled: boolean;
  weight: number;
}

export interface LeadQualificationConfig {
  enabled: boolean;
  mode: "BANT_CHECKLIST";
  minQualifyScore?: number;
  minConvertScore?: number;
  requireNeedConfirmed: boolean;
  requireNoNotFitCriteria: boolean;
  allowQualificationOverride: boolean;
  criteria: LeadBantCriterionConfig[];
  dataQualityRules: LeadDataQualityRuleConfig[];
}

export interface LeadDetailConfig {
  tabs: {
    overview: boolean;
    qualification: boolean;
    products: boolean;
    attachments: boolean;
    related: boolean;
  };
  timeline: {
    enabled: boolean;
    defaultVisible: boolean;
    quickActions: {
      call: boolean;
      email: boolean;
      zalo: boolean;
      task: boolean;
      meeting: boolean;
      note: boolean;
    };
  };
}

export interface LeadModuleConfig {
  stages: ModuleStage[];
  conversionOptions: {
    allowConvertToContact: boolean;
  };
  qualification?: LeadQualificationConfig;
  detail?: LeadDetailConfig;
}

export interface OpportunityModuleConfig {
  stages: ModuleStage[];
  allowCustomStages: boolean;
}

export interface QuoteModuleConfig {
  approval?: QuoteApprovalPolicyConfig;
}

export type CustomerCareMode = "REACTIVE" | "PROACTIVE" | "HYBRID";
export type CustomerCareOwnershipStrategy = "RELATIONSHIP_OWNER" | "CURRENT_USER" | "MANUAL";
export type CustomerCareCategoryKey =
  | "request"
  | "consultation"
  | "complaint"
  | "follow_up"
  | "onboarding"
  | "usage_issue"
  | "post_purchase";
export type CustomerCareSourceKey =
  | "manual"
  | "customer_360"
  | "email"
  | "phone"
  | "chat"
  | "web_form"
  | "order"
  | "product";
export type CustomerCarePriorityKey = "low" | "medium" | "high" | "critical";

export interface CustomerCareCommitmentPolicy {
  enabled: boolean;
  firstResponseHours: Record<CustomerCarePriorityKey, number>;
  resolutionHours: Record<CustomerCarePriorityKey, number>;
}

export interface CustomerCareModuleConfig {
  mode: CustomerCareMode;
  ownershipStrategy: CustomerCareOwnershipStrategy;
  enabledCategories: CustomerCareCategoryKey[];
  enabledSources: CustomerCareSourceKey[];
  categoryLabels?: Partial<Record<CustomerCareCategoryKey, { vi: string; en: string }>>;
  sourceLabels?: Partial<Record<CustomerCareSourceKey, { vi: string; en: string }>>;
  defaultPriority: CustomerCarePriorityKey;
  proactiveFollowUp: {
    enabled: boolean;
    postPurchaseDelayDays: number;
    repeatEveryDays?: number;
  };
  commitments: CustomerCareCommitmentPolicy;
}

export type WorkspaceProductType =
  | "physical_product"
  | "service"
  | "subscription"
  | "package"
  | "implementation"
  | "support_sla"
  | "addon"
  | "license"
  | "maintenance";

export type ProductFulfillmentPolicy = "BY_PRODUCT_TYPE" | "SHIPPING_REQUIRED" | "NO_SHIPPING";

export interface ProductStrategyConfig {
  enabledProductTypes: WorkspaceProductType[];
  primaryProductType: WorkspaceProductType;
  allowMixedProductTypes: boolean;
  defaultBillingCycle: "one_time" | "monthly" | "quarterly" | "yearly" | "custom";
  fulfillmentPolicy: ProductFulfillmentPolicy;
}

export type CrmWorkspaceConfig = {
  id: string;
  workspaceId: string;
  name: string;
  businessModel: BusinessModel;
  workflow: CrmWorkflowConfig;
  terminology: CrmTerminologyConfig;
  modules: CrmModuleVisibilityConfig;
  moduleSettings?: {
    leads?: LeadModuleConfig;
    opportunities?: OpportunityModuleConfig;
    quotes?: QuoteModuleConfig;
    products?: ProductStrategyConfig;
    support?: CustomerCareModuleConfig;
  };
};
