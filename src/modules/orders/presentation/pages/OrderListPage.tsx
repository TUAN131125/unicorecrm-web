import React from "react";
import { useOrderListController, type OrderListPageProps } from "../hooks/useOrderListController";
import { OrderListView } from "../views/OrderListView";

export const OrderListPage: React.FC<OrderListPageProps> = (props) => {
  const controller = useOrderListController(props);
  return <OrderListView controller={controller} />;
};
