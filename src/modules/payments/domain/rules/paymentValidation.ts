export type PaymentValidationField = "orderId" | "buyerRef" | "amount" | "currency" | "obligationId" | "idempotencyKey";
export type PaymentValidationFieldErrors = Partial<Record<PaymentValidationField, string>>;

export interface PaymentValidationDetails {
  outstandingAmount?: number;
  overageAmount?: number;
  obligationId?: string;
}

export class PaymentValidationError extends Error {
  constructor(
    readonly code: string,
    readonly fieldErrors: PaymentValidationFieldErrors,
    readonly details: PaymentValidationDetails = {},
  ) {
    super(Object.values(fieldErrors).join(" "));
    this.name = "PaymentValidationError";
  }
}

export function paymentValidationError(
  code: string,
  field: PaymentValidationField,
  message: string,
  details: PaymentValidationDetails = {},
): PaymentValidationError {
  return new PaymentValidationError(code, { [field]: message }, details);
}
