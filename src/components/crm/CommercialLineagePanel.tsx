import React from "react";
import { ChevronRight, Network } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toWorkspacePath } from "@/platform/navigation";
import { findCustomerByRelationshipRefSnapshot } from "@/modules/customers";
import { getContactSnapshot } from "@/modules/contacts";
import { getDealSnapshot } from "@/modules/deals";
import { getLeadSnapshot } from "@/modules/leads";
import { getOrganizationAccountSnapshot } from "@/modules/organizations";
import { getOrderListSnapshot, getOrderSnapshot } from "@/modules/orders";
import { getPaymentsSnapshot } from "@/modules/payments";
import { getQuoteSnapshot, getQuotesSnapshot } from "@/modules/quotes";
import { getShippingBookingSnapshot, getShippingSnapshot } from "@/modules/shipping";
import { useEffectiveAccess } from "@/platform/access-control";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";

type LineageAnchor = "DEAL" | "QUOTE" | "ORDER" | "PAYMENT" | "SHIPPING";

interface CommercialLineagePanelProps {
  anchorType: LineageAnchor;
  anchorId: string;
  locale?: "vi" | "en";
}

interface LineageNode {
  key: string;
  moduleKey: string;
  path: string;
  typeVi: string;
  typeEn: string;
  label: string;
  record: unknown;
}

