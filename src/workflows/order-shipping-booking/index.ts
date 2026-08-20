import { assertOrderFulfillmentPrerequisites, getOrderSnapshot, orderRequiresShipping, resolveOrderLineFulfillmentKind, OrderState } from "@/modules/orders";
import { evaluatePaymentFulfillmentGateForOrder, getCodCollectibleFromActivePlanSnapshot, getCodCollectibleAmountForOrderSnapshot } from "@/modules/payments";
import { createShippingBookingCommandBoundary, getShippingApiRuntime, type RecipientSnapshot, type ShippingBooking, type ShippingPackageSnapshot, type ShippingTransportMode } from "@/modules/shipping";
import { money } from "@/shared/money";
import { createMutationMetadata, executeMutationCommand } from "@/shared/application";

export interface CreateOrderOutboundShippingBookingInput {
  orderId: string;
  id: string;
  code: string;
  providerId: string;
  serviceCode?: string;
  serviceName?: string;
  pickupLocationSnapshot: ShippingBooking["pickupLocationSnapshot"];
  returnLocationSnapshot?: ShippingBooking["returnLocationSnapshot"];
  packageSnapshot: ShippingPackageSnapshot;
  recipientSnapshot?: RecipientSnapshot;
  transportMode?: ShippingTransportMode;
  shipmentGroupId?: string;
  idempotencyKey: string;
  correlationId: string;
  actorId: string;
  actorName?: string;
  now?: string;
}

export async function createOrderOutboundShippingBooking(input: CreateOrderOutboundShippingBookingInput) {
  const order = getOrderSnapshot(input.orderId);
  if (!order) throw new Error(`Order ${input.orderId} not found.`);
  const expectedVersion = order.resourceVersion ?? (getShippingApiRuntime().mode === "demo" ? 1 : undefined);
  if (expectedVersion === undefined) throw new Error(`ORDER_RESOURCE_VERSION_REQUIRED:${input.orderId}:shipping.create-order-outbound`);
  const outcome = await executeMutationCommand(
    {
      commandType: "shipping.create-order-outbound",
      aggregateType: "order",
      aggregateId: input.orderId,
      payload: input,
    },
    createMutationMetadata(`shipping.create-order-outbound:${input.orderId}`, {
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      expectedVersion,
      actor: { id: input.actorId, name: input.actorName },
    }),
    () => createOrderOutboundShippingBookingDemo(input),
  );
  return outcome.data;
}

async function createOrderOutboundShippingBookingDemo(input: CreateOrderOutboundShippingBookingInput) {
  const order = getOrderSnapshot(input.orderId);
  if (!order) throw new Error(`Order ${input.orderId} not found.`);
  if (order.state !== OrderState.CONFIRMED) throw new Error("Chỉ có thể tạo vận đơn từ Order CONFIRMED.");
  if (!orderRequiresShipping(order)) throw new Error("Order không có dòng hàng vật lý nên không cần tạo vận đơn.");
  assertOrderFulfillmentPrerequisites(order);
  const paymentReadiness = evaluatePaymentFulfillmentGateForOrder(order.id, "BEFORE_BOOKING");
  if (!paymentReadiness.ready) throw new Error(`Payment chưa đủ điều kiện booking: ${paymentReadiness.blockers.join(" ")}`);

  const activePlanCod = getCodCollectibleFromActivePlanSnapshot(order.id);
  const codCollectible = activePlanCod ? Number(activePlanCod.amount) : getCodCollectibleAmountForOrderSnapshot(order.id);
  const lineAllocations = input.packageSnapshot.lineAllocations?.length ? input.packageSnapshot.lineAllocations : order.items
    .filter((item) => resolveOrderLineFulfillmentKind(item) === "PHYSICAL_SHIPMENT" || (!item.fulfillmentKind && resolveOrderLineFulfillmentKind(item) === "NONE"))
    .map((item) => ({
    orderLineId: item.id,
    productId: item.productId,
    skuSnapshot: item.skuSnapshot,
    productNameSnapshot: item.productNameSnapshot,
    quantity: item.quantity,
    declaredValue: money(String(item.lineTotal), order.currency ?? "VND"),
    }));
  const shipmentGroupId = input.shipmentGroupId?.trim() || `shipment:${order.id}:${input.id}`;
  return (await createShippingBookingCommandBoundary({
    id: input.id,
    code: input.code,
    sourceType: "ORDER",
    sourceId: order.id,
    purpose: "ORDER_OUTBOUND",
    transportMode: input.transportMode ?? input.packageSnapshot.transportMode ?? "DOMESTIC",
    providerId: input.providerId,
    serviceCode: input.serviceCode,
    serviceName: input.serviceName,
    pickupLocationSnapshot: input.pickupLocationSnapshot,
    returnLocationSnapshot: input.returnLocationSnapshot ?? input.pickupLocationSnapshot,
    recipientSnapshot: input.recipientSnapshot ?? {
      name: order.recipientName ?? "",
      phone: order.recipientPhone ?? "",
      address: order.shippingAddress ?? { line1: "", city: "" },
    },
    packageSnapshot: {
      ...input.packageSnapshot,
      lineAllocations,
      declaredValue: input.packageSnapshot.declaredValue ?? money(String(order.grandTotal ?? order.totalAmount), order.currency ?? "VND"),
      feePayer: input.packageSnapshot.feePayer ?? "SENDER",
      inspectionPolicy: input.packageSnapshot.inspectionPolicy ?? "VIEW_ONLY",
    },
    codAmount: codCollectible > 0 ? money(String(codCollectible), order.currency ?? "VND") : undefined,
    shipmentGroupId,
    idempotencyKey: input.idempotencyKey,
    correlationId: input.correlationId,
    actorId: input.actorId,
    actorName: input.actorName,
    now: input.now,
  })).data;
}
