import type { PurchaseEvidence } from "@/modules/commercial-evidence";
import type { Contact } from "@/modules/contacts";
import type { Lead } from "@/modules/leads";
import type { Deal } from "@/modules/deals";
import type { CustomerOrder } from "@/modules/orders";
import type { OrganizationAccount } from "@/modules/organizations";
import type { PaymentObligation, PaymentTransaction } from "@/modules/payments";
import type { Quote } from "@/modules/quotes";
import type { Invoice, ReceivableEntry } from "@/modules/invoices";
import type { ReturnRequest, ReturnResolutionIntent } from "@/modules/returns";
import type { ShippingBooking } from "@/modules/shipping";
import type { SupportCase } from "@/modules/support";
import type { Activity, Task } from "@/modules/tasks";
import type { RelationshipIntegrityIssue } from "@/platform/relationship-integrity";
import type { Customer, CustomerCareCard } from "../../domain/model/customer.types";

export interface CustomerIdentityView {
  displayName: string;
  email?: string;
  phone?: string;
  address?: string;
  taxCode?: string;
  ownerId?: string;
  primaryContact?: Contact;
  contacts: Contact[];
  contact?: Contact;
  organization?: OrganizationAccount;
}

export interface CustomerTimelineItem {
  id: string;
  kind:
    | "CUSTOMER"
    | "LEAD"
    | "DEAL"
    | "QUOTE"
    | "ORDER"
    | "PAYMENT"
    | "INVOICE"
    | "SHIPPING"
    | "RETURN"
    | "CARE"
    | "SUPPORT"
    | "TASK"
    | "ACTIVITY"
    | "NOTE";
  title: string;
  detail?: string;
  eventType?:
    | "CUSTOMER_CREATED_FROM_PURCHASE"
    | "LEAD_JOURNEY"
    | "DEAL_CREATED"
    | "QUOTE_UPDATED"
    | "ORDER_UPDATED"
    | "PAYMENT_RECORDED"
    | "INVOICE_UPDATED"
    | "SHIPPING_DELIVERED"
    | "RETURN_UPDATED"
    | "CONTACT_NOTE"
    | "CONTACT_INTERNAL_NOTE";
  params?: Record<string, string | number | undefined>;
  statusCode?: string;
  occurredAt: string;
  recordRef?: { moduleKey: string; recordId: string };
  activityType?: string;
}

export interface Customer360ReadModel {
  customer: Customer;
  identity: CustomerIdentityView;
  leads: Lead[];
  deals: Deal[];
  quotes: Quote[];
  orders: CustomerOrder[];
  paymentObligations: PaymentObligation[];
  paymentTransactions: PaymentTransaction[];
  invoices: Invoice[];
  receivables: ReceivableEntry[];
  shippingBookings: ShippingBooking[];
  returns: ReturnRequest[];
  returnIntents: ReturnResolutionIntent[];
  supportCases: SupportCase[];
  tasks: Task[];
  activities: Activity[];
  careCards: CustomerCareCard[];
  purchaseEvidence: PurchaseEvidence[];
  timeline: CustomerTimelineItem[];
  metrics: {
    revenue: number;
    leadCount: number;
    orderCount: number;
    openTaskCount: number;
    overdueTaskCount: number;
    openSupportCount: number;
    supportRiskCount: number;
    openDealCount: number;
    quoteCount: number;
    productCount: number;
    purchaseCount: number;
    openInvoiceCount: number;
    overdueReceivableCount: number;
    activeReturnCount: number;
    returnAttentionCount: number;
  };
  integrity: {
    status: "HEALTHY" | "NEEDS_REVIEW" | "BLOCKED";
    errorCount: number;
    warningCount: number;
    issues: RelationshipIntegrityIssue[];
  };
  productsPurchased: Array<{
    productId: string;
    productName: string;
    quantity: number;
    amount: number;
    firstPurchasedAt: string;
    lastPurchasedAt: string;
  }>;
}
