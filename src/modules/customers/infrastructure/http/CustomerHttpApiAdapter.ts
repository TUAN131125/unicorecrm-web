import type {
  CommercialApiClient,
  CreateCustomerRequest,
  Customer360ReadModel,
  CustomerDocument,
  CustomerList,
  CustomerMutationResponse,
  ListCustomersQuery,
  CreateDirectCustomerRequest as ApiCreateDirectCustomerRequest,
  CustomerPhoneCheckResponse,
  UpdateCustomerRequest,
} from "@/platform/api/generated/commercialApi";
import type { AuthoritativePage, ModuleListQuery, MutationOutcome } from "@/shared/application";
import type {
  Customer360Projection,
  CustomerCommandOptions,
  CustomerCommandPort,
  CustomerQueryPort,
  CustomerListItem,
  CreateDirectCustomerInput,
  CustomerPhoneCandidate,
} from "../../application/ports/CustomerApiRuntime";
import type { Customer } from "../../domain/model/customer.types";
import { mapCustomer360ReadModel, mapCustomerDocument } from "./CustomerApiMapper";

export class CustomerHttpApiAdapter implements CustomerQueryPort, CustomerCommandPort {
  constructor(private readonly client: CommercialApiClient) {}

  async checkPhone(phone: string, signal?: AbortSignal): Promise<CustomerPhoneCandidate[]> {
    const result = await this.client.checkCustomerPhone<CustomerPhoneCheckResponse>({ phone }, { signal });
    return result.candidates;
  }

  async createDirect(input: CreateDirectCustomerInput, options: CustomerCommandOptions): Promise<MutationOutcome<Customer>> {
    const result = await this.client.createDirectCustomer<CustomerMutationResponse, ApiCreateDirectCustomerRequest>(input, options);
    return { data: mapCustomerDocument(result.result), commandId: result.commandId, commandType: "customer.create-direct",
      aggregateType: result.aggregateType, aggregateId: result.aggregateId, idempotencyKey: options.idempotencyKey,
      correlationId: result.correlationId, occurredAt: result.occurredAt, version: result.version, outcome: result.outcome,
      warnings: result.warnings ?? [], emittedEvents: result.emittedEventIds ?? [],
      audit: { authority: "backend", evidenceIds: result.auditEvidenceIds ?? [] } };
  }

  async list(query: ModuleListQuery = {}, signal?: AbortSignal): Promise<AuthoritativePage<CustomerListItem>> {
    const filters = query.filters ?? {};
    const request: ListCustomersQuery = {
      q: query.search,
      type: filters.type as ListCustomersQuery["type"],
      status: filters.status as ListCustomersQuery["status"],
      ownerId: filters.ownerId as string | undefined,
      segment: filters.segment as string | undefined,
      tier: filters.tier as ListCustomersQuery["tier"],
      cursor: query.cursor,
      limit: query.limit,
    };
    const response = await this.client.listCustomers<CustomerList>(request, signal);
    const items = response.items.map(value => ({ ...mapCustomerDocument(value),
      ...(response.identities?.[value.id] ? { listIdentity: response.identities[value.id] } : {}),
    }));
    return {
      items,
      pageInfo: {
        hasNextPage: response.pageInfo.hasNextPage,
        nextCursor: response.pageInfo.nextCursor,
      },
      authority: "backend",
      loadedAt: new Date().toISOString(),
    };
  }

  async get(customerId: string, signal?: AbortSignal): Promise<Customer> {
    const response = await this.client.getCustomer<CustomerDocument>(customerId, {}, signal);
    return mapCustomerDocument(response);
  }

  async get360(customerId: string, signal?: AbortSignal): Promise<Customer360Projection> {
    const response = await this.client.getCustomer360<Customer360ReadModel>(customerId, {}, signal);
    return mapCustomer360ReadModel(response);
  }

  async create(input: CreateCustomerRequest, options: CustomerCommandOptions): Promise<Customer> {
    const response = await this.client.createCustomer<CustomerMutationResponse, CreateCustomerRequest>(input, options);
    return mapCustomerDocument(response.result);
  }

  async update(customerId: string, input: UpdateCustomerRequest, options: CustomerCommandOptions): Promise<Customer> {
    const response = await this.client.updateCustomer<CustomerMutationResponse, UpdateCustomerRequest>(customerId, input, options);
    return mapCustomerDocument(response.result);
  }

  async archive(customerId: string, options: CustomerCommandOptions): Promise<Customer> {
    const response = await this.client.archiveCustomer<CustomerMutationResponse>(customerId, {}, options);
    return mapCustomerDocument(response.result);
  }
}
