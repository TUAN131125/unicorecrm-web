export interface LeadCustomerConversionRequest {
  accountSubject: { type: "CONTACT" | "ORGANIZATION_ACCOUNT"; mode: "EXISTING"; id: string };
}

export interface LeadConversionOutcome {
  outcome: "COMMITTED" | "REPLAYED";
  occurredAt: string;
  result: { customerResolution: "CREATED" | "REUSED"; customerId: string };
}

export interface LeadCustomerConversionGateway {
  convertLeadToCustomer(leadId: string, expectedVersion: number, idempotencyKey: string, request: LeadCustomerConversionRequest): Promise<LeadConversionOutcome>;
}
