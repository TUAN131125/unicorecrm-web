import React from "react";
import type { RouteObject } from "react-router-dom";
import { lazyRouteComponent } from "@/app/router/runtime";
import { ROUTE_KEYS } from "@/platform/navigation";
import { relativeRoutePath } from "@/platform/navigation";
import { ModuleGuard } from "@/components/ModuleGuard";
import { PermissionRouteGuard } from "@/components/PermissionRouteGuard";
import { CAPABILITIES, type Capability } from "@/platform/access-control";
import { buildWorkspaceCapabilityManifest, type WorkspaceCapabilityKey } from "@/platform/capability-manifest";
import type { CrmWorkspaceConfig } from "@/platform/workspace-config";
import {
  isLeadDirectSaleQualificationUnavailable,
  isLeadPositiveQualificationUnavailable,
} from "@/workflows/lead-qualification/application/leadQualificationAvailability";

const DashboardPage = lazyRouteComponent("DashboardPage", () => import("@/workspaces/crm/dashboard"), (m) => m.DashboardPage);
const MyWorkPage = lazyRouteComponent("MyWorkPage", () => import("@/workspaces/crm/my-work"), (m) => m.MyWorkPage);
const WorkCalendarPage = lazyRouteComponent("WorkCalendarPage", () => import("@/workspaces/crm/calendar"), (m) => m.WorkCalendarPage);
const NotificationsPage = lazyRouteComponent("NotificationsPage", () => import("@/workspaces/crm/notifications"), (m) => m.NotificationsPage);
const ReportsPage = lazyRouteComponent("ReportsPage", () => import("@/workspaces/crm/reports"), (m) => m.ReportsPage);

const LeadListPage = lazyRouteComponent("LeadListPage", () => import("@/modules/leads/list-route"), (m) => m.LeadListRoutePage);
const LeadDetailPage = lazyRouteComponent("LeadDetailPage", () => import("@/modules/leads/detail-route"), (m) => m.LeadDetailRoutePage);
const LeadQueuePage = lazyRouteComponent("LeadQueuePage", () => import("@/modules/leads/presentation"), (m) => m.LeadQueuePage);
const LeadQualificationPage = lazyRouteComponent("LeadQualificationPage", () => import("@/workflows/lead-qualification/qualification-route"), (m) => m.LeadQualificationPage);
const LeadSellNowPage = lazyRouteComponent("LeadSellNowPage", () => import("@/workflows/lead-qualification/sell-now-route"), (m) => m.LeadSellNowPage);
const LeadCustomerConversionPage = lazyRouteComponent("LeadCustomerConversionPage", () => import("@/workflows/lead-customer-conversion/conversion-route"), (m) => m.LeadCustomerConversionPage);


const TaskListPage = lazyRouteComponent("TaskListPage", () => import("@/modules/tasks/list-route"), (m) => m.TaskListPage);
const TaskDetailPage = lazyRouteComponent("TaskDetailPage", () => import("@/modules/tasks/detail-route"), (m) => m.TaskDetailPage);

const ProductListPage = lazyRouteComponent("ProductListPage", () => import("@/modules/products/list-route"), (m) => m.ProductListRoutePage);
const ProductDetailPage = lazyRouteComponent("ProductDetailPage", () => import("@/modules/products/detail-route"), (m) => m.ProductDetailRoutePage);

const DealPipelinePage = lazyRouteComponent("DealPipelinePage", () => import("@/modules/deals/presentation"), (m) => m.DealPipelinePage);
const DealDetailPage = lazyRouteComponent("DealDetailPage", () => import("@/modules/deals/detail-route"), (m) => m.DealDetailRoutePage);

const QuoteListPage = lazyRouteComponent("QuoteListPage", () => import("@/modules/quotes/list-route"), (m) => m.QuoteListRoutePage);
const QuoteDetailPage = lazyRouteComponent("QuoteDetailPage", () => import("@/modules/quotes/detail"), (m) => m.QuoteDetailPage);
const QuoteBuilderPage = lazyRouteComponent("QuoteBuilderPage", () => import("@/modules/quotes/builder-route"), (m) => m.QuoteBuilderRoutePage);

const OrderListPage = lazyRouteComponent("OrderListPage", () => import("@/modules/orders/list-route"), (m) => m.OrderListRoutePage);
const OrderFormPage = lazyRouteComponent("OrderFormPage", () => import("@/modules/orders/form-route"), (m) => m.OrderFormRoutePage);
const OrderDetailPage = lazyRouteComponent("OrderDetailPage", () => import("@/modules/orders/detail-route"), (m) => m.OrderDetailRoutePage);

