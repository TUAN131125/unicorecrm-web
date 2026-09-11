import type {
  CommercialApiClient,
  CreateCustomerRequest,
  Customer360ReadModel,
  CustomerDocument,
  CustomerList,
  CustomerMutationResponse,
  ListCustomersQuery,
  UpdateCustomerRequest,
} from "@/platform/api/generated/commercialApi";
import type { AuthoritativePage, ModuleListQuery } from "@/shared/application";
import type {
  Customer360Projection,
  CustomerCommandOptions,
  CustomerCommandPort,
  CustomerQueryPort,
} from "../../application/ports/CustomerApiRuntime";
import type { Customer } from "../../domain/model/customer.types";
import { mapCustomer360ReadModel, mapCustomerDocument } from "./CustomerApiMapper";

export class CustomerHttpApiAdapter implements CustomerQueryPort, CustomerCommandPort {
  constructor(private readonly client: CommercialApiClient) {}

  async list(query: ModuleListQuery = {}, signal?: AbortSignal): Promise<AuthoritativePage<Customer>> {
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
    const items = response.items.map(mapCustomerDocument);
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
