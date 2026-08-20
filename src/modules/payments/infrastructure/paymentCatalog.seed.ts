import type { PaymentMethodCatalogItem, PaymentProviderCatalogItem } from "../domain/model/paymentCollection.types";

export const PAYMENT_METHOD_CATALOG: PaymentMethodCatalogItem[] = [
  { code: "bank-transfer", kind: "BANK_TRANSFER", displayNameVi: "Chuyển khoản ngân hàng", displayNameEn: "Bank transfer", enabled: true, channels: ["BANK", "OFFLINE"], supportedCurrencies: ["VND", "USD"], supportsIntent: false, supportsManualRecording: true, supportsRefund: true, supportsReconciliation: true, requiresReference: true, requiresEvidence: false, displayOrder: 10, availability: "ACTIVE" },
  { code: "gateway-card", kind: "CARD", displayNameVi: "Thẻ qua cổng thanh toán", displayNameEn: "Online card", enabled: true, channels: ["ONLINE_GATEWAY"], supportedCurrencies: ["VND", "USD"], providerCodes: ["development-gateway"], supportsIntent: true, supportsManualRecording: false, supportsRefund: true, supportsReconciliation: true, requiresReference: true, requiresEvidence: false, displayOrder: 50, availability: "ACTIVE" },
  { code: "gateway-wallet", kind: "E_WALLET", displayNameVi: "Ví điện tử", displayNameEn: "E-wallet", enabled: true, channels: ["ONLINE_GATEWAY"], supportedCurrencies: ["VND"], providerCodes: ["development-gateway"], supportsIntent: true, supportsManualRecording: false, supportsRefund: true, supportsReconciliation: true, requiresReference: true, requiresEvidence: false, displayOrder: 50, availability: "ACTIVE" },
  { code: "cash", kind: "CASH", displayNameVi: "Tiền mặt", displayNameEn: "Cash", enabled: true, channels: ["OFFLINE", "POS"], supportedCurrencies: ["VND", "USD"], supportsIntent: false, supportsManualRecording: true, supportsRefund: true, supportsReconciliation: true, requiresReference: true, requiresEvidence: false, displayOrder: 10, availability: "ACTIVE" },
  { code: "carrier-cod", kind: "COD", displayNameVi: "Thu hộ khi giao hàng", displayNameEn: "Cash on delivery", enabled: true, channels: ["CARRIER"], supportedCurrencies: ["VND"], providerCodes: ["manual-carrier"], requiresPhysicalShipping: true, supportsIntent: false, supportsManualRecording: true, supportsRefund: true, supportsReconciliation: true, requiresReference: true, requiresEvidence: false, displayOrder: 10, availability: "ACTIVE" },
];

export const PAYMENT_PROVIDER_CATALOG: PaymentProviderCatalogItem[] = [
  { code: "development-gateway", displayName: "Development Checkout", enabled: true, channel: "ONLINE_GATEWAY", supportedMethodCodes: ["gateway-card", "gateway-wallet"], supportedCurrencies: ["VND", "USD"], checkoutOrigins: ["https://checkout.example.invalid"] },
  { code: "manual-carrier", displayName: "Manual carrier evidence", enabled: true, channel: "CARRIER", supportedMethodCodes: ["carrier-cod"], supportedCurrencies: ["VND"] },
];
