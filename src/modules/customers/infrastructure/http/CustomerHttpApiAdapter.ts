import type {
  CommercialApiClient,
  Customer360ReadModel,
  CustomerDocument,
  CustomerList,
} from "@/platform/api/generated/commercialApi";
import type { AuthoritativePage, ModuleListQuery } from "@/shared/application";
import type {
  Customer360Projection,
  CustomerQueryPort,
} from "../../application/ports/CustomerApiRuntime";
import type { Customer } from "../../domain/model/customer.types";
import { mapCustomer360ReadModel, mapCustomerDocument } from "./CustomerApiMapper";

export class CustomerHttpApiAdapter implements CustomerQueryPort {
  constructor(private readonly client: CommercialApiClient) {}

  async list(_query: ModuleListQuery = {}, signal?: AbortSignal): Promise<AuthoritativePage<Customer>> {
    const response = await this.client.listCustomers<CustomerList>({}, signal);
    const items = response.map(mapCustomerDocument);
    return {
      items,
      pageInfo: { hasNextPage: false, totalCount: items.length },
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
}
