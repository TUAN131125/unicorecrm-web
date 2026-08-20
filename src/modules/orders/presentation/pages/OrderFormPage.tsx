import React from "react";
import { useOrderFormController, type OrderFormPageProps } from "../hooks/useOrderFormController";
import { OrderFormView } from "../views/OrderFormView";

export const OrderFormPage: React.FC<OrderFormPageProps> = (props) => {
  const controller = useOrderFormController(props);
  return <OrderFormView controller={controller} />;
};
