import { CAPABILITIES, assertRuntimeCommandAccess, assertRuntimeCapability } from "@/platform/access-control";
import type { LeadExporter } from "../ports/LeadExporter";
import type { LeadRepository } from "../ports/LeadRepository";

/**
 * Exports only records explicitly requested by the presentation layer after
 * enforcing both the export capability and record-level data scope.
 */
export function exportLeads(
  repository: LeadRepository,
  exporter: LeadExporter,
  leadIds: readonly string[],
  fileName: string,
): number {
  assertRuntimeCapability(CAPABILITIES.LEADS_EXPORT);

  const requestedIds = new Set(leadIds);
  const leads = repository.list().filter((lead) => requestedIds.has(lead.id));

  // Preflight the complete export before creating a browser download. This
  // prevents a partial or out-of-scope export when one requested Lead is denied.
  leads.forEach((lead) => {
    assertRuntimeCommandAccess(CAPABILITIES.LEADS_EXPORT, "leads", lead);
  });

  exporter.exportCsv(leads, fileName);
  return leads.length;
}
