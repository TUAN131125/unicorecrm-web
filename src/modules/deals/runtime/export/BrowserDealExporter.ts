import { escapeSpreadsheetSafeCsvCell } from "@/shared/lib/csv/spreadsheetSafeCsv";
import type { Deal } from "../../domain/model/deal.types";
import type { DealExportColumn, DealExporter } from "../../application/ports/DealExporter";


export function exportDealsCsv(filename: string, deals: readonly Deal[], columns: readonly DealExportColumn[]): void {
  if (typeof document === "undefined") return;
  const rows = [
    columns.map((column) => escapeSpreadsheetSafeCsvCell(column.label)).join(","),
    ...deals.map((deal) => columns.map((column) => escapeSpreadsheetSafeCsvCell(column.value(deal))).join(",")),
  ];
  const blob = new Blob([`\uFEFF${rows.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const browserDealExporter: DealExporter = { exportCsv: exportDealsCsv };
