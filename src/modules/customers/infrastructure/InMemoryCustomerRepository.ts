import { relationshipRefKey, type RelationshipRef } from "@/platform/identity";
import type { StoragePort } from "@/platform/persistence";
import type { CustomerRepository } from "../application/ports/CustomerRepository";
import type { Customer, CustomerCareCard, CustomerRepositorySnapshot } from "../domain/model/customer.types";
import { assertCustomerInvariant, customerRelationshipKey } from "../domain/rules/customerRules";

export class InMemoryCustomerRepository implements CustomerRepository {
  private state: CustomerRepositorySnapshot;
  private readonly listeners = new Set<(snapshot: CustomerRepositorySnapshot) => void>();

  constructor(seed: CustomerRepositorySnapshot = { customers: [], careCards: [] }, private readonly storage?: StoragePort) {
    const stored = storage?.get<CustomerRepositorySnapshot>("snapshot");
    this.state = cloneSnapshot(stored ?? seed);
    this.assertSnapshot(this.state);
  }

  snapshot(): CustomerRepositorySnapshot { return cloneSnapshot(this.state); }
  list(): Customer[] { return structuredClone(this.state.customers); }
  listCareCards(): CustomerCareCard[] { return structuredClone(this.state.careCards); }
  getById(customerId: string): Customer | undefined {
    const found = this.state.customers.find((item) => item.id === customerId);
    return found ? structuredClone(found) : undefined;
  }
  getByAlias(idOrAlias: string): Customer | undefined {
    const found = this.state.customers.find((item) => item.id === idOrAlias || item.customerCode === idOrAlias || item.legacyAliases?.includes(idOrAlias));
    return found ? structuredClone(found) : undefined;
  }
  findByRelationship(workspaceId: string, relationshipRef: RelationshipRef): Customer | undefined {
    const key = customerRelationshipKey(workspaceId, relationshipRef);
    const found = this.state.customers.find((item) => customerRelationshipKey(item.workspaceId, item.relationshipRef) === key);
    return found ? structuredClone(found) : undefined;
  }
  save(customer: Customer): Customer {
    assertCustomerInvariant(customer);
    const relationshipKey = customerRelationshipKey(customer.workspaceId, customer.relationshipRef);
    const duplicate = this.state.customers.find((item) => item.id !== customer.id && customerRelationshipKey(item.workspaceId, item.relationshipRef) === relationshipKey);
    if (duplicate) throw new Error(`Customer relationship must be unique: ${relationshipRefKey(customer.relationshipRef)}`);
    this.state.customers = [structuredClone(customer), ...this.state.customers.filter((item) => item.id !== customer.id)];
    this.commit();
    return structuredClone(customer);
  }
  saveCareCard(card: CustomerCareCard): CustomerCareCard {
    this.state.careCards = [structuredClone(card), ...this.state.careCards.filter((item) => item.id !== card.id)];
    this.commit();
    return structuredClone(card);
  }
  replace(snapshot: CustomerRepositorySnapshot): void {
    this.assertSnapshot(snapshot);
    this.state = cloneSnapshot(snapshot);
    this.commit();
  }
  subscribe(listener: (snapshot: CustomerRepositorySnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private assertSnapshot(snapshot: CustomerRepositorySnapshot): void {
    snapshot.customers.forEach(assertCustomerInvariant);
    const seen = new Set<string>();
    for (const customer of snapshot.customers) {
      const key = customerRelationshipKey(customer.workspaceId, customer.relationshipRef);
      if (seen.has(key)) throw new Error(`Duplicate Customer relationship: ${key}`);
      seen.add(key);
    }
  }
  private commit(): void {
    this.storage?.set("snapshot", this.state);
    const snapshot = this.snapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

function cloneSnapshot(snapshot: CustomerRepositorySnapshot): CustomerRepositorySnapshot {
  return structuredClone(snapshot);
}
