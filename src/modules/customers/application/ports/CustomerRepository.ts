import type { RelationshipRef } from "@/platform/identity";
import type { Customer, CustomerCareCard, CustomerRepositorySnapshot } from "../../domain/model/customer.types";

export interface CustomerRepository {
  snapshot(): CustomerRepositorySnapshot;
  list(): Customer[];
  listCareCards(): CustomerCareCard[];
  getById(customerId: string): Customer | undefined;
  getByAlias(idOrAlias: string): Customer | undefined;
  findByRelationship(workspaceId: string, relationshipRef: RelationshipRef): Customer | undefined;
  save(customer: Customer): Customer;
  saveCareCard(card: CustomerCareCard): CustomerCareCard;
  replace(snapshot: CustomerRepositorySnapshot): void;
  subscribe(listener: (snapshot: CustomerRepositorySnapshot) => void): () => void;
}