export const CommercialLineagePanel: React.FC<CommercialLineagePanelProps> = ({ anchorType, anchorId, locale = "vi" }) => {
  const navigate = useNavigate();
  const workspace = useWorkspaceContextSnapshot();
  const access = useEffectiveAccess();

  const nodes = React.useMemo(() => {
    let payment = anchorType === "PAYMENT" ? getPaymentsSnapshot().transactions.find((item) => item.id === anchorId) : undefined;
    let shipping = anchorType === "SHIPPING" ? getShippingBookingSnapshot(anchorId) : undefined;
    let order = anchorType === "ORDER" ? getOrderSnapshot(anchorId) : undefined;
    let quote = anchorType === "QUOTE" ? getQuoteSnapshot(anchorId) : undefined;
    let deal = anchorType === "DEAL" ? getDealSnapshot(anchorId) : undefined;

    if (!order && payment) order = getOrderSnapshot(payment.orderId);
    if (!order && shipping?.sourceType === "ORDER") order = getOrderSnapshot(shipping.sourceId);
    if (!quote && order?.sourceQuoteId) quote = getQuoteSnapshot(order.sourceQuoteId);
    if (!deal && order?.sourceDealId) deal = getDealSnapshot(order.sourceDealId);
    if (!deal && quote) deal = getDealSnapshot(quote.sourceDealId || quote.dealId || "");
    if (!quote && deal) quote = getQuotesSnapshot().find((item) => (item.sourceDealId || item.dealId) === deal?.id);
    if (!order && quote) order = getOrderListSnapshot().find((item) => item.sourceQuoteId === quote?.id);
    if (!order && deal) order = getOrderListSnapshot().find((item) => item.sourceDealId === deal?.id);
    if (!payment && order) payment = getPaymentsSnapshot().transactions.find((item) => item.orderId === order?.id);
    if (!shipping && order) shipping = getShippingSnapshot().find((item) => item.sourceType === "ORDER" && item.sourceId === order?.id);

    const leadId = deal?.leadId || quote?.leadId || order?.sourceLeadId;
    const lead = leadId ? getLeadSnapshot(leadId) : undefined;
    const buyerRef = order?.buyerRef || quote?.buyerRef || deal?.buyerRef;
    const contact = deal?.contactId
      ? getContactSnapshot(deal.contactId)
      : buyerRef?.type === "CONTACT" ? getContactSnapshot(buyerRef.id) : undefined;
    const organization = buyerRef?.type === "ORGANIZATION_ACCOUNT"
      ? getOrganizationAccountSnapshot(buyerRef.id)
      : contact?.organizationAccountId ? getOrganizationAccountSnapshot(contact.organizationAccountId) : undefined;
    const customer = buyerRef ? findCustomerByRelationshipRefSnapshot(buyerRef) : undefined;

    const result: LineageNode[] = [];
    const add = (node: LineageNode | undefined) => {
      if (node && access.canAccessRecord(node.moduleKey, node.record) && !result.some((item) => item.key === node.key)) result.push(node);
    };
    if (lead) add({ key: `lead:${lead.id}`, moduleKey: "leads", path: `leads/${lead.id}`, typeVi: "Lead", typeEn: "Lead", label: lead.name || lead.id, record: lead });
    if (organization) add({ key: `organization:${organization.id}`, moduleKey: "organizations", path: `organizations/${organization.id}`, typeVi: "Tổ chức", typeEn: "Organization", label: organization.displayName, record: organization });
    if (contact) add({ key: `contact:${contact.id}`, moduleKey: "contacts", path: `contacts/${contact.id}`, typeVi: "Liên hệ", typeEn: "Contact", label: contact.fullName || contact.name, record: contact });
    if (customer) add({ key: `customer:${customer.id}`, moduleKey: "customers", path: `customers/${customer.id}`, typeVi: "Customer 360", typeEn: "Customer 360", label: customer.customerCode, record: customer });
    if (deal) add({ key: `deal:${deal.id}`, moduleKey: "deals", path: `deals/${deal.id}`, typeVi: "Cơ hội", typeEn: "Deal", label: deal.name, record: deal });
    if (quote) add({ key: `quote:${quote.id}`, moduleKey: "quotes", path: `quotes/${quote.id}`, typeVi: "Báo giá", typeEn: "Quote", label: quote.quoteNumber, record: quote });
    if (order) add({ key: `order:${order.id}`, moduleKey: "orders", path: `orders/${order.id}`, typeVi: "Đơn hàng", typeEn: "Order", label: order.orderNumber, record: order });
    if (payment) add({ key: `payment:${payment.id}`, moduleKey: "payments", path: `payments/${payment.id}`, typeVi: "Thanh toán", typeEn: "Payment", label: payment.externalReference || payment.id, record: payment });
    if (shipping) add({ key: `shipping:${shipping.id}`, moduleKey: "shipping", path: `shipping/${shipping.id}`, typeVi: "Vận đơn", typeEn: "Shipping", label: shipping.code, record: shipping });
    return result;
  }, [access, anchorId, anchorType]);

  if (nodes.length === 0) return null;

  return (
    <section data-commercial-lineage={anchorType.toLowerCase()} className="rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50/80 to-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-violet-800">
        <Network size={15} />
        {locale === "vi" ? "Chuỗi nguồn thương mại" : "Commercial source lineage"}
      </div>
      <p className="mt-1 text-xs font-medium text-slate-500">
        {locale === "vi" ? "Chọn một bản ghi để mở nguồn hoặc kết quả liên quan." : "Select a record to open its upstream source or downstream result."}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {nodes.map((node, index) => (
          <React.Fragment key={node.key}>
            {index > 0 && <ChevronRight size={14} className="shrink-0 text-violet-300" aria-hidden="true" />}
            <button
              type="button"
              onClick={() => navigate(toWorkspacePath(workspace.workspaceKey, "crm", node.path))}
              className={`min-w-0 rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${node.key === `${anchorType.toLowerCase()}:${anchorId}` ? "border-violet-400 bg-violet-100" : "border-slate-200 bg-white hover:border-violet-300"}`}
            >
              <span className="block text-[9px] font-black uppercase tracking-wider text-violet-600">{locale === "vi" ? node.typeVi : node.typeEn}</span>
              <span className="mt-0.5 block max-w-44 crm-text-wrap text-xs font-bold text-slate-800">{node.label}</span>
            </button>
          </React.Fragment>
        ))}
      </div>
    </section>
  );
};
