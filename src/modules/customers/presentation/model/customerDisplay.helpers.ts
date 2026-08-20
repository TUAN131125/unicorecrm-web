import type { CustomerDisplay } from "./customerDisplay.types";

export const getCustomerDisplayName = (customer?: {
  displayName?: string;
  fullName?: string;
  individualName?: string;
}) => customer?.displayName || customer?.fullName || customer?.individualName || "";

export const getCustomerInitial = (customer?: CustomerDisplay): string => {
  const name = getCustomerDisplayName(customer);
  return name ? name.trim().slice(0, 1).toUpperCase() : "";
};

export const getCustomerSecondaryInfo = (
  customer?: CustomerDisplay,
  notAvailableLabel = "-",
): string => {
  if (!customer) return "";
  if (customer.type === "COMPANY") {
    return [customer.industry, customer.segment, customer.address]
      .filter(Boolean)
      .join(" • ") || notAvailableLabel;
  }
  return [customer.email, customer.phone, customer.segment]
    .filter(Boolean)
    .join(" • ") || notAvailableLabel;
};
