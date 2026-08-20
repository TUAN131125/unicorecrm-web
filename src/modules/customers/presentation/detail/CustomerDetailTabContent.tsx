import React from "react";
import { useNavigate } from "react-router-dom";
import { RecordAttachmentsTab, type RecordAttachmentItem, type RecordAttachmentUploadData } from "@/components/crm/detail-archetype";
import { relationshipRecordPath, relationshipWorkspaceLabel } from "@/components/crm/relationship-detail";
import { useI18n } from "@/i18n";
import type { Task } from "@/modules/tasks";
import type { Customer360ReadModel } from "../model/customer360ReadModel";
import { CustomerDetailInfoTab } from "./CustomerDetailInfoTab";
import { CustomerOverviewTab } from "./CustomerOverviewTab";
import {
  ContactsTab,
  CustomerActivitiesTab,
  CustomerWorkspace,
  InvoicesTab,
  NotesTab,
  OpportunitiesTab,
  OrdersTab,
  PaymentsTab,
  PurchaseHistoryTab,
  PurchasedProductsTab,
  QuotationsTab,
  ReturnsTab,
  ShippingTab,
  SupportTab,
  TasksTab,
} from "./CustomerDetailSections";
import type { CustomerDetailTab } from "./CustomerDetailTabs";

interface CustomerDetailTabContentProps {
  activeTab: CustomerDetailTab;
  requestedSubTab?: string;
  model: Customer360ReadModel;
  ownerName: string;
  onEditIdentity(): void;
  onCreateOpportunity(): void;
  onCreateCare(): void;
  onCreateTask(): void;
  onCreateQuickNote(): void;
  onCompleteTask(task: Task): void;
  onOpenSource(): void;
  onSelectTab(tab: CustomerDetailTab, subTab?: string): void;
  attachments: RecordAttachmentItem[];
  onUploadAttachment(data: RecordAttachmentUploadData): void;
  onDeleteAttachment(id: string): void;
  onDownloadAttachment(id: string): void;
}

type RelationshipSubTab = "profile" | "people" | "notes";
type SalesSubTab = "opportunities" | "quotations";
type TransactionSubTab =
  | "orders"
  | "invoices"
  | "payments"
  | "shipping"
  | "returns"
  | "products"
  | "history";
type ServiceSubTab = "support";
type WorkSubTab = "tasks" | "activities";

export const CustomerDetailTabContent: React.FC<
  CustomerDetailTabContentProps
