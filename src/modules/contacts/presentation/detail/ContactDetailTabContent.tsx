import React from "react";
import { RelationshipWorkspace, relationshipWorkspaceLabel } from "@/components/crm/relationship-detail";
import { useI18n } from "@/i18n";
import type { ContactTab } from "./ContactDetailTabs";
import { getActiveContactOrganizationRelationships } from "../../domain/model/contactOrganizationRelationships";
import { ContactOverviewTab } from "./tabs/ContactOverviewTab";
import { ContactInfoTab } from "./tabs/ContactInfoTab";
import { ContactNotesTab } from "./tabs/ContactNotesTab";
import { ContactAttachmentsTab } from "./tabs/ContactAttachmentsTab";
import { ContactPurchasedProductsTab } from "./tabs/ContactPurchasedProductsTab";
import { ContactOpportunitiesTab } from "./tabs/ContactOpportunitiesTab";
import { ContactOrdersTab } from "./tabs/ContactOrdersTab";
import { ContactQuotationsTab } from "./tabs/ContactQuotationsTab";
import { ContactInvoicesTab } from "./tabs/ContactInvoicesTab";
import { ContactActiveTasksTab } from "./tabs/ContactActiveTasksTab";
import { ContactCareCasesTab } from "./tabs/ContactCareCasesTab";
import { ContactRelationshipsTab } from "./tabs/ContactRelationshipsTab";
import { ContactActivitiesTab } from "./tabs/ContactActivitiesTab";
import {
  ContactPaymentsTab,
  ContactPurchaseHistoryTab,
  ContactReturnsTab,
  ContactShippingTab,
} from "./tabs/ContactTransactionOperationsTabs";

type RelationshipView = "profile" | "people" | "notes";
type SalesView = "opportunities" | "quotations";
type TransactionView = "orders" | "invoices" | "payments" | "shipping" | "returns" | "products" | "history";
type ServiceView = "support";
type WorkView = "tasks" | "activities";

interface ContactDetailTabContentProps {
  activeTab: ContactTab;
  requestedSubTab?: string;
  overview: React.ComponentProps<typeof ContactOverviewTab>;
  detailInfo: React.ComponentProps<typeof ContactInfoTab>;
  relationships: React.ComponentProps<typeof ContactRelationshipsTab>;
  notes: React.ComponentProps<typeof ContactNotesTab>;
  attachments: React.ComponentProps<typeof ContactAttachmentsTab>;
  purchasedProducts: React.ComponentProps<typeof ContactPurchasedProductsTab>;
  opportunities: React.ComponentProps<typeof ContactOpportunitiesTab>;
  orders: React.ComponentProps<typeof ContactOrdersTab>;
  quotations: React.ComponentProps<typeof ContactQuotationsTab>;
  invoices: React.ComponentProps<typeof ContactInvoicesTab>;
  payments: React.ComponentProps<typeof ContactPaymentsTab>;
  shipping: React.ComponentProps<typeof ContactShippingTab>;
  returns: React.ComponentProps<typeof ContactReturnsTab>;
  purchaseHistory: React.ComponentProps<typeof ContactPurchaseHistoryTab>;
  activeTasks: React.ComponentProps<typeof ContactActiveTasksTab>;
  careCases: React.ComponentProps<typeof ContactCareCasesTab>;
  activities: React.ComponentProps<typeof ContactActivitiesTab>;
}

