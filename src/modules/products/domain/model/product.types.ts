import type { MoneyDto } from "@/shared/money";

export type ProductType =
  | "physical_product"
  | "service"
  | "subscription"
  | "package"
  | "implementation"
  | "support_sla"
  | "addon"
  | "license"
  | "maintenance";

export type ProductStatus =
  | "active"
  | "inactive"
  | "draft"
  | "archived";

export type BillingCycle =
  | "one_time"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "custom";

export type TaxMode =
  | "exclusive"
  | "inclusive"
  | "none";

export interface PricingOption {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: string;
  isPopular?: boolean;
}

export type Product = {
  id: string;
  sku: string;
  name: string;
  type: ProductType;
  status: ProductStatus;
  category: string;
  description?: string;

  unit: string;
  /** Display-only compatibility value derived from unitPrice. */
  listPrice: number;
  unitPrice?: MoneyDto;
  resourceVersion?: number;
  currency: string;
  taxRate: number;
  taxMode: TaxMode;
  billingCycle: BillingCycle;

  /** Display-only compatibility value derived from authoritative costPriceMoney. */
  costPrice?: number;
  costPriceMoney?: MoneyDto;
  marginPercent?: number;

  isSubscription: boolean;
  isRenewable: boolean;
  warrantyMonths?: number;
  defaultContractMonths?: number;

  tags: string[];

  createdAt: string;
  updatedAt: string;
  customFields?: Record<string, any>;
  archivedAt?: string;
  archiveReason?: string;

  // Compatibility fields for legacy usage
  pricingOptions?: PricingOption[];
  businessStats?: {
    soldYTD: number;
    expectedRevenue: number;
    interestedLeads: number;
    conversionRate: number;
    updatedAt: string;
  };
  attachments?: {
    name: string;
    size: string;
    updatedAt: string;
    url?: string;
  }[];
};

export interface ProductConfiguration {
  // SaaS
  billingFrequency?: "monthly" | "quarterly" | "yearly"; // multiplier: monthly: 1, quarterly: 2.8, annual: 10
  userLicenses?: number; // quantity of licenses (qty)
  supportSla?: boolean; // Support SLA add-on (+5,000,000)
  trainingDays?: number; // Training days add-on (+2,000,000 per day)

  // Physical Product
  warrantyPackage?: "standard" | "silver" | "gold" | "platinum"; // prices: standard: 0, silver: 1M, gold: 2.5M, platinum: 5M
  shippingOption?: "sea" | "express" | "air"; // prices: sea: 50k, express: 200k, air: 500k

  // Services
  manDays?: number; // number of man-days
  consultantSeniority?: "junior" | "senior" | "principal"; // rates: junior: 1x, senior: 1.8x, principal: 2.5x of base
  travelExpenseIncluded?: boolean; // flag (+1,500,000 flat)
}

export interface SelectedPickerItem {
  product: Product;
  quantity: number;
  discountPercent?: number; // Optional 0 to 100
  customPrice?: number; // Option to override standard price or configuration-computed price
  billingCycle?: BillingCycle;
  taxMode?: TaxMode;
  configuration?: ProductConfiguration;
}
