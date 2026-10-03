import type { CommercialApiClient } from "@/platform/api/generated/commercialApi";
import type { LeadCustomerConversionGateway } from "../application/ports/LeadCustomerConversionGateway";

export function createLeadCustomerConversionGateway(client: CommercialApiClient): LeadCustomerConversionGateway {
  return {
    async convertLeadToCustomer(leadId, expectedVersion, idempotencyKey, request) {
      const response = await client.convertLeadToCustomer(leadId, request, {
        expectedVersion,
        idempotencyKey,
        retry: "idempotent",
      });
      return {
        outcome: response.outcome,
        occurredAt: response.occurredAt,
        result: { customerResolution: response.result.customerResolution, customerId: response.result.customerId },
      };
    },
  };
}
