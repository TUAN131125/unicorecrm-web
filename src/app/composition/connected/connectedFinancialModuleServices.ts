import type { InvoiceApplicationServices } from "@/modules/invoices/application/composition/invoiceApplicationServices";
import type { InvoiceRepositorySnapshot } from "@/modules/invoices/application/ports/InvoiceRepository";
import { createInvoiceVerticalSlice, type InvoiceWorkspaceDto } from "@/modules/invoices/application/vertical-slice/invoiceVerticalSlice";
import type { CreditNote, Invoice, InvoiceDeliveryRecord } from "@/modules/invoices/domain/model/invoice.types";
import type { InvoiceSellerInformation } from "@/modules/invoices/domain/model/invoiceConfiguration.types";
import { InvoiceHttpAdapter } from "@/modules/invoices/infrastructure/http/InvoiceHttpAdapter";
import { ReceivablesHttpAdapter } from "@/modules/invoices/infrastructure/http/ReceivablesHttpAdapter";
import type { PaymentApplicationServices } from "@/modules/payments/application/composition/paymentApplicationServices";
import type { PaymentRepositorySnapshot } from "@/modules/payments/application/ports/PaymentRepository";
import { createPaymentVerticalSlice, type PaymentWorkspaceDto } from "@/modules/payments/application/vertical-slice/paymentVerticalSlice";
import type { PaymentConfiguration } from "@/modules/payments/domain/model/paymentConfiguration.types";
import type { PaymentMigrationReview, PaymentObligation, PaymentTransaction } from "@/modules/payments/domain/model/payment.types";
import type { PaymentPlan, PaymentScheduleLine } from "@/modules/payments/domain/model/paymentPlan.types";
import type {
  CustomerCredit,
  InvoicePaymentAllocation,
  PaymentIntent,
  PaymentRecord,
  RefundIntent,
} from "@/modules/payments/domain/model/paymentCollection.types";
import { PaymentHttpAdapter } from "@/modules/payments/infrastructure/http/PaymentHttpAdapter";
import { runBackendProjection } from "@/shared/application";
import type { HttpClient } from "@/platform/api";
import {
  ConnectedSnapshotProjection,
  unavailableConnectedOperation,
} from "./connectedProjectionRepositories";

const EMPTY_ACCOUNTING_AS_OF_DATE = "1970-01-01";

export interface ConnectedFinancialModuleServices {
  payments: PaymentApplicationServices;
  invoices: InvoiceApplicationServices;
}

export function createConnectedFinancialModuleServices(
  httpClient: HttpClient,
): ConnectedFinancialModuleServices {
  const paymentApi = new PaymentHttpAdapter(httpClient);
  const invoiceApi = new InvoiceHttpAdapter(httpClient);
  const receivablesApi = new ReceivablesHttpAdapter(httpClient);

  const paymentProjection = new ConnectedSnapshotProjection<PaymentRepositorySnapshot>("payments", emptyPaymentSnapshot());
  const invoiceProjection = new ConnectedSnapshotProjection<InvoiceRepositorySnapshot>("invoices", emptyInvoiceSnapshot());

  const paymentVerticalSlice = createPaymentVerticalSlice(paymentApi, {
    projectWorkspace(workspace) {
      runBackendProjection("payments", () => paymentProjection.replace(projectPaymentWorkspace(workspace, paymentProjection.snapshot())));
    },
  });
  const invoiceVerticalSlice = createInvoiceVerticalSlice(invoiceApi, receivablesApi, paymentApi, {
    projectWorkspace(workspace) {
      runBackendProjection("invoices", () => invoiceProjection.replace(projectInvoiceWorkspace(workspace, invoiceProjection.snapshot())));
    },
    projectAccountingAsOfDate(asOfDate) {
      runBackendProjection("invoices", () => invoiceProjection.replace({
        ...invoiceProjection.snapshot(),
        accountingAsOfDate: asOfDate,
      }));
    },
  });

  return {
    payments: {
      repository: createPaymentRepository(paymentProjection),
      api: paymentApi,
      verticalSlice: paymentVerticalSlice,
      configuration: createPaymentConfiguration(),
    },
    invoices: {
      repository: createInvoiceRepository(invoiceProjection),
      api: invoiceApi,
      receivablesApi,
      receivableOperations: {
        list: () => [],
        save: unavailableConnectedOperation("Receivable collection activity save"),
        updateState: unavailableConnectedOperation("Receivable collection activity state update"),
        subscribe: () => () => undefined,
      },
      verticalSlice: invoiceVerticalSlice,
      configuration: createInvoiceConfiguration(),
    },
  };
}

