import { useMemo, useState } from "react";
import type { OrderCollection } from "../../application/ports/OrderRepository";
import type { PaymentRepositorySnapshot } from "@/modules/payments";
import { projectPaymentSummaryFromSnapshot } from "@/modules/payments";
import { flattenOrders } from "../../application/queries/orderQueries";

export function useOrderListFilters(orders: OrderCollection, payments: PaymentRepositorySnapshot) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");
  const [filterCustomer, setFilterCustomer] = useState("all");
  const [filterContact, setFilterContact] = useState("all");
  const [filterOwner, setFilterOwner] = useState("all");
  const [filterSourceType, setFilterSourceType] = useState("all");
  const [filterQuoteLinked, setFilterQuoteLinked] = useState("all");
  const [filterDealLinked, setFilterDealLinked] = useState("all");
  const [filterDateStart, setFilterDateStart] = useState("");
  const [filterDateEnd, setFilterDateEnd] = useState("");
  const [filterCompletedStart, setFilterCompletedStart] = useState("");
  const [filterCompletedEnd, setFilterCompletedEnd] = useState("");
  const [filterAmountMin, setFilterAmountMin] = useState("");
  const [filterAmountMax, setFilterAmountMax] = useState("");
  const [filterProduct, setFilterProduct] = useState("all");

  const flatOrders = useMemo(() => flattenOrders(orders), [orders]);

  const allCustomersList = useMemo(() => {
    const names = new Set<string>();
    flatOrders.forEach((order) => { if (order.customerName) names.add(order.customerName); });
    return Array.from(names).sort();
  }, [flatOrders]);

  const allContactsList = useMemo(() => {
    const names = new Set<string>();
    flatOrders.forEach((order) => { if (order.contactName) names.add(order.contactName); });
    return Array.from(names).sort();
  }, [flatOrders]);

  const allOwnersList = useMemo(() => {
    const names = new Set<string>();
    flatOrders.forEach((order) => { if (order.ownerName) names.add(order.ownerName); });
    return Array.from(names).sort();
  }, [flatOrders]);

  const allProductsList = useMemo(() => {
    const names = new Set<string>();
    flatOrders.forEach((order) => {
      (order.items || []).forEach((item) => { if (item.productName) names.add(item.productName); });
    });
    return Array.from(names).sort();
  }, [flatOrders]);

  const filteredOrders = useMemo(() => flatOrders.filter((order) => {
    if (order.archivedAt) return false;
    const keyword = searchTerm.trim().toLowerCase();
    let searchMatch = true;
    if (keyword) {
      const searchableValues = [
        order.orderNumber,
        order.customerName,
        order.contactName,
        order.ownerName,
        order.notes,
        order.sourceQuoteNumber,
        order.sourceDealName,
      ];
      const hasProduct = (order.items || []).some((item) =>
        (item.productName || "").toLowerCase().includes(keyword),
      );
      searchMatch = searchableValues.some((value) => (value || "").toLowerCase().includes(keyword)) || hasProduct;
    }

    const statusMatch = filterStatus === "all" || order.state === filterStatus;
    const paymentState = projectPaymentSummaryFromSnapshot(payments, order.id, order.grandTotal ?? order.totalAmount ?? 0, order.currency ?? "VND").state;
    const paymentMatch = filterPayment === "all" || paymentState === filterPayment;
    const customerFilterMatch = filterCustomer === "all" || order.customerName === filterCustomer;
    const contactFilterMatch = filterContact === "all" || order.contactName === filterContact;
    const ownerFilterMatch = filterOwner === "all" || order.ownerName === filterOwner;

    let sourceTypeMatch = true;
    if (filterSourceType === "direct") sourceTypeMatch = !order.sourceQuoteId && !order.sourceDealId;
    else if (filterSourceType === "quote") sourceTypeMatch = Boolean(order.sourceQuoteId);
    else if (filterSourceType === "opportunity") sourceTypeMatch = Boolean(order.sourceDealId);

    const quoteLinkedMatch = filterQuoteLinked === "all"
      || (filterQuoteLinked === "yes" && Boolean(order.sourceQuoteId))
      || (filterQuoteLinked === "no" && !order.sourceQuoteId);
    const dealLinkedMatch = filterDealLinked === "all"
      || (filterDealLinked === "yes" && Boolean(order.sourceDealId))
      || (filterDealLinked === "no" && !order.sourceDealId);

    const amount = order.grandTotal || order.totalAmount || 0;
    const amountMatch = (!filterAmountMin || amount >= Number.parseFloat(filterAmountMin))
      && (!filterAmountMax || amount <= Number.parseFloat(filterAmountMax));

    const dateMatch = order.orderDate
      ? (!filterDateStart || order.orderDate >= filterDateStart) && (!filterDateEnd || order.orderDate <= filterDateEnd)
      : !filterDateStart && !filterDateEnd;

    const completedMatch = order.completedAt
      ? (!filterCompletedStart || order.completedAt >= filterCompletedStart)
        && (!filterCompletedEnd || order.completedAt <= filterCompletedEnd)
      : !filterCompletedStart && !filterCompletedEnd;

    const productMatch = filterProduct === "all"
      || (order.items || []).some((item) => item.productName === filterProduct);

    return searchMatch && statusMatch && paymentMatch
      && customerFilterMatch && contactFilterMatch && ownerFilterMatch
      && sourceTypeMatch && quoteLinkedMatch && dealLinkedMatch
      && amountMatch && dateMatch && completedMatch && productMatch;
  }), [
    flatOrders,
    searchTerm,
    filterStatus,
    filterPayment,
    filterCustomer,
    filterContact,
    filterOwner,
    filterSourceType,
    filterQuoteLinked,
    filterDealLinked,
    filterAmountMin,
    filterAmountMax,
    filterDateStart,
    filterDateEnd,
    filterCompletedStart,
    filterCompletedEnd,
    filterProduct,
    payments,
  ]);

  const activeFiltersCount = useMemo(() => [
    filterStatus !== "all",
    filterPayment !== "all",
    filterCustomer !== "all",
    filterContact !== "all",
    filterOwner !== "all",
    filterSourceType !== "all",
    filterQuoteLinked !== "all",
    filterDealLinked !== "all",
    Boolean(filterDateStart),
    Boolean(filterDateEnd),
    Boolean(filterCompletedStart),
    Boolean(filterCompletedEnd),
    Boolean(filterAmountMin),
    Boolean(filterAmountMax),
    filterProduct !== "all",
  ].filter(Boolean).length, [
    filterStatus,
    filterPayment,
    filterCustomer,
    filterContact,
    filterOwner,
    filterSourceType,
    filterQuoteLinked,
    filterDealLinked,
    filterDateStart,
    filterDateEnd,
    filterCompletedStart,
    filterCompletedEnd,
    filterAmountMin,
    filterAmountMax,
    filterProduct,
    payments,
  ]);

  const resetFilters = () => {
    setFilterStatus("all");
    setFilterPayment("all");
    setFilterCustomer("all");
    setFilterContact("all");
    setFilterOwner("all");
    setFilterSourceType("all");
    setFilterQuoteLinked("all");
    setFilterDealLinked("all");
    setFilterDateStart("");
    setFilterDateEnd("");
    setFilterCompletedStart("");
    setFilterCompletedEnd("");
    setFilterAmountMin("");
    setFilterAmountMax("");
    setFilterProduct("all");
    setSearchTerm("");
  };

  return {
    searchTerm, setSearchTerm,
    filterStatus, setFilterStatus,
    filterPayment, setFilterPayment,
    filterCustomer, setFilterCustomer,
    filterContact, setFilterContact,
    filterOwner, setFilterOwner,
    filterSourceType, setFilterSourceType,
    filterQuoteLinked, setFilterQuoteLinked,
    filterDealLinked, setFilterDealLinked,
    filterDateStart, setFilterDateStart,
    filterDateEnd, setFilterDateEnd,
    filterCompletedStart, setFilterCompletedStart,
    filterCompletedEnd, setFilterCompletedEnd,
    filterAmountMin, setFilterAmountMin,
    filterAmountMax, setFilterAmountMax,
    filterProduct, setFilterProduct,
    flatOrders,
    filteredOrders,
    activeFiltersCount,
    allCustomersList,
    allContactsList,
    allOwnersList,
    allProductsList,
    resetFilters,
  };
}
