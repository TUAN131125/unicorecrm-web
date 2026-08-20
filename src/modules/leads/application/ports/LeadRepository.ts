import type { Lead } from "../../domain/model/lead.types";

export interface LeadRepository {
  list(): Lead[];
  getById(leadId: string): Lead | undefined;
  replace(leads: Lead[]): void;
  subscribe(listener: (leads: Lead[]) => void): () => void;
}
