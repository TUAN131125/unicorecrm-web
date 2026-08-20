import { formatApplicationError } from "@/shared/operations";
import React from "react";
import { AlertCircle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { useI18n } from "@/i18n";
import { Button, ConfirmDialog, Modal } from "@/shared/components/ui";
import { buildLeadCsvImportPlan, type LeadCsvImportPlan } from "../../application/import/leadCsvImport";
import { importLeadCsvPlanViaApi } from "../../public/leads";

interface LeadImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: (count: number) => void;
  defaultOwnerId?: string;
  actorName: string;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const CSV_MIME_TYPES = new Set(["text/csv", "application/csv", "application/vnd.ms-excel"]);
const SUPPORTED_COLUMNS = [
  "name/full_name",
  "phone",
  "work_phone",
  "email",
  "company",
  "title",
  "source",
  "owner_id",
  "pain_point",
  "next_follow_up_at",
  "preferred_channel",
];

export const LeadImportDialog: React.FC<LeadImportDialogProps> = ({
  isOpen,
  onClose,
  onImported,
  defaultOwnerId,
}) => {
  const { locale } = useI18n();
  const vi = locale === "vi";
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [plan, setPlan] = React.useState<LeadCsvImportPlan | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isParsing, setIsParsing] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = React.useState(false);

  const reset = React.useCallback(() => {
    setFile(null);
    setPlan(null);
    setError(null);
    setIsParsing(false);
    setIsImporting(false);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  React.useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  const requestClose = () => {
    if (isParsing || isImporting) return;
    if (file || plan) {
      setShowDiscardConfirm(true);
      return;
    }
    onClose();
  };

  const parseFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setPlan(null);
    setError(null);
    if (!selectedFile.name.toLocaleLowerCase().endsWith(".csv")) {
      setError(vi ? "Đợt này chỉ hỗ trợ tệp CSV. XLSX vẫn được khóa cho đến khi có bộ đọc bảng tính an toàn." : "This release supports CSV only. XLSX remains disabled until a safe spreadsheet parser is available.");
      return;
    }
    if (selectedFile.type && !CSV_MIME_TYPES.has(selectedFile.type.toLocaleLowerCase())) {
      setError(vi ? "Kiểu nội dung của tệp không phải CSV hợp lệ." : "The selected file does not have a supported CSV content type.");
      return;
    }
    if (selectedFile.size === 0) {
      setError(vi ? "Tệp CSV đang trống." : "The CSV file is empty.");
      return;
    }
    if (selectedFile.size > MAX_FILE_BYTES) {
      setError(vi ? "Tệp CSV vượt quá giới hạn 5 MB." : "The CSV file exceeds the 5 MB limit.");
      return;
    }

    setIsParsing(true);
    try {
      const text = await selectedFile.text();
      setPlan(buildLeadCsvImportPlan(text));
    } catch (caught) {
      setError(formatApplicationError(caught, { locale }));
    } finally {
      setIsParsing(false);
    }
  };

  const commit = async () => {
    if (!plan || plan.invalidRowCount > 0 || isImporting) return;
    setIsImporting(true);
    setError(null);
    try {
      const result = await importLeadCsvPlanViaApi(plan, { defaultOwnerId });
      reset();
      onImported(result.importedCount);
      onClose();
    } catch (caught) {
      setError(formatApplicationError(caught, { locale }));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={requestClose}
        title={vi ? "Nhập Lead từ CSV" : "Import Leads from CSV"}
        description={vi ? "Hệ thống đọc dữ liệu thật, kiểm tra toàn bộ trước và chỉ ghi một lần khi tất cả dòng hợp lệ." : "The system reads the actual file, validates the complete batch, and commits once only when every row is valid."}
        size="lg"
        variant="form"
        scrollBody={false}
        bodyClassName="p-0"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6 crm-scroll-y">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => {
                const selected = event.target.files?.[0];
                if (selected) void parseFile(selected);
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isParsing || isImporting}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-violet-300 hover:bg-violet-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-violet-700 shadow-sm"><Upload size={22} aria-hidden="true" /></span>
              <span className="text-sm font-extrabold text-slate-900">{file?.name || (vi ? "Chọn tệp CSV" : "Choose a CSV file")}</span>
              <span className="text-xs font-medium text-slate-500">{vi ? "Tối đa 5 MB và 5.000 dòng dữ liệu" : "Maximum 5 MB and 5,000 data rows"}</span>
            </button>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-600">
              <p className="font-extrabold text-slate-900">{vi ? "Cột được hỗ trợ" : "Supported columns"}</p>
              <p className="mt-1"><code>{SUPPORTED_COLUMNS.join(", ")}</code>.</p>
              <p className="mt-1">{vi ? "Bắt buộc: họ tên và ít nhất một số điện thoại hoặc email." : "Required: full name and at least one phone number or email address."}</p>
            </div>

            {error && (
              <div role="alert" className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                <AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {plan && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{vi ? "Tổng dòng" : "Rows"}</p><p className="mt-1 text-xl font-black text-slate-900">{plan.rows.length}</p></div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">{vi ? "Hợp lệ" : "Valid"}</p><p className="mt-1 text-xl font-black text-emerald-800">{plan.candidates.length}</p></div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-rose-600">{vi ? "Có lỗi" : "Invalid"}</p><p className="mt-1 text-xl font-black text-rose-800">{plan.invalidRowCount}</p></div>
                </div>
                <div className="max-h-72 overflow-auto rounded-2xl border border-slate-200 bg-white crm-scroll-y">
                  <table className="min-w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">{vi ? "Họ tên" : "Name"}</th><th className="px-3 py-2">{vi ? "Liên hệ" : "Contact"}</th><th className="px-3 py-2">{vi ? "Kết quả" : "Result"}</th></tr></thead>
                    <tbody>
                      {plan.rows.slice(0, 100).map((row) => (
                        <tr key={row.rowNumber} className="border-t border-slate-100 align-top">
                          <td className="px-3 py-2 font-mono text-slate-500">{row.rowNumber}</td>
                          <td className="px-3 py-2 font-semibold text-slate-800">{row.candidate?.name || row.values.name || row.values.full_name || "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{row.candidate?.email || row.candidate?.phone || row.candidate?.workPhone || "—"}</td>
                          <td className="px-3 py-2">{row.errors.length === 0 ? <span className="inline-flex items-center gap-1 font-bold text-emerald-700"><CheckCircle2 size={13} />{vi ? "Sẵn sàng" : "Ready"}</span> : <ul className="space-y-1 text-rose-700">{row.errors.map((message) => <li key={message}>• {message}</li>)}</ul>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {plan.rows.length > 100 && <p className="text-xs text-slate-500">{vi ? "Bảng xem trước chỉ hiển thị 100 dòng đầu." : "The preview displays the first 100 rows only."}</p>}
              </div>
            )}
          </div>

          <div className="crm-form-action-bar flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500"><FileSpreadsheet size={15} />{plan?.checksum || (vi ? "Chưa có kế hoạch nhập" : "No import plan yet")}</span>
            <div className="flex items-center gap-3">
              <Button type="button" variant="secondary" onClick={requestClose} disabled={isParsing || isImporting}>{vi ? "Hủy" : "Cancel"}</Button>
              <Button type="button" variant="primary" onClick={() => void commit()} disabled={!plan || plan.invalidRowCount > 0 || isParsing || isImporting}>{isImporting ? (vi ? "Đang nhập..." : "Importing...") : (vi ? "Nhập toàn bộ" : "Import all")}</Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={() => {
          setShowDiscardConfirm(false);
          reset();
          onClose();
        }}
        title={vi ? "Bỏ kế hoạch nhập?" : "Discard import plan?"}
        message={vi ? "Tệp và kết quả kiểm tra hiện tại sẽ bị xóa khỏi hộp thoại." : "The selected file and current validation result will be cleared."}
        confirmText={vi ? "Bỏ thay đổi" : "Discard"}
        cancelText={vi ? "Tiếp tục kiểm tra" : "Keep reviewing"}
        type="warning"
      />
    </>
  );
};
