import { formatApplicationError } from "@/shared/operations";
import { useCallback } from "react";
import type { Lead } from "../../domain/model/lead.types";
import { requestLeadExportViaApi } from "../../public/leads";

/**
 * Connected export is backend-authoritative: the browser requests an explicitly
 * scoped export artifact and only downloads the returned short-lived URL.
 */
export const useLeadImportExport = (
  leads: Lead[],
  selectedLeadIds: string[],
  _clearSelection: () => void,
  showToast: (msg: string) => void,
  locale: string,
) => {
  const handleBulkExport = useCallback(async () => {
    try {
      const leadIds = selectedLeadIds.length > 0
        ? selectedLeadIds
        : leads.map((lead) => lead.id);
      const result = await requestLeadExportViaApi(leadIds);
      const anchor = document.createElement("a");
      anchor.href = result.artifact.downloadUrl;
      anchor.download = result.artifact.fileName;
      anchor.rel = "noopener noreferrer";
      anchor.click();
      showToast(locale === "vi"
        ? `Đã chuẩn bị tệp CSV cho ${result.artifact.exportedCount} Lead.`
        : `Prepared a CSV export for ${result.artifact.exportedCount} Leads.`);
    } catch (error) {
      showToast(locale === "vi"
        ? `Không thể xuất Lead: ${formatApplicationError(error, { locale })}`
        : `Leads were not exported: ${formatApplicationError(error, { locale })}`);
    }
  }, [leads, selectedLeadIds, showToast, locale]);

  return { handleBulkExport };
};
