import type { PaymentMethodCatalogItem, PaymentMethodKind } from "../../domain/model/paymentCollection.types";
import type { PaymentConfiguration } from "../../domain/model/paymentConfiguration.types";

function getPaymentConfiguration(configuration?: PaymentConfiguration) {
  return configuration;
}

function toKind(category: string): PaymentMethodKind {
  if (["BANK_TRANSFER", "CASH", "CARD", "E_WALLET", "COD", "EXTERNAL_GATEWAY"].includes(category)) return category as PaymentMethodKind;
  return "OTHER";
}

export function getEffectivePaymentMethodCatalog(seed: readonly PaymentMethodCatalogItem[], input?: PaymentConfiguration): PaymentMethodCatalogItem[] {
  const configuration = getPaymentConfiguration(input);
  if (!configuration?.methods.length) return [...structuredClone(seed)].sort((left, right) => left.displayOrder - right.displayOrder || left.code.localeCompare(right.code));
  const seedByCode = new Map(seed.map((item) => [item.code, item]));
  const configured = configuration.methods.map((method): PaymentMethodCatalogItem => {
    const existing = seedByCode.get(method.code);
    return {
      code: method.code,
      kind: toKind(method.category),
      displayNameVi: method.nameVi,
      displayNameEn: method.nameEn,
      enabled: method.availability === "ACTIVE" && method.enabled && configuration.enabledMethods.includes(method.category),
      channels: [...method.supportedChannels],
      supportedCurrencies: [...method.supportedCurrencies],
      providerCodes: method.providerId ? [method.providerId] : existing?.providerCodes,
      requiresPhysicalShipping: method.requiresPhysicalShipping,
      supportsIntent: method.supportsPaymentRequest,
      supportsManualRecording: method.supportsManualRecording,
      supportsRefund: method.supportsRefund,
      supportsReconciliation: method.supportsReconciliation,
      requiresReference: method.requiresReference,
      requiresEvidence: method.requiresEvidence,
      displayOrder: method.displayOrder,
      availability: method.availability,
    };
  });
  const configuredCodes = new Set(configured.map((item) => item.code));
  const historicalOnly = seed
    .filter((item) => !configuredCodes.has(item.code))
    .map((item): PaymentMethodCatalogItem => ({ ...structuredClone(item), enabled: false, availability: "HISTORICAL_ONLY" }));
  return [...configured, ...historicalOnly]
    .sort((left, right) => left.displayOrder - right.displayOrder || left.code.localeCompare(right.code));
}