function createPaymentRepository(projection: ConnectedSnapshotProjection<PaymentRepositorySnapshot>): PaymentApplicationServices["repository"] {
  return {
    snapshot: () => projection.snapshot(),
    listObligations: () => projection.snapshot().obligations,
    listTransactions: () => projection.snapshot().transactions,
    listMigrationReviews: () => projection.snapshot().migrationReviews,
    saveObligation: (record: PaymentObligation) => savePaymentRecord(projection, "obligations", record),
    saveTransaction: (record: PaymentTransaction) => savePaymentRecord(projection, "transactions", record),
    listPlans: () => projection.snapshot().plans,
    listScheduleLines: () => projection.snapshot().scheduleLines,
    listIntents: () => projection.snapshot().intents,
    listRefundIntents: () => projection.snapshot().refundIntents,
    listPaymentRecords: () => projection.snapshot().paymentRecords,
    listAllocations: () => projection.snapshot().allocations,
    listCustomerCredits: () => projection.snapshot().customerCredits,
    listPaymentMethods: () => projection.snapshot().methodCatalog,
    listPaymentProviders: () => projection.snapshot().providerCatalog,
    savePlan: (record: PaymentPlan) => savePaymentRecord(projection, "plans", record),
    saveScheduleLine: (record: PaymentScheduleLine) => savePaymentRecord(projection, "scheduleLines", record),
    saveIntent: (record: PaymentIntent) => savePaymentRecord(projection, "intents", record),
    saveRefundIntent: (record: RefundIntent) => savePaymentRecord(projection, "refundIntents", record),
    savePaymentRecord: (record: PaymentRecord) => savePaymentRecord(projection, "paymentRecords", record),
    saveAllocation: (record: InvoicePaymentAllocation) => savePaymentRecord(projection, "allocations", record),
    saveCustomerCredit: (record: CustomerCredit) => savePaymentRecord(projection, "customerCredits", record),
    replace: (snapshot) => projection.replace(snapshot),
    subscribe: (listener) => projection.subscribe(listener),
  };
}

function createInvoiceRepository(projection: ConnectedSnapshotProjection<InvoiceRepositorySnapshot>): InvoiceApplicationServices["repository"] {
  return {
    snapshot: () => projection.snapshot(),
    getAccountingAsOfDate: () => projection.snapshot().accountingAsOfDate,
    listInvoices: () => projection.snapshot().invoices,
    listCreditNotes: () => projection.snapshot().creditNotes,
    listDeliveries: () => projection.snapshot().deliveries,
    saveInvoice: (record: Invoice) => saveInvoiceRecord(projection, "invoices", record),
    saveCreditNote: (record: CreditNote) => saveInvoiceRecord(projection, "creditNotes", record),
    saveDelivery: (record: InvoiceDeliveryRecord) => saveInvoiceRecord(projection, "deliveries", record),
    replace: (snapshot) => projection.replace(snapshot),
    subscribe: (listener) => projection.subscribe(listener),
  };
}

function createPaymentConfiguration(): PaymentApplicationServices["configuration"] {
  const snapshot = emptyPaymentConfiguration();
  return {
    getSnapshot: () => snapshot,
    saveConfiguration: unavailableConnectedOperation("Payment configuration save"),
    saveReceivingAccounts: unavailableConnectedOperation("Payment receiving-account save"),
    subscribe: () => () => undefined,
  };
}

function createInvoiceConfiguration(): InvoiceApplicationServices["configuration"] {
  const snapshot: InvoiceSellerInformation = {
    revision: 0,
    sellerName: "",
    taxId: "",
    invoiceAddressId: null,
    email: "",
    phone: "",
    numberingPrefix: "",
    defaultDueDays: 0,
    notes: "",
    defaultReceivingAccountId: null,
    defaultCurrency: "",
  };
  return {
    getSellerInformation: () => snapshot,
    saveSellerInformation: unavailableConnectedOperation("Invoice seller-information save"),
    subscribe: () => () => undefined,
  };
}

