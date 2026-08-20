import type { AppEventBus } from "@/platform/events";
import type { LeadRepository } from "../application/ports/LeadRepository";
import type { Lead } from "../domain/model/lead.types";

export const LEADS_CHANGED_EVENT = "unicore.leads.changed";

export class InMemoryLeadRepository implements LeadRepository {
  private leads: Lead[];

  constructor(
    seed: readonly Lead[],
    private readonly events: AppEventBus,
  ) {
    this.leads = cloneLeads(seed);
  }

  list(): Lead[] {
    return cloneLeads(this.leads);
  }

  getById(leadId: string): Lead | undefined {
    const item = this.leads.find((lead) => lead.id === leadId);
    return item ? structuredClone(item) : undefined;
  }

  replace(leads: Lead[]): void {
    this.leads = cloneLeads(leads);
    this.events.publish<Lead[]>(LEADS_CHANGED_EVENT, this.list());
  }

  subscribe(listener: (leads: Lead[]) => void): () => void {
    return this.events.subscribe<Lead[]>(LEADS_CHANGED_EVENT, listener);
  }
}

function cloneLeads(leads: readonly Lead[]): Lead[] {
  return structuredClone([...leads]);
}
