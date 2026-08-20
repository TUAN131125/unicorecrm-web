import type { Deal } from "../../domain/model/deal.types";

export interface DealExportColumn {
  key: string;
  label: string;
  value(deal: Deal): string | number;
}

export interface DealExporter {
  exportCsv(filename: string, deals: readonly Deal[], columns: readonly DealExportColumn[]): void;
}