const ContactListPage = lazyRouteComponent("ContactListPage", () => import("@/modules/contacts/list-route"), (m) => m.ContactListRoutePage);
const ContactDetailPage = lazyRouteComponent("ContactDetailPage", () => import("@/modules/contacts/detail-route"), (m) => m.ContactDetailRoutePage);

const OrganizationAccountListPage = lazyRouteComponent("OrganizationAccountListPage", () => import("@/modules/organizations/list-route"), (m) => m.OrganizationAccountListPage);
const OrganizationAccountDetailPage = lazyRouteComponent("OrganizationAccountDetailPage", () => import("@/modules/organizations/detail-route"), (m) => m.OrganizationAccountDetailPage);

const PaymentListPage = lazyRouteComponent("PaymentListPage", () => import("@/modules/payments/list-route"), (m) => m.PaymentOperationsPage);
const PaymentDetailPage = lazyRouteComponent("PaymentDetailPage", () => import("@/modules/payments/detail-route"), (m) => m.PaymentDetailPage);
const InvoiceListPage = lazyRouteComponent("InvoiceListPage", () => import("@/modules/invoices/list-route"), (m) => m.InvoiceListPage);
const InvoiceFormPage = lazyRouteComponent("InvoiceFormPage", () => import("@/modules/invoices/form-route"), (m) => m.InvoiceFormPage);
const InvoiceDetailPage = lazyRouteComponent("InvoiceDetailPage", () => import("@/modules/invoices/detail-route"), (m) => m.InvoiceDetailPage);
const ReceivablesPage = lazyRouteComponent("ReceivablesPage", () => import("@/modules/invoices/receivables-route"), (m) => m.ReceivablesPage);
const ReceivableDetailPage = lazyRouteComponent("ReceivableDetailPage", () => import("@/modules/invoices/receivable-detail-route"), (m) => m.ReceivableDetailPage);
const AccountStatementPage = lazyRouteComponent("AccountStatementPage", () => import("@/modules/invoices/account-statement-route"), (m) => m.AccountStatementPage);


const ShippingBookingListPage = lazyRouteComponent("ShippingBookingListPage", () => import("@/modules/shipping/list-route"), (m) => m.ShippingBookingListPage);
const ShippingBookingCreatePage = lazyRouteComponent("ShippingBookingCreatePage", () => import("@/modules/shipping/create-route"), (m) => m.ShippingBookingCreateRoutePage);
const ShippingBookingDetailPage = lazyRouteComponent("ShippingBookingDetailPage", () => import("@/modules/shipping/detail-route"), (m) => m.ShippingBookingDetailPage);

const ReturnListPage = lazyRouteComponent("ReturnListPage", () => import("@/modules/returns/list-route"), (m) => m.ReturnListPage);
const ReturnFormPage = lazyRouteComponent("ReturnFormPage", () => import("@/modules/returns/form-route"), (m) => m.ReturnFormPage);
const ReturnDetailPage = lazyRouteComponent("ReturnDetailPage", () => import("@/modules/returns/detail-route"), (m) => m.ReturnDetailPage);

const CustomerListPage = lazyRouteComponent("CustomerListPage", () => import("@/modules/customers/list-route"), (m) => m.CustomerListRoutePage);
const CustomerDetailPage = lazyRouteComponent("CustomerDetailPage", () => import("@/modules/customers/detail-route"), (m) => m.CustomerDetailRoutePage);
const CustomerSegmentsPage = lazyRouteComponent("CustomerSegmentsPage", () => import("@/modules/customers/segments-route"), (m) => m.CustomerSegmentsRoutePage);
const CustomerHealthPage = lazyRouteComponent("CustomerHealthPage", () => import("@/modules/customers/health-route"), (m) => m.CustomerHealthRoutePage);

const SupportCaseListPage = lazyRouteComponent("SupportCaseListPage", () => import("@/modules/support/list-route"), (m) => m.SupportCaseListRoutePage);
const SupportCaseFormPage = lazyRouteComponent("SupportCaseFormPage", () => import("@/modules/support/form-route"), (m) => m.SupportCaseFormRoutePage);
const SupportCaseDetailPage = lazyRouteComponent("SupportCaseDetailPage", () => import("@/modules/support/detail-route"), (m) => m.SupportCaseDetailRoutePage);


function moduleRoute(moduleKey: string, enabled: boolean, element: React.ReactElement): React.ReactElement {
  return (
    <ModuleGuard enabled={enabled} moduleKey={moduleKey as WorkspaceCapabilityKey}>
      <PermissionRouteGuard moduleKey={moduleKey}>{element}</PermissionRouteGuard>
    </ModuleGuard>
  );
}

