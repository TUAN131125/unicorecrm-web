import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CreditCard, FileText, Package, Plus, Save, ShoppingBag, Trash2, Truck, UserRound } from "lucide-react";
import { useI18n } from "@/i18n";
import { relationshipRefKey, type BuyerRef } from "@/platform/identity";
import { getPrimaryContactOrganizationRelationship, resolveOrganizationContacts, type Contact } from "@/modules/contacts";
import type { Deal } from "@/modules/deals";
import type { Quote } from "@/modules/quotes";

import { Button, Checkbox, Input, PageHeader, SearchableSelect, SectionHeader, Select, Textarea } from "@/shared/components/ui";
import { FieldHelp } from "@/guidance";
import { ProductPickerModal, type SelectedPickerItem } from "@/modules/products";
import {
  getPaymentObligationsForOrderSnapshot,
  getPaymentMethodCatalogSnapshot,
  type PaymentTiming,
} from "@/modules/payments";
import { findCustomerByRelationshipRefSnapshot, getCustomerSnapshot, getCustomersSnapshot } from "@/modules/customers";
import { getOrganizationAccountSnapshot, getOrganizationAccountsSnapshot } from "@/modules/organizations";
import { getAuthSessionSnapshot } from "@/platform/identity-auth";
import { listWorkspaceMemberDirectory, resolveWorkspaceMemberName } from "@/platform/member-directory";
import { useEffectiveAccess } from "@/platform/access-control";
import { createCreateCommandTarget, createProvisionalDocumentNumber } from "@/shared/ids";
import { normalizeApplicationError } from "@/shared/domain";
import { presentApplicationError } from "@/shared/operations";
import { getPaymentConfigurationSnapshot, subscribeToPaymentConfiguration } from "@/modules/payments";
import { useSubscribableSnapshot } from "@/platform/react";
import { executeOrderDraftCreationCommand, executeOrderDraftUpdateCommand, type OrderCreationPaymentLine } from "@/workflows/order-creation";
import type { CustomerOrder, OrderAdjustment, OrderItem } from "../../domain/model/order.types";
import { calculateOrderPricing, normalizeOrderItem } from "../../domain/rules/orderCalculations";
import { assertOrderCommercialMutationAllowed } from "../../domain/rules/orderCommercialIntegrity";
import { normalizeSourceLineItemToOrderItem, resolveOrderSourceFromQuote } from "../../application/queries/orderQueries";
import { OrderLineItemsEditor } from "../components/OrderLineItemsEditor";
import { OrderStatusBadge } from "../components/OrderStatusBadge";
import { getOrderFulfillmentFieldErrors, orderRequiresShipping, resolveOrderLineFulfillmentKind } from "../../domain/rules/orderFulfillment";
import { useCustomerSnapshots } from "../hooks/useCustomerSnapshots";
import { useOrders } from "../hooks/useOrders";
import { getQuoteConversionIssues } from "@/modules/quotes";
import { getDealStagesSnapshot, isLostStage } from "@/modules/deals";
import { registerUnsavedWork } from "@/platform/unsaved-work";
import { useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import {
  buildOrderPaymentAgreement,
  contactName,
  customerName,
  localizedPaymentLabel,
  nextOrderFormId,
  ORDER_COMMERCIAL_IMMUTABLE_ERROR,
  PAYMENT_GATE_LABELS,
  PAYMENT_GATES,
  PAYMENT_PLAN_TYPE_LABELS,
  PAYMENT_PLAN_TYPES,
  PAYMENT_PURPOSE_LABELS,
  PAYMENT_PURPOSES,
  PAYMENT_TERM_LABELS,
  PAYMENT_TERMS,
  PAYMENT_TIMING_LABELS,
  PAYMENT_TIMINGS,
  recipientPrefill,
  type DraftPaymentLine,
  type RecipientPrefill,
} from "../model/orderFormSupport";


export interface OrderFormPageProps {
  contacts: Contact[];
  quotes?: Quote[];
  deals?: Deal[];
  products?: any[];
}

export function useOrderFormController(props: OrderFormPageProps) {
  const { contacts, quotes = [], deals = [], products = [] } = props;
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const access = useEffectiveAccess();
  const workspaceConfiguration = useWorkspaceOperationalConfiguration();
  const baseCurrency = workspaceConfiguration.localeRegion.currencies.baseCurrency;
  const paymentConfiguration = useSubscribableSnapshot(getPaymentConfigurationSnapshot, subscribeToPaymentConfiguration);
  const activeReceivingAccounts = useMemo(
    () => paymentConfiguration.receivingAccounts.filter((account) => account.active),
    [paymentConfiguration.receivingAccounts],
  );
  const session = getAuthSessionSnapshot();
  const actorId = session?.principal.memberId || access.memberId || access.accountId || "current-user";
  const resolvedActorName = resolveWorkspaceMemberName(actorId);
  const actorName = session?.principal.displayName || (resolvedActorName !== "—" ? resolvedActorName : actorId);
  const memberDirectory = useMemo(() => listWorkspaceMemberDirectory(), [access.workspaceId]);
  const canAssignOwner = access.canPerform("orders", "update");
  const { orders } = useOrders();
  const customers = useCustomerSnapshots();
  const customerRecords = useMemo(() => getCustomersSnapshot(), [customers.length]);
  const organizations = useMemo(() => getOrganizationAccountsSnapshot(), []);
  const isEditMode = Boolean(orderId);
  const organizationIdParam = searchParams.get("organizationId") || "";
  const duplicateIdParam = searchParams.get("duplicateId") || "";

  const orderToEdit = useMemo(() => {
    if (!orderId) return undefined;
    return Object.values(orders).flat().find((order) => order.id === orderId);
  }, [orderId, orders]);

  const [customerId, setCustomerId] = useState("");
  const [contactId, setContactId] = useState("");
  const [buyerRef, setBuyerRef] = useState<BuyerRef | null>(null);
  const [buyerDisplayName, setBuyerDisplayName] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [ownerId, setOwnerId] = useState(actorId);
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [shippingAddressLine1, setShippingAddressLine1] = useState("");
  const [shippingAddressLine2, setShippingAddressLine2] = useState("");
  const [shippingWard, setShippingWard] = useState("");
  const [shippingDistrict, setShippingDistrict] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingPostalCode, setShippingPostalCode] = useState("");
  const [sourceQuoteId, setSourceQuoteId] = useState<string>();
  const [sourceQuoteNumber, setSourceQuoteNumber] = useState<string>();
  const [sourceDealId, setSourceDealId] = useState<string>();
  const [sourceDealName, setSourceDealName] = useState<string>();
  const [currency, setCurrency] = useState(baseCurrency);
  const [orderAdjustments, setOrderAdjustments] = useState<OrderAdjustment[]>([]);
  const [sourceValidationError, setSourceValidationError] = useState<string | null>(null);
  const [paymentLines, setPaymentLines] = useState<DraftPaymentLine[]>([
    { localId: nextOrderFormId("payment"), label: locale === "vi" ? "Thanh toán đơn hàng" : "Order payment", term: "PREPAID", method: "BANK_TRANSFER", planType: "FULL_PAYMENT", purpose: "FULL", timing: "PREPAID", fulfillmentGate: "BEFORE_COMPLETION", amountDue: 0, dueDate: "" },
  ]);
  const [paymentAccountId, setPaymentAccountId] = useState(
    () => activeReceivingAccounts.find((account) => account.isDefaultForCurrency)?.id ?? activeReceivingAccounts[0]?.id ?? "",
  );
  const [selectedPaymentTemplateId, setSelectedPaymentTemplateId] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const orderIdRef = useRef(orderToEdit?.id ?? nextOrderFormId("ord"));
  const initializedPrefillKeyRef = useRef<string | null>(null);
  const paymentPlanTouchedRef = useRef(false);
  const validationSummaryRef = useRef<HTMLParagraphElement>(null);
  const saveHandlerRef = useRef<() => Promise<boolean>>(async () => false);
  const pendingSaveResolverRef = useRef<((success: boolean) => void) | null>(null);
  const suppressNavigateAfterSaveRef = useRef(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const baselineFingerprintRef = useRef<string | null>(null);
  const [draftCommitted, setDraftCommitted] = useState(false);


  const existingLinkedOrder = useMemo(() => {
    if (isEditMode) return null;
    const quoteId = searchParams.get("quoteId");
    const dealId = searchParams.get("dealId");
    if (!quoteId && !dealId) return null;
    return Object.values(orders).flat().find((order) =>
      (quoteId && order.sourceQuoteId === quoteId) ||
      (dealId && (order.sourceDealId === dealId || (order as any).dealId === dealId || (order as any).sourceOpportunityId === dealId || (order as any).opportunityId === dealId)),
    ) ?? null;
  }, [isEditMode, orders, searchParams]);

  const buyerOptions = useMemo(() => {
    const options = new Map<string, { value: string; label: string; description?: string; keywords?: string }>();
    customerRecords.forEach((customer) => {
      const display = customers.find((item) => item.id === customer.id);
      const value = relationshipRefKey(customer.relationshipRef);
      options.set(value, { value, label: customerName(display) || customer.customerCode, description: display?.customerCode || display?.email || display?.phone || customer.id, keywords: `${display?.customerCode || ""} ${display?.email || ""} ${display?.phone || ""}` });
    });
    contacts.forEach((contact) => {
      const primaryOrganizationId = getPrimaryContactOrganizationRelationship(contact)?.organizationAccountId;
      const ref: BuyerRef = primaryOrganizationId ? { type: "ORGANIZATION_ACCOUNT", id: primaryOrganizationId } : { type: "CONTACT", id: contact.id };
      const value = relationshipRefKey(ref);
      if (!options.has(value)) options.set(value, { value, label: contactName(contact), description: contact.email || contact.phone || contact.id, keywords: `${contact.email || ""} ${contact.phone || ""}` });
    });
    organizations.forEach((organization) => {
      const value = relationshipRefKey({ type: "ORGANIZATION_ACCOUNT", id: organization.id });
      if (!options.has(value)) options.set(value, { value, label: organization.displayName, description: organization.email || organization.phone || organization.id, keywords: `${organization.legalName || ""} ${organization.email || ""} ${organization.phone || ""}` });
    });
    return [...options.values()];
  }, [contacts, customerRecords, customers, organizations]);

  const filteredContacts = useMemo(() => {
    if (!buyerRef) return [];
    if (buyerRef.type === "CONTACT") return contacts.filter((contact) => contact.id === buyerRef.id);
    const organization = organizations.find((item) => item.id === buyerRef.id);
    return resolveOrganizationContacts(buyerRef.id, contacts, organization);
  }, [buyerRef, contacts, organizations]);
  const selectedCustomer = useMemo(
    () => customerId ? getCustomerSnapshot(customerId) ?? customers.find((customer) => customer.id === customerId) : undefined,
    [customers, customerId],
  );
  const selectedContact = useMemo(() => contacts.find((contact) => contact.id === contactId), [contacts, contactId]);
  const resolvedOwnerName = resolveWorkspaceMemberName(ownerId);
  const ownerName = resolvedOwnerName !== "—" ? resolvedOwnerName : (ownerId === actorId ? actorName : ownerId);
  const requiresShipping = useMemo(() => orderRequiresShipping({ items } as CustomerOrder), [items]);
  const paymentMethodCatalog = useMemo(
    () => getPaymentMethodCatalogSnapshot({ currency, requiresPhysicalShipping: requiresShipping }).filter((item) => item.enabled),
    [currency, requiresShipping],
  );

  useEffect(() => {
    if (paymentAccountId && activeReceivingAccounts.some((account) => account.id === paymentAccountId && account.currency === currency)) return;
    const eligibleAccounts = activeReceivingAccounts.filter((account) => account.currency === currency);
    setPaymentAccountId(eligibleAccounts.find((account) => account.isDefaultForCurrency)?.id ?? eligibleAccounts[0]?.id ?? "");
  }, [activeReceivingAccounts, currency, paymentAccountId]);

  const selectBuyer = (nextBuyerRef: BuyerRef, displayName?: string) => {
    setBuyerRef(nextBuyerRef);
    const projection = findCustomerByRelationshipRefSnapshot(nextBuyerRef);
    setCustomerId(projection?.id || "");
    setBuyerDisplayName(displayName || (projection ? customerName(projection) : buyerOptions.find((option) => option.value === relationshipRefKey(nextBuyerRef))?.label || nextBuyerRef.id));
    if (nextBuyerRef.type === "CONTACT") setContactId(nextBuyerRef.id);
    else {
      const organization = organizations.find((item) => item.id === nextBuyerRef.id);
      setContactId(organization?.primaryContactId || "");
    }
  };

  const handleBuyerChange = (value: string) => {
    const [type, ...idParts] = value.split(":");
    const id = idParts.join(":");
    if (!id || (type !== "CONTACT" && type !== "ORGANIZATION_ACCOUNT")) return;
    selectBuyer({ type, id }, buyerOptions.find((option) => option.value === value)?.label);
  };

  const applyRecipientPrefill = (prefill: RecipientPrefill) => {
    setRecipientName(prefill.name);
    setRecipientPhone(prefill.phone);
    setRecipientEmail(prefill.email);
    setShippingAddressLine1(prefill.addressLine1);
    setShippingCity(prefill.city);
  };

  const pricing = useMemo(() => calculateOrderPricing(items, orderAdjustments), [items, orderAdjustments]);
  const calculations = useMemo(() => ({
    subtotal: pricing.subtotal,
    discountTotal: pricing.discountTotal,
    taxTotal: pricing.taxTotal,
    grandTotal: pricing.grandTotal,
  }), [pricing]);

  useEffect(() => {
    if (paymentPlanTouchedRef.current || paymentLines.length !== 1) return;
    setPaymentLines((current) => current.map((line) => ({ ...line, amountDue: calculations.grandTotal })));
  }, [calculations.grandTotal, paymentLines.length]);

  const prefillKey = isEditMode ? `edit:${orderId}` : `create:${searchParams.toString()}`;
  useEffect(() => {
    if (initializedPrefillKeyRef.current === prefillKey) return;

    if (isEditMode && orderToEdit) {
      setCustomerId(orderToEdit.customerId || "");
      setContactId(orderToEdit.contactId || "");
      selectBuyer(orderToEdit.buyerRef, orderToEdit.customerName || orderToEdit.contactName);
      setOrderDate(orderToEdit.orderDate || "");
      setExpectedDeliveryDate(orderToEdit.expectedDeliveryDate || "");
      setOwnerId(orderToEdit.ownerId || actorId);
      setNotes(orderToEdit.notes || "");
      setInternalNotes(orderToEdit.internalNotes || "");
      setItems(orderToEdit.items || []);
      setCurrency(orderToEdit.currency || baseCurrency);
      setOrderAdjustments(orderToEdit.adjustments || []);
      setRecipientName(orderToEdit.recipientName || orderToEdit.contactName || orderToEdit.customerName || "");
      setRecipientPhone(orderToEdit.recipientPhone || "");
      setRecipientEmail(orderToEdit.recipientEmail || "");
      setShippingAddressLine1(orderToEdit.shippingAddress?.line1 || "");
      setShippingAddressLine2(orderToEdit.shippingAddress?.line2 || "");
      setShippingWard(orderToEdit.shippingAddress?.ward || "");
      setShippingDistrict(orderToEdit.shippingAddress?.district || "");
      setShippingCity(orderToEdit.shippingAddress?.city || "");
      setShippingPostalCode(orderToEdit.shippingAddress?.postalCode || "");
      setSourceQuoteId(orderToEdit.sourceQuoteId);
      setSourceQuoteNumber(orderToEdit.sourceQuoteNumber);
      setSourceDealId(orderToEdit.sourceDealId);
      setSourceDealName(orderToEdit.sourceDealName);
      setPaymentAccountId(orderToEdit.paymentInstruction?.bankAccount?.sourceAccountId
        ?? activeReceivingAccounts.find((account) => account.currency === orderToEdit.currency && account.isDefaultForCurrency)?.id
        ?? activeReceivingAccounts.find((account) => account.currency === orderToEdit.currency)?.id
        ?? "");
      const legacySchedule = getPaymentObligationsForOrderSnapshot(orderToEdit.id);
      if (legacySchedule.length) {
        paymentPlanTouchedRef.current = true;
        setPaymentLines(legacySchedule.map((line) => ({ localId: line.id, label: line.label || "", term: line.term, method: line.method, planType: line.planType ?? "CUSTOM", purpose: line.purpose ?? "OTHER", timing: line.timing ?? (line.term === "POSTPAID" ? "POSTPAID" : "PREPAID"), fulfillmentGate: line.fulfillmentGate ?? (line.term === "DEPOSIT" ? "BEFORE_BOOKING" : line.term === "PREPAID" ? "BEFORE_COMPLETION" : "NONE"), amountDue: line.amountDue, dueDate: line.dueDate || "" })));
      }
      initializedPrefillKeyRef.current = prefillKey;
      setDraftHydrated(true);
      return;
    }

    const quoteId = searchParams.get("quoteId") || "";
    const dealId = searchParams.get("dealId") || "";
    const customerParam = searchParams.get("customerId") || "";
    const contactParam = searchParams.get("contactId") || "";

    if (duplicateIdParam) {
      const duplicate = Object.values(orders).flat().find((order) => order.id === duplicateIdParam);
      if (duplicate) {
        selectBuyer(duplicate.buyerRef, duplicate.customerName || duplicate.contactName);
        setCustomerId(duplicate.customerId || "");
        setContactId(duplicate.contactId || "");
        setOrderDate(new Date().toISOString().slice(0, 10));
        setExpectedDeliveryDate("");
        setOwnerId(duplicate.ownerId || actorId);
        setNotes(duplicate.notes || "");
        setInternalNotes(duplicate.internalNotes || "");
        setItems((duplicate.items || []).map((item) => ({ ...item, id: nextOrderFormId("item") })));
        setCurrency(duplicate.currency || baseCurrency);
        setOrderAdjustments((duplicate.adjustments || []).map((adjustment) => ({ ...adjustment, id: nextOrderFormId("adjustment") })));
        setRecipientName(duplicate.recipientName || duplicate.contactName || duplicate.customerName || "");
        setRecipientPhone(duplicate.recipientPhone || "");
        setRecipientEmail(duplicate.recipientEmail || "");
        setShippingAddressLine1(duplicate.shippingAddress?.line1 || "");
        setShippingAddressLine2(duplicate.shippingAddress?.line2 || "");
        setShippingWard(duplicate.shippingAddress?.ward || "");
        setShippingDistrict(duplicate.shippingAddress?.district || "");
        setShippingCity(duplicate.shippingAddress?.city || "");
        setShippingPostalCode(duplicate.shippingAddress?.postalCode || "");
        setSourceQuoteId(undefined);
        setSourceQuoteNumber(undefined);
        setSourceDealId(undefined);
        setSourceDealName(undefined);
        setSourceValidationError(null);
        const duplicatedSchedule = getPaymentObligationsForOrderSnapshot(duplicate.id);
        if (duplicatedSchedule.length > 0) {
          paymentPlanTouchedRef.current = true;
          setPaymentLines(duplicatedSchedule.map((line) => ({
            localId: nextOrderFormId("payment"),
            label: line.label || "",
            term: line.term,
            method: line.method,
            planType: line.planType ?? "CUSTOM",
            purpose: line.purpose ?? "OTHER",
            timing: line.timing ?? (line.term === "POSTPAID" ? "POSTPAID" : "PREPAID"),
            fulfillmentGate: line.fulfillmentGate ?? "NONE",
            amountDue: line.amountDue,
            dueDate: "",
          })));
        }
      } else {
        setSourceValidationError(locale === "vi" ? "Không tìm thấy Đơn hàng cần nhân bản." : "The Order to duplicate was not found.");
      }
    } else if (quoteId) {
      const quote = quotes.find((item) => item.id === quoteId);
      if (quote) {
        const sourceDeal = deals.find((item) => item.id === (quote.sourceDealId || quote.dealId));
        const issues = getQuoteConversionIssues(quote).map((issue) => issue.message);
        if (sourceDeal && isLostStage(sourceDeal.stage, getDealStagesSnapshot())) {
          issues.push(locale === "vi"
            ? `Cơ hội ${sourceDeal.name} đã Chốt thua nên không thể tạo Đơn hàng.`
            : `Deal ${sourceDeal.name} is Closed Lost and cannot create an Order.`);
        }
        setSourceValidationError(issues.length > 0 ? issues.join(" ") : null);
        const resolved = resolveOrderSourceFromQuote(quote, deals, customers, contacts);
        setCustomerId(resolved.customerId);
        setContactId(resolved.contactId);
        if (resolved.buyerRef) selectBuyer(resolved.buyerRef, resolved.customerName || resolved.contactName);
        setSourceQuoteId(resolved.sourceQuoteId);
        setSourceQuoteNumber(resolved.sourceQuoteNumber);
        setSourceDealId(resolved.sourceDealId);
        setSourceDealName(resolved.sourceDealName);
        setRecipientName(resolved.contactName || resolved.customerName);
        setRecipientEmail(resolved.recipientEmail || "");
        setRecipientPhone(resolved.recipientPhone || "");
        setShippingAddressLine1(resolved.shippingAddressLine1 || "");
        setCurrency(resolved.currency || baseCurrency);
        setOrderAdjustments(resolved.adjustments || []);
        setNotes(resolved.notes || "");
        setItems(quote.lineItems.map((line) => normalizeSourceLineItemToOrderItem(line, products)));
        setOwnerId(resolved.ownerId || actorId);
      } else {
        setSourceValidationError(locale === "vi" ? "Không tìm thấy Báo giá nguồn." : "Source Quote was not found.");
      }
    } else if (dealId) {
      const deal = deals.find((item) => item.id === dealId);
      if (deal) {
        setSourceValidationError(isLostStage(deal.stage, getDealStagesSnapshot()) ? (locale === "vi"
          ? `Cơ hội ${deal.name} đã Chốt thua nên không thể tạo Đơn hàng.`
          : `Deal ${deal.name} is Closed Lost and cannot create an Order.`) : null);
        setCustomerId(deal.customerId || "");
        setContactId(deal.contactId || "");
        selectBuyer(deal.buyerRef, deal.customerName || deal.contactName || deal.organizationAccountName);
        setOwnerId(deal.ownerId || actorId);
        setSourceDealId(deal.id);
        setSourceDealName(deal.name);
        setCurrency(deal.currency || baseCurrency);
        const dealContact = contacts.find((item) => item.id === deal.contactId);
        const dealCustomer = customers.find((item) => item.id === deal.customerId);
        const dealOrganization = deal.buyerRef.type === "ORGANIZATION_ACCOUNT" ? getOrganizationAccountSnapshot(deal.buyerRef.id) : undefined;
        applyRecipientPrefill(recipientPrefill(dealContact, dealCustomer, dealOrganization));
        setItems((deal.lineItems || []).map((line, index) => ({ ...normalizeSourceLineItemToOrderItem(line, products), id: `${nextOrderFormId("item")}_${index}` })));
      }
    } else {
      const explicitContact = contacts.find((item) => item.id === contactParam);
      if (organizationIdParam) {
        const organization = getOrganizationAccountSnapshot(organizationIdParam);
        if (organization) {
          const projection = findCustomerByRelationshipRefSnapshot({ type: "ORGANIZATION_ACCOUNT", id: organization.id });
          const primaryContact = contacts.find((item) => item.id === (contactParam || organization.primaryContactId));
          selectBuyer({ type: "ORGANIZATION_ACCOUNT", id: organization.id }, organization.displayName);
          setCustomerId(projection?.id || customerParam);
          setContactId(primaryContact?.id || "");
          applyRecipientPrefill(recipientPrefill(primaryContact, customers.find((item) => item.id === projection?.id), organization));
          setOwnerId(organization.ownerId || actorId);
        } else {
          setSourceValidationError(locale === "vi" ? "Không tìm thấy tổ chức nguồn." : "Source organization was not found.");
        }
      } else if (customerParam) {
        const customer = getCustomerSnapshot(customerParam);
        const displayCustomer = customers.find((item) => item.id === customerParam);
        if (customer) selectBuyer(customer.relationshipRef, customerName(displayCustomer));
        let resolvedContact = explicitContact;
        let organization: ReturnType<typeof getOrganizationAccountSnapshot>;
        if (customer?.relationshipRef.type === "CONTACT") {
          resolvedContact = contacts.find((item) => item.id === (contactParam || customer.relationshipRef.id));
        }
        if (customer?.relationshipRef.type === "ORGANIZATION_ACCOUNT") {
          organization = getOrganizationAccountSnapshot(customer.relationshipRef.id);
          resolvedContact = contacts.find((item) => item.id === (contactParam || organization?.primaryContactId));
        }
        setCustomerId(customerParam);
        setContactId(resolvedContact?.id || "");
        applyRecipientPrefill(recipientPrefill(resolvedContact, displayCustomer, organization));
        setOwnerId(displayCustomer?.ownerId || organization?.ownerId || actorId);
      } else if (explicitContact) {
        const relatedCustomer = findCustomerByRelationshipRefSnapshot(explicitContact.organizationAccountId
          ? { type: "ORGANIZATION_ACCOUNT", id: explicitContact.organizationAccountId }
          : { type: "CONTACT", id: explicitContact.id });
        const organization = explicitContact.organizationAccountId ? getOrganizationAccountSnapshot(explicitContact.organizationAccountId) : undefined;
        selectBuyer(organization ? { type: "ORGANIZATION_ACCOUNT", id: organization.id } : { type: "CONTACT", id: explicitContact.id }, organization?.displayName || contactName(explicitContact));
        setCustomerId(relatedCustomer?.id || "");
        setContactId(explicitContact.id);
        applyRecipientPrefill(recipientPrefill(explicitContact, customers.find((item) => item.id === relatedCustomer?.id), organization));
        setOwnerId(explicitContact.ownerId || organization?.ownerId || actorId);
      }
    }

    initializedPrefillKeyRef.current = prefillKey;
    setDraftHydrated(true);
  }, [contacts, customers, deals, duplicateIdParam, isEditMode, locale, orderToEdit, orders, organizationIdParam, prefillKey, products, quotes, searchParams]);

  useEffect(() => {
    if (customerId && contactId && contacts.length > 0 && !filteredContacts.some((contact) => contact.id === contactId)) setContactId("");
  }, [contactId, contacts.length, customerId, filteredContacts]);

  const applyProducts = (selectedItems: SelectedPickerItem[]) => {
    setItems((current) => [...current, ...selectedItems.map((entry) => normalizeOrderItem({
      id: nextOrderFormId("item"),
      productId: entry.product.id,
      skuSnapshot: entry.product.sku || "",
      productNameSnapshot: entry.product.name,
      productTypeSnapshot: entry.product.type || "goods",
      fulfillmentKind: resolveOrderLineFulfillmentKind({ productTypeSnapshot: entry.product.type || "goods" }),
      descriptionSnapshot: entry.product.description || "",
      quantity: entry.quantity || 1,
      unitPriceSnapshot: entry.customPrice ?? Number(entry.product.listPrice || 0),
      discountPercent: entry.discountPercent || 0,
      taxRateSnapshot: entry.product.taxRate ?? 0,
      taxModeSnapshot: entry.product.taxMode ?? "none",
      billingCycleSnapshot: entry.product.billingCycle,
    }))]);
    setIsPickerOpen(false);
  };

  const updateItem = (itemId: string, field: keyof OrderItem, value: any) => {
    setItems((current) => current.map((item) => item.id === itemId
      ? normalizeOrderItem({ ...item, [field]: value })
      : item));
  };

  const updatePaymentLine = (id: string, patch: Partial<DraftPaymentLine>) => {
    paymentPlanTouchedRef.current = true;
    setPaymentLines((current) => current.map((line) => {
      if (line.localId !== id) return line;
      const updated = { ...line, ...patch };
      return patch.method === "COD"
        ? { ...updated, term: "POSTPAID", timing: "ON_DELIVERY", fulfillmentGate: "NONE" }
        : updated;
    }));
  };

  const eligiblePaymentTemplates = useMemo(() => paymentConfiguration.planTemplates.filter((template) => template.enabled
    && template.currency === currency
    && (template.minimumOrderValue == null || calculations.grandTotal >= template.minimumOrderValue)
    && (template.maximumOrderValue == null || calculations.grandTotal <= template.maximumOrderValue)), [calculations.grandTotal, paymentConfiguration.planTemplates, currency]);

  const applyPaymentTemplate = () => {
    const template = eligiblePaymentTemplates.find((item) => item.id === selectedPaymentTemplateId);
    if (!template) return;
    let assigned = 0;
    const next = template.scheduleLines.map((line, index) => {
      const isLast = index === template.scheduleLines.length - 1;
      const amountDue = line.remainder || isLast
        ? Math.max(0, calculations.grandTotal - assigned)
        : Math.round(calculations.grandTotal * Math.max(0, line.percentage ?? 0) / 100);
      assigned += amountDue;
      const methodItem = paymentMethodCatalog.find((method) => line.allowedMethodCodes.includes(method.code)) ?? paymentMethodCatalog[0];
      const method = (methodItem?.kind === "BANK_TRANSFER" || methodItem?.kind === "COD" || methodItem?.kind === "CASH" || methodItem?.kind === "CARD" || methodItem?.kind === "E_WALLET") ? methodItem.kind : "BANK_TRANSFER";
      const timing: PaymentTiming = line.dueRule === "ON_DELIVERY" ? "ON_DELIVERY" : line.dueRule === "NET_DAYS" || line.dueRule === "MILESTONE" ? "POSTPAID" : "PREPAID";
      return {
        localId: nextOrderFormId("payment"),
        label: locale === "vi" ? line.labelVi : line.labelEn,
        term: method === "COD" || timing === "POSTPAID" ? "POSTPAID" : index === 0 && template.scheduleLines.length > 1 ? "DEPOSIT" : "PREPAID",
        method,
        planType: template.scheduleLines.length === 1 ? "FULL_PAYMENT" : template.scheduleLines.length === 2 ? "DEPOSIT_AND_BALANCE" : "INSTALLMENT",
        purpose: template.scheduleLines.length === 1 ? "FULL" : index === 0 ? "DEPOSIT" : isLast ? "BALANCE" : "INSTALLMENT",
        timing,
        fulfillmentGate: method === "COD" ? "NONE" : line.fulfillmentGate === "BEFORE_DISPATCH" ? "BEFORE_BOOKING" : line.fulfillmentGate,
        amountDue,
        dueDate: "",
      } satisfies DraftPaymentLine;
    });
    paymentPlanTouchedRef.current = true;
    setPaymentLines(next);
  };

  const addPaymentInstallment = () => {
    paymentPlanTouchedRef.current = true;
    setPaymentLines((current) => [
      ...current,
      {
        localId: nextOrderFormId("payment"),
        label: locale === "vi" ? `Đợt ${current.length + 1}` : `Installment ${current.length + 1}`,
        term: "POSTPAID",
        method: "BANK_TRANSFER",
        planType: "INSTALLMENT",
        purpose: "INSTALLMENT",
        timing: "POSTPAID",
        fulfillmentGate: "NONE",
        amountDue: 0,
        dueDate: "",
      },
    ]);
  };

  const removePaymentInstallment = (lineId: string) => {
    if (paymentLines.length <= 1) return;
    paymentPlanTouchedRef.current = true;
    setPaymentLines((current) => current.filter((entry) => entry.localId !== lineId));
  };

  const draftFingerprint = useMemo(() => JSON.stringify({
    buyerRef, customerId, contactId, orderDate, expectedDeliveryDate, ownerId, notes, internalNotes,
    items: pricing.items, adjustments: pricing.adjustments, recipientName, recipientPhone, recipientEmail,
    shippingAddressLine1, shippingAddressLine2, shippingWard, shippingDistrict, shippingCity, shippingPostalCode,
    sourceQuoteId, sourceDealId, paymentLines, paymentAccountId, currency,
  }), [buyerRef, contactId, currency, customerId, expectedDeliveryDate, internalNotes, items, notes, orderAdjustments, orderDate, ownerId, paymentAccountId, paymentLines, pricing.adjustments, pricing.items, recipientEmail, recipientName, recipientPhone, shippingAddressLine1, shippingAddressLine2, shippingCity, shippingDistrict, shippingPostalCode, shippingWard, sourceDealId, sourceQuoteId]);

  useEffect(() => {
    if (draftHydrated && baselineFingerprintRef.current === null) baselineFingerprintRef.current = draftFingerprint;
  }, [draftFingerprint, draftHydrated]);

  const hasUnsavedChanges = !isEditMode && draftHydrated && !draftCommitted
    && baselineFingerprintRef.current !== null
    && baselineFingerprintRef.current !== draftFingerprint;

  useEffect(() => registerUnsavedWork({
    id: `order-form:${orderIdRef.current}`,
    title: locale === "vi" ? "Đơn hàng chưa lưu" : "Unsaved Order",
    isDirty: hasUnsavedChanges,
    save: () => saveHandlerRef.current(),
    discard: () => { baselineFingerprintRef.current = draftFingerprint; },
  }), [draftFingerprint, hasUnsavedChanges, locale]);

  useEffect(() => {
    const listener = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [hasUnsavedChanges]);

  const paymentPlanTotal = paymentLines.reduce((sum, line) => sum + Math.max(0, Number(line.amountDue) || 0), 0);
  const codPlanned = paymentLines.some((line) => line.method === "COD" && line.amountDue > 0);

  const resolvePendingSave = (success: boolean): void => {
    const resolver = pendingSaveResolverRef.current;
    pendingSaveResolverRef.current = null;
    suppressNavigateAfterSaveRef.current = false;
    resolver?.(success);
  };

  saveHandlerRef.current = () => new Promise<boolean>((resolve) => {
    if (submitting) {
      resolve(false);
      return;
    }
    const form = document.getElementById("order-create-form");
    if (!(form instanceof HTMLFormElement)) {
      resolve(false);
      return;
    }
    pendingSaveResolverRef.current = resolve;
    suppressNavigateAfterSaveRef.current = true;
    form.requestSubmit();
  });

  const showValidationError = (message: string, targetId?: string): false => {
    resolvePendingSave(false);
    setValidationError(message);
    window.requestAnimationFrame(() => {
      const target = targetId ? document.getElementById(targetId) : validationSummaryRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
    });
    return false;
  };

  const safeOrderSaveError = (error: unknown): string => {
    const applicationError = normalizeApplicationError(error);
    if (applicationError.code === "ORDER_COMMERCIAL_IMMUTABLE") {
      return locale === "vi"
        ? "Nội dung thương mại của Đơn hàng đã xác nhận không thể thay đổi. Hãy hủy Đơn hàng và tạo Đơn thay thế."
        : ORDER_COMMERCIAL_IMMUTABLE_ERROR;
    }
    if (applicationError.code === "DEAL_CLOSED_LOST") {
      const details = applicationError.details && typeof applicationError.details === "object"
        ? applicationError.details as { dealName?: unknown }
        : undefined;
      const dealName = typeof details?.dealName === "string" ? details.dealName : "";
      return locale === "vi"
        ? `Cơ hội ${dealName || "nguồn"} đã Chốt thua nên không thể tạo Đơn hàng.`
        : `The source Deal ${dealName} is Closed Lost and cannot create an Order.`;
    }
    return presentApplicationError(applicationError, {
      locale,
      fallbackMessage: locale === "vi"
        ? "Không thể lưu Đơn hàng. Dữ liệu đang nhập vẫn được giữ; hãy kiểm tra lại và thử lại."
        : "The Order could not be saved. Your entered data is still available; review it and try again.",
    }).message;
  };

  const buildOrder = (): CustomerOrder => {
    const now = new Date().toISOString();
    return {
      id: orderToEdit?.id ?? orderIdRef.current,
      orderNumber: orderToEdit?.orderNumber ?? createProvisionalDocumentNumber("ORD"),
      orderDate,
      expectedDeliveryDate,
      recipientName: recipientName.trim() || undefined,
      recipientPhone: recipientPhone.trim() || undefined,
      recipientEmail: recipientEmail.trim() || undefined,
      shippingAddress: shippingAddressLine1.trim() && shippingCity.trim() ? {
        line1: shippingAddressLine1.trim(),
        line2: shippingAddressLine2.trim() || undefined,
        ward: shippingWard.trim() || undefined,
        district: shippingDistrict.trim() || undefined,
        city: shippingCity.trim(),
        postalCode: shippingPostalCode.trim() || undefined,
        country: "Vietnam",
      } : undefined,
      customerId: customerId || undefined,
      customerName: buyerDisplayName || (selectedCustomer ? customerName(selectedCustomer) : undefined),
      contactId: contactId || undefined,
      contactName: contactName(selectedContact),
      buyerRef: buyerRef!,
      state: orderToEdit?.state ?? "DRAFT",
      confirmedAt: orderToEdit?.confirmedAt,
      items: pricing.items,
      adjustments: pricing.adjustments,
      subtotal: calculations.subtotal,
      discountTotal: calculations.discountTotal,
      taxTotal: calculations.taxTotal,
      grandTotal: calculations.grandTotal,
      totalAmount: calculations.grandTotal,
      currency,
      paymentAgreementSnapshot: quotes.find((quote) => quote.id === sourceQuoteId)?.paymentAgreement
        ?? buildOrderPaymentAgreement(paymentLines, currency, sourceQuoteId),
      ownerId,
      ownerName,
      ownerAssignment: orderToEdit?.ownerId === ownerId && orderToEdit.ownerAssignment
        ? orderToEdit.ownerAssignment
        : { assignedAt: now, assignedBy: actorId },
      notes,
      internalNotes,
      sourceQuoteId,
      sourceQuoteNumber,
      sourceDealId,
      sourceDealName,
      createdAt: orderToEdit?.createdAt ?? now,
      updatedAt: now,
      completedAt: orderToEdit?.completedAt,
      cancelledAt: orderToEdit?.cancelledAt,
      completion: orderToEdit?.completion,
      cancellation: orderToEdit?.cancellation,
    };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) {
      resolvePendingSave(false);
      return;
    }
    setValidationError(null);

    if (existingLinkedOrder) return showValidationError(locale === "vi" ? `Báo giá này đã được chuyển thành đơn ${existingLinkedOrder.orderNumber}.` : `This Quote has already been converted to Order ${existingLinkedOrder.orderNumber}.`, "order-source-context");
    if (sourceValidationError) return showValidationError(sourceValidationError, "order-source-context");
    if (!buyerRef?.id) return showValidationError(locale === "vi" ? "Vui lòng chọn bên mua là cá nhân hoặc tổ chức." : "Select a contact or organization as the buyer.", "order-buyer");
    if (items.length === 0) return showValidationError(locale === "vi" ? "Đơn hàng phải có ít nhất một sản phẩm hoặc dịch vụ." : "Order requires at least one line item.", "order-items");
    if (contactId && !filteredContacts.some((contact) => contact.id === contactId)) return showValidationError(locale === "vi" ? "Liên hệ đã chọn không thuộc bên mua hiện tại." : "The selected contact does not belong to the current buyer.", "order-contact");
    const fulfillmentErrors = getOrderFulfillmentFieldErrors({
      items,
      recipientName,
      recipientPhone,
      recipientEmail,
      shippingAddress: { line1: shippingAddressLine1, city: shippingCity },
    });
    if (Object.keys(fulfillmentErrors).length > 0) {
      const firstField = Object.keys(fulfillmentErrors)[0];
      const targetByField: Record<string, string> = {
        recipientName: "order-recipientName",
        recipientPhone: "order-recipientPhone",
        recipientEmail: "order-recipientEmail",
        "shippingAddress.line1": "order-shippingAddressLine1",
        "shippingAddress.city": "order-shippingCity",
      };
      return showValidationError(locale === "vi"
        ? "Vui lòng bổ sung thông tin giao nhận được đánh dấu bên dưới."
        : "Complete the highlighted delivery fields.", targetByField[firstField] || "order-customer-recipient");
    }
    if (paymentLines.length === 0 || paymentLines.some((line) => line.amountDue <= 0)) return showValidationError(locale === "vi" ? "Kế hoạch thanh toán phải có ít nhất một đợt với số tiền lớn hơn 0." : "Payment plan requires at least one installment with a positive amount.", "order-payment-amount-0");
    if (codPlanned && !requiresShipping) return showValidationError(locale === "vi" ? "COD chỉ áp dụng cho đơn có hàng vật lý cần vận chuyển." : "COD is only available for orders with physical goods that require shipping.", "order-payment-plan");
    if (paymentLines.some((line) => line.method === "COD" && (line.timing !== "ON_DELIVERY" || line.fulfillmentGate !== "NONE"))) return showValidationError(locale === "vi" ? "COD phải được thu khi giao hàng và không được chặn tạo vận đơn hoặc hoàn tất đơn." : "COD must be collected on delivery and must not block shipment booking or order completion.", "order-payment-plan");
    if (Math.abs(paymentPlanTotal - calculations.grandTotal) > 0.01) return showValidationError(locale === "vi" ? "Tổng kế hoạch thanh toán phải bằng tổng giá trị đơn hàng." : "Payment plan total must equal the order total.", "order-payment-plan");

    const order = buildOrder();
    if (orderToEdit) {
      try {
        assertOrderCommercialMutationAllowed(orderToEdit, order);
      } catch (error) {
        return showValidationError(safeOrderSaveError(error));
      }
    }
    const paymentPlan: OrderCreationPaymentLine[] = paymentLines.map((line, index) => ({
      id: orderToEdit ? line.localId : `obl_${order.id}_${index + 1}`,
      label: line.label,
      amountDue: Number(line.amountDue),
      currency: order.currency || baseCurrency,
      method: line.method,
      term: line.term,
      planType: line.planType,
      sequence: index + 1,
      purpose: line.purpose,
      timing: line.timing,
      fulfillmentGate: line.fulfillmentGate,
      dueDate: line.dueDate || undefined,
      idempotencyKey: `order-payment-plan:${order.id}:${line.localId}`,
    }));

    setSubmitting(true);
    try {
      const command = {
        order,
        paymentPlan,
        actorId,
        actorName,
        paymentAccountId,
      };
      const outcome = orderToEdit
        ? await executeOrderDraftUpdateCommand(command)
        : await executeOrderDraftCreationCommand(command);

      baselineFingerprintRef.current = draftFingerprint;
      setDraftCommitted(true);
      const shouldNavigate = !suppressNavigateAfterSaveRef.current;
      resolvePendingSave(true);
      if (shouldNavigate) window.setTimeout(() => navigate(`/orders/${outcome.data.order.id}`), 0);
    } catch (error) {
      showValidationError(safeOrderSaveError(error));
    } finally {
      setSubmitting(false);
    }
  };
  return {
    contacts,
    quotes,
    deals,
    products,
    PAYMENT_TERMS,
    PAYMENT_PLAN_TYPES,
    PAYMENT_PURPOSES,
    PAYMENT_TIMINGS,
    PAYMENT_GATES,
    PAYMENT_PLAN_TYPE_LABELS,
    PAYMENT_PURPOSE_LABELS,
    PAYMENT_TIMING_LABELS,
    PAYMENT_TERM_LABELS,
    PAYMENT_GATE_LABELS,
    localizedPaymentLabel,
    customerName,
    contactName,
    nextId: nextOrderFormId,
    buildOrderPaymentAgreement,
    orderId,
    searchParams,
    navigate,
    t,
    locale,
    access,
    activeReceivingAccounts,
    session,
    actorId,
    resolvedActorName,
    actorName,
    memberDirectory,
    canAssignOwner,
    orders,
    customers,
    customerRecords,
    organizations,
    isEditMode,
    orderToEdit,
    customerId,
    setCustomerId,
    contactId,
    setContactId,
    buyerRef,
    setBuyerRef,
    buyerDisplayName,
    setBuyerDisplayName,
    orderDate,
    setOrderDate,
    expectedDeliveryDate,
    setExpectedDeliveryDate,
    ownerId,
    setOwnerId,
    notes,
    setNotes,
    internalNotes,
    setInternalNotes,
    items,
    setItems,
    recipientName,
    setRecipientName,
    recipientPhone,
    setRecipientPhone,
    recipientEmail,
    setRecipientEmail,
    shippingAddressLine1,
    setShippingAddressLine1,
    shippingAddressLine2,
    setShippingAddressLine2,
    shippingWard,
    setShippingWard,
    shippingDistrict,
    setShippingDistrict,
    shippingCity,
    setShippingCity,
    shippingPostalCode,
    setShippingPostalCode,
    sourceQuoteId,
    setSourceQuoteId,
    sourceQuoteNumber,
    setSourceQuoteNumber,
    sourceDealId,
    setSourceDealId,
    sourceDealName,
    setSourceDealName,
    currency,
    setCurrency,
    orderAdjustments,
    setOrderAdjustments,
    sourceValidationError,
    setSourceValidationError,
    paymentLines,
    setPaymentLines,
    paymentAccountId,
    setPaymentAccountId,
    selectedPaymentTemplateId,
    setSelectedPaymentTemplateId,
    validationError,
    setValidationError,
    submitting,
    setSubmitting,
    isPickerOpen,
    setIsPickerOpen,
    orderIdRef,
    initializedPrefillKeyRef,
    paymentPlanTouchedRef,
    validationSummaryRef,
    saveHandlerRef,
    pendingSaveResolverRef,
    suppressNavigateAfterSaveRef,
    draftHydrated,
    setDraftHydrated,
    baselineFingerprintRef,
    draftCommitted,
    setDraftCommitted,
    existingLinkedOrder,
    buyerOptions,
    filteredContacts,
    selectedCustomer,
    selectedContact,
    resolvedOwnerName,
    ownerName,
    requiresShipping,
    paymentMethodCatalog,
    selectBuyer,
    handleBuyerChange,
    pricing,
    calculations,
    prefillKey,
    applyProducts,
    updateItem,
    updatePaymentLine,
    eligiblePaymentTemplates,
    applyPaymentTemplate,
    addPaymentInstallment,
    removePaymentInstallment,
    draftFingerprint,
    hasUnsavedChanges,
    paymentPlanTotal,
    codPlanned,
    resolvePendingSave,
    showValidationError,
    safeOrderSaveError,
    buildOrder,
    handleSubmit,
  };
}
