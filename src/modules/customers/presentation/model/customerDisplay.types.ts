export type CustomerType = "COMPANY" | "INDIVIDUAL";

export type CustomerStatus =
  | "active"
  | "inactive"
  | "archived"
  | "do_not_contact"
  | "churned"
  | "prospect"
  | "new"
  | "new_customer"
  | "at_risk"
  | "quoting"
  | "ordering"
  | "lost";

export interface CustomerProductOwned {
  id: string;
  productId: string;
  skuSnapshot?: string;
  productNameSnapshot: string;
  productTypeSnapshot?: string;
  descriptionSnapshot?: string;
  quantity: number;
  purchaseDate: string;
  sourceLeadId?: string;
  sourceDealId?: string;
  sourceQuoteId?: string;
  sourceOrderId?: string;
  sourceLabel?: string;
  orderNumber?: string;
  amount: number;
  currency?: string;
  startDate?: string;
  endDate?: string;
  expiryDate?: string;
  warrantyUntil?: string;
  renewalAt?: string;
  billingCycle?: string;
  subscriptionStatus?: "active" | "expired" | "cancelled" | "renewal_due";
  slaLevel?: string;
  status: "active" | "expired" | "cancelled" | "renewal_due";
}

export interface CustomerDisplay {
  id: string;
  customerCode: string;
  type: CustomerType;
  displayName: string;
  /** Legacy display aliases kept during presentation cleanup. */
  name?: string;
  fullName?: string;

  companyName?: string;
  individualName?: string;

  phone?: string;
  email?: string;
  taxCode?: string;
  address?: string;

  segment?: "SME" | "Enterprise" | "Key Account" | "Retail" | "VIP" | "Standard";
  industry?: string;
  source?: string;
  status?: CustomerStatus;

  ownerId?: string; // CRM owner ID
  ownerName?: string;
  csmName?: string;
  tags?: string[];

  totalRevenue?: number;
  outstandingDebt?: number;
  purchaseCount?: number;
  lastPurchaseDate?: string;
  purchaseCycleDays?: number;

  mrr: number; // Monthly Recurring Revenue as number
  health: "Tốt" | "Trung bình" | "Cảnh báo";
  renewalDate?: string;
  productsOwned: CustomerProductOwned[];

  // Extra Customer CRM context fields
  city?: string;
  website?: string;
  csmId?: string; // Care Owner / Customer Success Manager ID
  priority?: "LOW" | "MEDIUM" | "HIGH";
  nextCareAt?: string;
  lastCareAt?: string;
  notes?: string;
  internalNotes?: string;
  lifetimeValue?: number;
  annualRevenue?: number;

  // Billing & Legal
  billingName?: string;
  billingEmail?: string;
  billingAddress?: string;
  activities?: any[];
}

export type Customer = CustomerDisplay;
