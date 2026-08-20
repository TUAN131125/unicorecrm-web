import { escapeSpreadsheetSafeCsvCell } from "@/shared/lib/csv/spreadsheetSafeCsv";
import type { LeadExporter } from "../application/ports/LeadExporter";
import type { Lead } from "../domain/model/lead.types";

export class BrowserLeadExporter implements LeadExporter {
  exportCsv(leads: readonly Lead[], fileName: string): void {
    if (typeof document === "undefined") return;

    const rows = leads.map((lead) => [
      lead.name,
      lead.companyName ?? "",
      lead.phone,
      lead.email,
      lead.leadWorkState,
      lead.qualificationOutcome ?? "",
      lead.createdAt,
    ]);
    const csv = [
      ["Name", "Company", "Phone", "Email", "Work State", "Qualification Outcome", "Created At"],
      ...rows,
    ].map((row) => row.map(escapeSpreadsheetSafeCsvCell).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
}