function permissionRoute(moduleKey: string, element: React.ReactElement): React.ReactElement {
  return <PermissionRouteGuard moduleKey={moduleKey}>{element}</PermissionRouteGuard>;
}

function moduleActionRoute(enabled: boolean, capability: Capability, element: React.ReactElement): React.ReactElement {
  return (
    <ModuleGuard enabled={enabled}>
      <PermissionRouteGuard capability={capability}>{element}</PermissionRouteGuard>
    </ModuleGuard>
  );
}

export function createCrmWorkspaceRoutes(crmConfig: CrmWorkspaceConfig): RouteObject[] {
  const capabilityManifest = buildWorkspaceCapabilityManifest(crmConfig);
  const canRead = (key: WorkspaceCapabilityKey) => capabilityManifest.entries[key].canReadInNativeUi;
  const canWrite = (key: WorkspaceCapabilityKey) => capabilityManifest.entries[key].canWriteInNativeUi;
  const dealsEnabled = canRead("deals");
  const quotesEnabled = canRead("quotes");
  const ordersEnabled = canRead("orders");
  const organizationsEnabled = canRead("organizations");
  const tasksEnabled = canRead("tasks");
  const paymentsEnabled = canRead("payments");
  const invoicesEnabled = canRead("invoices");
  const shippingEnabled = canRead("shipping");
  const returnsEnabled = canRead("returns");
  const customersEnabled = canRead("customers");
  const positiveLeadQualificationEnabled = canWrite("leads") && !isLeadPositiveQualificationUnavailable();
  const directSaleQualificationEnabled = canWrite("leads") && !isLeadDirectSaleQualificationUnavailable();

  return [
    { path: relativeRoutePath(ROUTE_KEYS.DASHBOARD), element: <DashboardPage /> },
    { path: relativeRoutePath(ROUTE_KEYS.MY_WORK), element: <MyWorkPage /> },
    { path: relativeRoutePath(ROUTE_KEYS.CALENDAR), element: <WorkCalendarPage /> },
    { path: relativeRoutePath(ROUTE_KEYS.NOTIFICATIONS), element: <NotificationsPage /> },

    { path: relativeRoutePath(ROUTE_KEYS.TASKS), element: moduleRoute("tasks", tasksEnabled, <TaskListPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.TASK_DETAIL), element: moduleRoute("tasks", tasksEnabled, <TaskDetailPage />) },

    { path: relativeRoutePath(ROUTE_KEYS.LEADS), element: moduleRoute("leads", canRead("leads"), <LeadListPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.LEADS_QUEUE), element: moduleRoute("leads", canRead("leads"), <LeadQueuePage />) },
    { path: relativeRoutePath(ROUTE_KEYS.LEAD_DETAIL), element: moduleRoute("leads", canRead("leads"), <LeadDetailPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.LEAD_QUALIFY), element: moduleActionRoute(positiveLeadQualificationEnabled, CAPABILITIES.LEADS_QUALIFY, <LeadQualificationPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.LEAD_SELL_NOW), element: moduleActionRoute(directSaleQualificationEnabled, CAPABILITIES.LEADS_QUALIFY, <LeadSellNowPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.LEAD_CONVERT), element: moduleActionRoute(canWrite("leads"), CAPABILITIES.LEADS_CONVERT_TO_CUSTOMER, <LeadCustomerConversionPage />) },

    { path: relativeRoutePath(ROUTE_KEYS.CATALOG), element: permissionRoute("products", <ProductListPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.PRODUCT_DETAIL), element: permissionRoute("products", <ProductDetailPage />) },

    { path: relativeRoutePath(ROUTE_KEYS.DEALS), element: moduleRoute("deals", dealsEnabled, <DealPipelinePage />) },
    { path: relativeRoutePath(ROUTE_KEYS.DEAL_DETAIL), element: moduleRoute("deals", dealsEnabled, <DealDetailPage />) },

    { path: relativeRoutePath(ROUTE_KEYS.QUOTES), element: moduleRoute("quotes", quotesEnabled, <QuoteListPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.QUOTE_DETAIL), element: moduleRoute("quotes", quotesEnabled, <QuoteDetailPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.QUOTE_NEW), element: moduleActionRoute(canWrite("quotes"), CAPABILITIES.QUOTES_CREATE, <QuoteBuilderPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.QUOTE_EDIT), element: moduleActionRoute(canWrite("quotes"), CAPABILITIES.QUOTES_UPDATE, <QuoteBuilderPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.QUOTE_BUILDER_LEGACY), element: moduleActionRoute(canWrite("quotes"), CAPABILITIES.QUOTES_CREATE, <QuoteBuilderPage />) },

    { path: relativeRoutePath(ROUTE_KEYS.ORDERS), element: moduleRoute("orders", ordersEnabled, <OrderListPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.ORDER_NEW), element: moduleActionRoute(canWrite("orders"), CAPABILITIES.ORDERS_CREATE, <OrderFormPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.ORDER_DETAIL), element: moduleRoute("orders", ordersEnabled, <OrderDetailPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.ORDER_EDIT), element: moduleActionRoute(canWrite("orders"), CAPABILITIES.ORDERS_UPDATE, <OrderFormPage />) },

    { path: relativeRoutePath(ROUTE_KEYS.PAYMENTS), element: moduleRoute("payments", paymentsEnabled, <PaymentListPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.PAYMENT_DETAIL), element: moduleRoute("payments", paymentsEnabled, <PaymentDetailPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.INVOICES), element: moduleRoute("invoices", invoicesEnabled, <InvoiceListPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.INVOICE_NEW), element: moduleActionRoute(canWrite("invoices"), CAPABILITIES.INVOICES_CREATE, <InvoiceFormPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.INVOICE_DETAIL), element: moduleRoute("invoices", invoicesEnabled, <InvoiceDetailPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.INVOICE_EDIT), element: moduleActionRoute(canWrite("invoices"), CAPABILITIES.INVOICES_UPDATE_DRAFT, <InvoiceFormPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.RECEIVABLES), element: moduleRoute("receivables", invoicesEnabled, <ReceivablesPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.RECEIVABLE_DETAIL), element: moduleRoute("receivables", invoicesEnabled, <ReceivableDetailPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.ACCOUNT_STATEMENT), element: moduleRoute("receivables", invoicesEnabled, <AccountStatementPage />) },

    { path: relativeRoutePath(ROUTE_KEYS.SHIPPING), element: moduleRoute("shipping", shippingEnabled, <ShippingBookingListPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.SHIPPING_NEW), element: moduleActionRoute(canWrite("shipping"), CAPABILITIES.SHIPPING_CREATE, <ShippingBookingCreatePage />) },
    { path: relativeRoutePath(ROUTE_KEYS.SHIPPING_DETAIL), element: moduleRoute("shipping", shippingEnabled, <ShippingBookingDetailPage />) },


    { path: relativeRoutePath(ROUTE_KEYS.RETURNS), element: moduleRoute("returns", returnsEnabled, <ReturnListPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.RETURN_NEW), element: moduleActionRoute(canWrite("returns"), CAPABILITIES.RETURNS_UPDATE, <ReturnFormPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.RETURN_DETAIL), element: moduleRoute("returns", returnsEnabled, <ReturnDetailPage />) },

    { path: relativeRoutePath(ROUTE_KEYS.CONTACTS), element: moduleRoute("contacts", canRead("contacts"), <ContactListPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.CONTACT_DETAIL), element: moduleRoute("contacts", canRead("contacts"), <ContactDetailPage />) },

    { path: relativeRoutePath(ROUTE_KEYS.ORGANIZATIONS), element: moduleRoute("organizations", organizationsEnabled, <OrganizationAccountListPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.ORGANIZATION_DETAIL), element: moduleRoute("organizations", organizationsEnabled, <OrganizationAccountDetailPage />) },

    { path: relativeRoutePath(ROUTE_KEYS.CUSTOMERS), element: moduleRoute("customers", customersEnabled, <CustomerListPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.CUSTOMER_DETAIL), element: moduleRoute("customers", customersEnabled, <CustomerDetailPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.CUSTOMER_SEGMENTS), element: moduleRoute("customers", customersEnabled, <CustomerSegmentsPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.CUSTOMER_HEALTH), element: moduleRoute("customers", customersEnabled, <CustomerHealthPage />) },


    { path: relativeRoutePath(ROUTE_KEYS.SUPPORT_CASES), element: moduleRoute("support", canRead("support"), <SupportCaseListPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.SUPPORT_CASE_NEW), element: moduleActionRoute(canWrite("support"), CAPABILITIES.SUPPORT_CREATE, <SupportCaseFormPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.SUPPORT_CASE_DETAIL), element: moduleRoute("support", canRead("support"), <SupportCaseDetailPage />) },
    { path: relativeRoutePath(ROUTE_KEYS.SUPPORT_CASE_EDIT), element: moduleActionRoute(canWrite("support"), CAPABILITIES.SUPPORT_UPDATE, <SupportCaseFormPage />) },

    { path: relativeRoutePath(ROUTE_KEYS.REPORTS), element: permissionRoute("reports", <ReportsPage />) },
  ];
}
