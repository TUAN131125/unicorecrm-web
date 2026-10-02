import type { Lead } from "../../domain/model/lead.types";

export interface LeadRepository {
  list(): Lead[];
  getById(leadId: string): Lead | undefined;
  replace(leads: Lead[]): void;
  /** Apply a local projection update to stored values, before read disclosure. */
  replaceProjection?(updater: (stored: Lead[]) => Lead[]): void;
  subscribe(listener: (leads: Lead[]) => void): () => void;
}
