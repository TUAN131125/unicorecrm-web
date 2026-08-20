import React from "react";
import { getDealsSnapshot, subscribeToDeals } from "@/modules/deals";
import { getPaymentsSnapshot, subscribeToPayments } from "@/modules/payments";
import { getQuotesSnapshot, subscribeToQuotes } from "@/modules/quotes";
import { getShippingSnapshot, subscribeToShipping } from "@/modules/shipping";
import { useSubscribableSnapshot } from "@/platform/react";
import { OrderListPage as OrderListScreen } from "./presentation/pages/OrderListPage";

export const OrderListRoutePage: React.FC = () => {
  const quotes = useSubscribableSnapshot(getQuotesSnapshot, subscribeToQuotes);
  const deals = useSubscribableSnapshot(getDealsSnapshot, subscribeToDeals);
  const payments = useSubscribableSnapshot(getPaymentsSnapshot, subscribeToPayments);
  const shippingBookings = useSubscribableSnapshot(getShippingSnapshot, subscribeToShipping);

  return (
    <OrderListScreen
      quotes={quotes}
      deals={deals}
      payments={payments}
      shippingBookings={shippingBookings}
    />
  );
};