> = ({
  activeTab,
  requestedSubTab,
  model,
  ownerName,
  onEditIdentity,
  onCreateOpportunity,
  onCreateCare,
  onCreateTask,
  onCreateQuickNote,
  onCompleteTask,
  onOpenSource,
  onSelectTab,
  attachments,
  onUploadAttachment,
  onDeleteAttachment,
  onDownloadAttachment,
}) => {
  const navigate = useNavigate();
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const customerId = model.customer.id;
  const [relationshipView, setRelationshipView] =
    React.useState<RelationshipSubTab>("profile");
  const [salesView, setSalesView] = React.useState<SalesSubTab>("opportunities");
  const [transactionView, setTransactionView] =
    React.useState<TransactionSubTab>("orders");
  const [serviceView, setServiceView] = React.useState<ServiceSubTab>("support");
  const [workView, setWorkView] = React.useState<WorkSubTab>("tasks");

  React.useEffect(() => {
    if (!requestedSubTab) return;
    if (
      activeTab === "relationship" &&
      ["profile", "people", "contacts", "notes"].includes(requestedSubTab)
    ) {
      setRelationshipView((requestedSubTab === "contacts" ? "people" : requestedSubTab) as RelationshipSubTab);
    }
    if (
      activeTab === "sales" &&
      ["opportunities", "quotations"].includes(requestedSubTab)
    ) {
      setSalesView(requestedSubTab as SalesSubTab);
    }
    if (
      activeTab === "transactions" &&
      ["orders", "invoices", "payments", "shipping", "returns", "products", "history"].includes(
        requestedSubTab,
      )
    ) {
      setTransactionView(requestedSubTab as TransactionSubTab);
    }
    if (
      activeTab === "service" &&
      ["care", "support"].includes(requestedSubTab)
    ) {
      setServiceView("support");
    }
    if (activeTab === "work" && ["tasks", "activities"].includes(requestedSubTab)) {
      setWorkView(requestedSubTab as WorkSubTab);
    }
  }, [activeTab, requestedSubTab]);

  const relationshipContent =
    relationshipView === "profile" ? (
      <CustomerDetailInfoTab
        model={model}
        ownerName={ownerName}
        isVi={isVi}
        onEdit={onEditIdentity}
        onOpenSource={onOpenSource}
      />
    ) : relationshipView === "people" ? (
      <ContactsTab
        model={model}
        isVi={isVi}
        onOpenContact={(id) => navigate(`/contacts/${id}`)}
        onManageSource={onOpenSource}
      />
    ) : (
      <NotesTab
        model={model}
        isVi={isVi}
        onCreateNote={onCreateQuickNote}
        onOpenSource={onOpenSource}
      />
    );

  const salesContent =
    salesView === "opportunities" ? (
      <OpportunitiesTab
        model={model}
        isVi={isVi}
        onOpen={(id) => navigate(`/deals/${id}`)}
        onCreateOpportunity={onCreateOpportunity}
        onOpenModule={() => navigate("/deals")}
        onCreateQuote={(dealId) => navigate(`/quotes/new?dealId=${dealId}`)}
      />
    ) : (
      <QuotationsTab
        model={model}
        isVi={isVi}
        onOpen={(id) => navigate(`/quotes/${id}`)}
        onCreate={() => navigate(`/quotes/new?customerId=${customerId}`)}
        onOpenModule={() => navigate("/quotes")}
      />
    );

  const transactionContent = (() => {
    switch (transactionView) {
      case "orders":
        return (
          <OrdersTab
            model={model}
            isVi={isVi}
            onOpen={(id) => navigate(`/orders/${id}`)}
            onCreate={() => navigate(`/orders/new?customerId=${customerId}`)}
            onOpenModule={() => navigate("/orders")}
          />
        );
      case "invoices":
        return (
          <InvoicesTab
            model={model}
            isVi={isVi}
            onOpen={(id) => navigate(`/invoices/${id}`)}
            onCreate={() => navigate(`/invoices/new?customerId=${customerId}`)}
            onOpenModule={() => navigate("/invoices")}
            onOpenReceivable={(id) => navigate(`/receivables/${id}`)}
          />
        );
      case "payments":
        return (
          <PaymentsTab
            model={model}
            isVi={isVi}
            onOpenModule={() => navigate("/payments")}
            onOpenReceivable={(id) => navigate(`/receivables/${id}`)}
          />
        );
      case "shipping":
        return (
          <ShippingTab
            model={model}
            isVi={isVi}
            onOpenShipping={() => navigate("/shipping")}
          />
        );
      case "returns":
        return (
          <ReturnsTab
            model={model}
            isVi={isVi}
            onOpen={(id) => navigate(`/returns/${id}`)}
            onOpenModule={() => navigate("/returns")}
          />
        );
      case "products":
        return (
          <PurchasedProductsTab
            model={model}
            isVi={isVi}
            onCreateOpportunity={onCreateOpportunity}
            onCreateQuote={() => navigate(`/quotes/new?customerId=${customerId}`)}
          />
        );
      case "history":
        return (
          <PurchaseHistoryTab
            model={model}
            isVi={isVi}
            onCreateOrder={() => navigate(`/orders/new?customerId=${customerId}`)}
            onOpenOrder={(id) => navigate(`/orders/${id}`)}
          />
        );
    }
  })();

  const serviceContent = (
    <SupportTab
      model={model}
      isVi={isVi}
      onOpen={(id) => navigate(`/support/cases/${id}`)}
      onCreate={() =>
        navigate(
          `/support/cases/new?customerId=${customerId}&source=customer_360`,
        )
      }
      onOpenModule={() => navigate("/support/cases")}
    />
  );

  const content = (() => {
    switch (activeTab) {
      case "overview":
        return (
          <CustomerOverviewTab
            model={model}
            ownerName={ownerName}
            isVi={isVi}
            onSelectTab={onSelectTab}
            onCreateOpportunity={onCreateOpportunity}
            onCreateTask={onCreateTask}
            onCreateCare={onCreateCare}
            onOpenSource={onOpenSource}
            onOpenContact={(id) => navigate(`/contacts/${id}`)}
            onOpenRecord={(moduleKey, id) => navigate(relationshipRecordPath(moduleKey, id))}
          />
        );
      case "relationship":
        return (
          <CustomerWorkspace
            workspaceKey="relationship"
            activeId={relationshipView}
            onChange={(id) => setRelationshipView(id as RelationshipSubTab)}
            items={[
              { id: "profile", label: relationshipWorkspaceLabel("profile", isVi) },
              {
                id: "people",
                label: relationshipWorkspaceLabel("people", isVi),
                count: model.identity.contacts.length,
              },
              {
                id: "notes",
                label: relationshipWorkspaceLabel("notes", isVi),
                count: model.timeline.filter((item) => item.kind === "NOTE").length,
              },
            ]}
          >
            {relationshipContent}
          </CustomerWorkspace>
        );
      case "sales":
        return (
          <CustomerWorkspace
            workspaceKey="sales"
            activeId={salesView}
            onChange={(id) => setSalesView(id as SalesSubTab)}
            items={[
              {
                id: "opportunities",
                label: relationshipWorkspaceLabel("opportunities", isVi),
                count: model.deals.length,
              },
              {
                id: "quotations",
                label: relationshipWorkspaceLabel("quotations", isVi),
                count: model.quotes.length,
              },
            ]}
          >
            {salesContent}
          </CustomerWorkspace>
        );
      case "transactions":
        return (
          <CustomerWorkspace
            workspaceKey="transactions"
            activeId={transactionView}
            onChange={(id) => setTransactionView(id as TransactionSubTab)}
            items={[
              { id: "orders", label: relationshipWorkspaceLabel("orders", isVi), count: model.orders.length },
              { id: "invoices", label: relationshipWorkspaceLabel("invoices", isVi), count: model.invoices.length },
              {
                id: "payments",
                label: relationshipWorkspaceLabel("payments", isVi),
                count: model.paymentTransactions.length + model.receivables.length,
              },
              {
                id: "shipping",
                label: relationshipWorkspaceLabel("shipping", isVi),
                count: model.shippingBookings.length,
              },
              { id: "returns", label: relationshipWorkspaceLabel("returns", isVi), count: model.returns.length },
              {
                id: "products",
                label: relationshipWorkspaceLabel("products", isVi),
                count: model.productsPurchased.length,
              },
              {
                id: "history",
                label: relationshipWorkspaceLabel("history", isVi),
                count: model.purchaseEvidence.length,
              },
            ]}
          >
            {transactionContent}
          </CustomerWorkspace>
        );
      case "service":
        return (
          <CustomerWorkspace
            workspaceKey="service"
            activeId={serviceView}
            onChange={(id) => setServiceView(id as ServiceSubTab)}
            items={[
              {
                id: "support",
                label: relationshipWorkspaceLabel("support", isVi),
                count: model.supportCases.length,
              },
            ]}
          >
            {serviceContent}
          </CustomerWorkspace>
        );
      case "attachments":
        return (
          <RecordAttachmentsTab
            idPrefix="customer"
            attachments={attachments}
            onUploadAttachment={onUploadAttachment}
            onDeleteAttachment={onDeleteAttachment}
            onDownloadAttachment={onDownloadAttachment}
          />
        );
      case "work":
        return (
          <CustomerWorkspace
            workspaceKey="work"
            activeId={workView}
            onChange={(id) => setWorkView(id as WorkSubTab)}
            items={[
              { id: "tasks", label: relationshipWorkspaceLabel("tasks", isVi), count: model.tasks.length },
              { id: "activities", label: relationshipWorkspaceLabel("activities", isVi), count: model.timeline.length },
            ]}
          >
            {workView === "tasks" ? (
              <TasksTab
                model={model}
                isVi={isVi}
                onCreateTask={onCreateTask}
                onCompleteTask={onCompleteTask}
                onOpenTask={(id) => navigate(`/tasks/${id}`)}
                onOpenModule={() => navigate("/tasks")}
              />
            ) : (
              <CustomerActivitiesTab
                model={model}
                isVi={isVi}
                onOpenRecord={(moduleKey, id) => navigate(relationshipRecordPath(moduleKey, id))}
              />
            )}
          </CustomerWorkspace>
        );
    }
  })();

  return (
    <div className="min-h-[420px]">
      {content}
    </div>
  );
};
