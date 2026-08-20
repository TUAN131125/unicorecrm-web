import type { Lead } from "../../domain/model/lead.types";

export interface LeadExporter {
  exportCsv(leads: readonly Lead[], fileName: string): void;
}