function emptyPaymentSnapshot(): PaymentRepositorySnapshot {
  return {
    obligations: [],
    transactions: [],
    migrationReviews: [],
    plans: [],
    scheduleLines: [],
    intents: [],
    refundIntents: [],
    paymentRecords: [],
    allocations: [],
    customerCredits: [],
    methodCatalog: [],
    providerCatalog: [],
  };
}

function emptyInvoiceSnapshot(): InvoiceRepositorySnapshot {
  return {
    accountingAsOfDate: EMPTY_ACCOUNTING_AS_OF_DATE,
    invoices: [],
    creditNotes: [],
    deliveries: [],
  };
}

function emptyPaymentConfiguration(): PaymentConfiguration {
  return {
    revision: 0,
    enabledMethods: [],
    defaultMethod: "BANK_TRANSFER",
    methods: [],
    receivingAccounts: [],
    qrPolicy: {
      enabled: false,
      showOnOrderDetail: false,
      showOnPrint: false,
      showOnQuote: false,
      showOnInvoice: false,
      amountMode: "OUTSTANDING",
      transferContentTemplate: "",
      accountSelection: "DEFAULT",
      displayStyle: "COMPACT",
    },
    planTemplates: [],
    creditPolicy: {
      enabled: false,
      defaultCreditLimit: 0,
      maximumOverdueAmount: 0,
      maximumOverdueDays: 0,
      approvalThreshold: 0,
      approverRoleLabel: "",
      requireOverrideReason: true,
      creditHoldEnabled: false,
    },
  };
}

function projectPaymentWorkspace(
  workspace: PaymentWorkspaceDto,
  current: PaymentRepositorySnapshot,
): PaymentRepositorySnapshot {
  return {
    ...current,
    plans: workspace.plans,
    scheduleLines: workspace.scheduleLines,
    intents: workspace.intents,
    refundIntents: workspace.refundIntents,
    paymentRecords: workspace.paymentRecords,
    allocations: workspace.allocations,
    customerCredits: workspace.customerCredits,
    methodCatalog: workspace.methodCatalog,
    providerCatalog: workspace.providerCatalog,
  };
}

function projectInvoiceWorkspace(
  workspace: InvoiceWorkspaceDto,
  current: InvoiceRepositorySnapshot,
): InvoiceRepositorySnapshot {
  return {
    ...current,
    invoices: workspace.invoices,
    creditNotes: workspace.creditNotes,
    deliveries: workspace.deliveries,
  };
}

type MutablePaymentCollectionKey =
  | "obligations"
  | "transactions"
  | "plans"
  | "scheduleLines"
  | "intents"
  | "refundIntents"
  | "paymentRecords"
  | "allocations"
  | "customerCredits";

function savePaymentRecord<
  K extends MutablePaymentCollectionKey,
  T extends PaymentRepositorySnapshot[K][number] & { id: string },
>(
  projection: ConnectedSnapshotProjection<PaymentRepositorySnapshot>,
  key: K,
  record: T,
): T {
  projection.update((snapshot) => ({
    ...snapshot,
    [key]: upsertById(snapshot[key] as unknown as readonly T[], record),
  }));
  return record;
}

function saveInvoiceRecord<
  K extends "invoices" | "creditNotes" | "deliveries",
  T extends InvoiceRepositorySnapshot[K][number],
>(
  projection: ConnectedSnapshotProjection<InvoiceRepositorySnapshot>,
  key: K,
  record: T,
): T {
  projection.update((snapshot) => ({
    ...snapshot,
    [key]: upsertById(snapshot[key] as T[], record),
  }));
  return record;
}

function upsertById<T extends { id: string }>(records: readonly T[], record: T): T[] {
  return records.some((candidate) => candidate.id === record.id)
    ? records.map((candidate) => candidate.id === record.id ? record : candidate)
    : [...records, record];
}
