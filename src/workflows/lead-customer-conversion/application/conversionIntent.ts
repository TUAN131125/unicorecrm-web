export interface LeadCustomerConversionIntent {
  subjectType: "CONTACT" | "ORGANIZATION_ACCOUNT";
  subjectId: string;
  expectedVersion: number;
  idempotencyKey: string;
}

export const editableLeadCustomerConversionFields = ["subjectType", "subjectId"] as const;

export function isLeadCustomerConversionSuppressed(customerRef: string | undefined): boolean {
  return Boolean(customerRef);
}

export function retainOrCreateConversionIntent(
  current: LeadCustomerConversionIntent | undefined,
  input: Omit<LeadCustomerConversionIntent, "idempotencyKey">,
  createKey: () => string,
): LeadCustomerConversionIntent {
  if (current && current.subjectType === input.subjectType && current.subjectId === input.subjectId)
    return current;
  return { ...input, idempotencyKey: createKey() };
}
