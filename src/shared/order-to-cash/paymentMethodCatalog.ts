export type CanonicalPaymentMethodKind = "BANK_TRANSFER" | "COD" | "CASH" | "CARD" | "E_WALLET" | "OTHER";

const CANONICAL_PAYMENT_METHOD_CODE_BY_KIND: Readonly<Record<Exclude<CanonicalPaymentMethodKind, "OTHER">, string>> = {
  BANK_TRANSFER: "bank-transfer",
  COD: "carrier-cod",
  CASH: "cash",
  CARD: "gateway-card",
  E_WALLET: "gateway-wallet",
};

/**
 * Stable catalog codes used when migrating legacy enum-valued commercial snapshots.
 * Runtime UI choices still come from the Payment Method Catalog; this mapping exists
 * only to translate historical enum fields at compatibility boundaries.
 */
export function canonicalPaymentMethodCodeForKind(kind: CanonicalPaymentMethodKind): string {
  if (kind === "OTHER") throw new Error("Legacy OTHER payment method requires an explicit Payment Method Catalog code.");
  return CANONICAL_PAYMENT_METHOD_CODE_BY_KIND[kind];
}

export function canonicalPaymentMethodKindForCode(code: string): CanonicalPaymentMethodKind | undefined {
  const normalized = code.trim();
  const entry = Object.entries(CANONICAL_PAYMENT_METHOD_CODE_BY_KIND)
    .find(([, catalogCode]) => catalogCode === normalized);
  return entry?.[0] as CanonicalPaymentMethodKind | undefined;
}

export function isCanonicalCodMethodCode(code: string): boolean {
  return canonicalPaymentMethodKindForCode(code) === "COD";
}
