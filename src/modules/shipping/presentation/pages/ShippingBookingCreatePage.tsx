import React from "react";
import { ShippingBookingCreateView } from "../create/ShippingBookingCreateView";
import { useShippingBookingCreateController, type ShippingBookingCreatePageProps } from "../create/useShippingBookingCreateController";

export const ShippingBookingCreatePage: React.FC<ShippingBookingCreatePageProps> = (props) => {
  const controller = useShippingBookingCreateController(props);
  return <ShippingBookingCreateView controller={controller} />;
};
