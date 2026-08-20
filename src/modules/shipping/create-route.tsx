import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useI18n } from "@/i18n";
import { getContactsSnapshot, subscribeToContacts } from "@/modules/contacts";
import { getCustomerPresentationSnapshot, subscribeToCustomerPresentation } from "@/modules/customers";
import { getOrderListSnapshot, orderRequiresShipping, subscribeToOrderList } from "@/modules/orders";
import { getProductCatalogSnapshot, subscribeToProductCatalog } from "@/modules/products";
import { getPickupLocations } from "./application/composition/shippingApplicationServices";
import { getShippingSnapshot, listShippingProviders, subscribeToShipping } from "./public/api";
import { EFFECTIVE_RECORD_ACCESS_PROFILES, EffectiveRecordAccessBoundary, useEffectiveAccess } from "@/platform/access-control";
import { useSubscribableSnapshot } from "@/platform/react";
import { createOrderOutboundShippingBooking } from "@/workflows/order-shipping-booking";
import { ShippingBookingCreatePage } from "./presentation/pages/ShippingBookingCreatePage";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { toWorkspacePath } from "@/platform/navigation";
import { useWorkspaceContextSnapshot } from "@/platform/workspace-context";

export const ShippingBookingCreateRoutePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { locale } = useI18n();
  const access = useEffectiveAccess();
  const workspace = useWorkspaceContextSnapshot();
  const orders = useSubscribableSnapshot(getOrderListSnapshot, subscribeToOrderList);
  const shipping = useSubscribableSnapshot(getShippingSnapshot, subscribeToShipping);
  const contacts = useSubscribableSnapshot(getContactsSnapshot, subscribeToContacts);
  const customers = useSubscribableSnapshot(getCustomerPresentationSnapshot, subscribeToCustomerPresentation);
  const products = useSubscribableSnapshot(getProductCatalogSnapshot, subscribeToProductCatalog);
  const requestedOrderId = searchParams.get("orderId") || undefined;
  const visibleOrders = React.useMemo(
    () => orders.filter((order) => access.canAccessRecord("orders", order)),
    [access, orders],
  );
  const confirmedOrders = React.useMemo(
    () => visibleOrders.filter((order) => order.state === "CONFIRMED" && orderRequiresShipping(order)),
    [visibleOrders],
  );
  const pickupLocations = React.useMemo(() => getPickupLocations().filter((item) => item.isActive), [shipping]);
  const providers = React.useMemo(() => listShippingProviders(), [shipping]);
  const requestedOrder = requestedOrderId ? visibleOrders.find((order) => order.id === requestedOrderId) : undefined;
  const initialOrderIssue = !requestedOrderId
    ? undefined
    : !requestedOrder
      ? "ORDER_NOT_FOUND" as const
      : requestedOrder.state !== "CONFIRMED"
        ? "ORDER_NOT_CONFIRMED" as const
        : !orderRequiresShipping(requestedOrder)
          ? "NO_PHYSICAL_LINES" as const
          : undefined;

  return (
    <EffectiveRecordAccessBoundary
      resourceKey="shipping"
      requiredCommand="shipping.create"
      {...EFFECTIVE_RECORD_ACCESS_PROFILES.shipping}
    >
      <ShippingBookingCreatePage
      initialOrderId={requestedOrderId}
      initialOrderIssue={initialOrderIssue}
      confirmedOrders={confirmedOrders}
      pickupLocations={pickupLocations}
      providers={providers}
      existingBookingCount={shipping.length}
      actorId={access.memberId || access.accountId || "current-user"}
      actorName={getAuthSessionSnapshot()?.principal.displayName || access.memberId || access.accountId || access.memberId || access.accountId || "current-user"}
      contacts={contacts}
      customers={customers}
      products={products}
      locale={locale}
      onCancel={() => navigate(toWorkspacePath(workspace.workspaceKey, "crm", "shipping"))}
      onOpenOrder={(orderId) => navigate(toWorkspacePath(workspace.workspaceKey, "crm", `orders/${orderId}/edit`))}
      onCreate={createOrderOutboundShippingBooking}
      onCreated={(booking, message) => navigate(toWorkspacePath(workspace.workspaceKey, "crm", `shipping/${booking.id}`), { state: { message } })}
      />
    </EffectiveRecordAccessBoundary>
  );
};