export function ContactDetailTabContent(props: ContactDetailTabContentProps) {
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const [relationshipView, setRelationshipView] = React.useState<RelationshipView>("profile");
  const [salesView, setSalesView] = React.useState<SalesView>("opportunities");
  const [transactionView, setTransactionView] = React.useState<TransactionView>("orders");
  const [serviceView, setServiceView] = React.useState<ServiceView>("support");
  const [workView, setWorkView] = React.useState<WorkView>("tasks");

  React.useEffect(() => {
    const requested = props.requestedSubTab;
    if (!requested) return;
    if (props.activeTab === "relationship" && ["profile", "people", "notes", "linkedCustomer"].includes(requested)) setRelationshipView((requested === "linkedCustomer" ? "people" : requested) as RelationshipView);
    if (props.activeTab === "sales" && ["opportunities", "quotations"].includes(requested)) setSalesView(requested as SalesView);
    if (props.activeTab === "transactions" && ["orders", "invoices", "payments", "shipping", "returns", "products", "history"].includes(requested)) setTransactionView(requested as TransactionView);
    if (props.activeTab === "service" && requested === "support") setServiceView("support");
    if (props.activeTab === "work" && ["tasks", "activities", "history"].includes(requested)) setWorkView(requested === "history" ? "activities" : requested as WorkView);
  }, [props.activeTab, props.requestedSubTab]);

  let content: React.ReactNode;
  switch (props.activeTab) {
    case "overview":
      content = <ContactOverviewTab {...props.overview} />;
      break;
    case "relationship":
      content = (
        <RelationshipWorkspace
          workspaceKey="contact-relationship"
          activeId={relationshipView}
          onChange={(id) => setRelationshipView(id as RelationshipView)}
          items={[
            { id: "profile", label: relationshipWorkspaceLabel("profile", isVi) },
            { id: "people", label: relationshipWorkspaceLabel("people", isVi), count: Number(Boolean(props.relationships.customer)) + getActiveContactOrganizationRelationships(props.relationships.contact).length },
            { id: "notes", label: relationshipWorkspaceLabel("notes", isVi), count: props.notes.contactNotes.length },
          ]}
        >
          {relationshipView === "profile" ? <ContactInfoTab {...props.detailInfo} /> : relationshipView === "people" ? <ContactRelationshipsTab {...props.relationships} /> : <ContactNotesTab {...props.notes} />}
        </RelationshipWorkspace>
      );
      break;
    case "sales":
      content = (
        <RelationshipWorkspace
          workspaceKey="contact-sales"
          activeId={salesView}
          onChange={(id) => setSalesView(id as SalesView)}
          items={[
            { id: "opportunities", label: relationshipWorkspaceLabel("opportunities", isVi), count: props.opportunities.opportunities.length },
            { id: "quotations", label: relationshipWorkspaceLabel("quotations", isVi), count: (props.quotations.quotes ?? []).length },
          ]}
        >
          {salesView === "opportunities" ? <ContactOpportunitiesTab {...props.opportunities} /> : <ContactQuotationsTab {...props.quotations} />}
        </RelationshipWorkspace>
      );
      break;
    case "transactions":
      content = (
        <RelationshipWorkspace
          workspaceKey="contact-transactions"
          activeId={transactionView}
          onChange={(id) => setTransactionView(id as TransactionView)}
          items={[
            { id: "orders", label: relationshipWorkspaceLabel("orders", isVi), count: props.orders.orders.length },
            { id: "invoices", label: relationshipWorkspaceLabel("invoices", isVi), count: props.invoices.invoices.length },
            { id: "payments", label: relationshipWorkspaceLabel("payments", isVi), count: props.payments.transactions.length + props.payments.receivables.length },
            { id: "shipping", label: relationshipWorkspaceLabel("shipping", isVi), count: props.shipping.bookings.length },
            { id: "returns", label: relationshipWorkspaceLabel("returns", isVi), count: props.returns.requests.length },
            { id: "products", label: relationshipWorkspaceLabel("products", isVi), count: (props.purchasedProducts.purchasedProducts ?? []).length },
            { id: "history", label: relationshipWorkspaceLabel("history", isVi), count: props.purchaseHistory.orders.length + props.purchaseHistory.invoices.length + props.purchaseHistory.transactions.length + props.purchaseHistory.bookings.length + props.purchaseHistory.returns.length },
          ]}
        >
          {transactionView === "orders" ? <ContactOrdersTab {...props.orders} />
            : transactionView === "invoices" ? <ContactInvoicesTab {...props.invoices} />
              : transactionView === "payments" ? <ContactPaymentsTab {...props.payments} />
                : transactionView === "shipping" ? <ContactShippingTab {...props.shipping} />
                  : transactionView === "returns" ? <ContactReturnsTab {...props.returns} />
                    : transactionView === "products" ? <ContactPurchasedProductsTab {...props.purchasedProducts} />
                      : <ContactPurchaseHistoryTab {...props.purchaseHistory} />}
        </RelationshipWorkspace>
      );
      break;
    case "service":
      content = (
        <RelationshipWorkspace workspaceKey="contact-service" activeId={serviceView} onChange={(id) => setServiceView(id as ServiceView)} items={[{ id: "support", label: relationshipWorkspaceLabel("support", isVi), count: props.careCases.cases.length }]}>
          <ContactCareCasesTab {...props.careCases} />
        </RelationshipWorkspace>
      );
      break;
    case "work":
      content = (
        <RelationshipWorkspace
          workspaceKey="contact-work"
          activeId={workView}
          onChange={(id) => setWorkView(id as WorkView)}
          items={[
            { id: "tasks", label: relationshipWorkspaceLabel("tasks", isVi), count: props.activeTasks.tasks.length },
            { id: "activities", label: relationshipWorkspaceLabel("activities", isVi), count: props.activities.activities.length },
          ]}
        >
          {workView === "tasks" ? <ContactActiveTasksTab {...props.activeTasks} /> : <ContactActivitiesTab {...props.activities} />}
        </RelationshipWorkspace>
      );
      break;
    case "attachments":
      content = <ContactAttachmentsTab {...props.attachments} />;
      break;
  }

  return <div className="min-h-[440px] [overflow-anchor:none]">{content}</div>;
}
