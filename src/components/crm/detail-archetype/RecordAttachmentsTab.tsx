import React, { useRef, useState } from "react";
import { Download, Paperclip, Plus, Trash2, UploadCloud } from "lucide-react";
import { useI18n } from "@/i18n";
import { Button, DetailTabActionButton, Modal } from "@/shared/components/ui";

export interface RecordAttachmentItem {
  id: string;
  name: string;
  size: string;
  date: string;
  category?: string;
  description?: string;
  file?: File;
}

export interface RecordAttachmentUploadData {
  name: string;
  category: "proposal" | "contract" | "quotation" | "identity" | "requirement" | "other";
  size?: string;
  description?: string;
  file?: File;
}

interface RecordAttachmentsTabProps {
  idPrefix: string;
  attachments: RecordAttachmentItem[];
  onUploadAttachment(data: RecordAttachmentUploadData): void;
  onDeleteAttachment(id: string): void;
  onDownloadAttachment(id: string): void;
  isArchived?: boolean;
  onModalStateChange?(open: boolean): void;
  title?: string;
}

const ACCEPTED_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg";
const MAX_FILE_SIZE = 25 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const RecordAttachmentsTab: React.FC<RecordAttachmentsTabProps> = ({
  idPrefix,
  attachments = [],
  onUploadAttachment,
  onDeleteAttachment,
  onDownloadAttachment,
  isArchived = false,
  onModalStateChange,
  title,
}) => {
  const { tx } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<RecordAttachmentUploadData["category"]>("proposal");
  const [description, setDescription] = useState("");
  const [validationMessage, setValidationMessage] = useState("");

  React.useEffect(() => {
    onModalStateChange?.(showModal);
    return () => {
      if (showModal) onModalStateChange?.(false);
    };
  }, [showModal, onModalStateChange]);

  const requestFile = () => {
    if (!isArchived) fileInputRef.current?.click();
  };

  const prepareFile = (file?: File) => {
    if (!file || isArchived) return;
    if (file.size > MAX_FILE_SIZE) {
      setValidationMessage(tx("contactDetail.attachments.fileTooLarge", "Tệp vượt quá giới hạn 25 MB. Vui lòng chọn tệp nhỏ hơn."));
      return;
    }
    setSelectedFile(file);
    setCategory("proposal");
    setDescription("");
    setValidationMessage("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedFile(null);
    setDescription("");
    setValidationMessage("");
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedFile || isArchived) {
      setValidationMessage(tx("contactDetail.attachments.selectFileRequired", "Vui lòng chọn một tệp để tải lên."));
      return;
    }
    onUploadAttachment({
      name: selectedFile.name,
      category,
      size: formatFileSize(selectedFile.size),
      description: description.trim(),
      file: selectedFile,
    });
    closeModal();
  };

  const categoryLabel = (value: string) => tx(
    `contactDetail.attachments.category.${value}`,
    value === "proposal" ? "Đề xuất" : value === "contract" ? "Hợp đồng" : value === "quotation" ? "Báo giá" : value === "identity" ? "Hồ sơ pháp lý" : value === "requirement" ? "Yêu cầu" : "Khác",
  );

  return (
    <div id={`${idPrefix}-attachments-tab`} className="space-y-4 animate-fade-in text-[11px] text-slate-700">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="sr-only"
        onChange={(event) => {
          prepareFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-bold text-slate-900">{title ?? tx("contactDetail.attachments.tabTitle", "Tài liệu đính kèm")}</h4>
          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">{attachments.length}</span>
        </div>
        {!isArchived && (
          <DetailTabActionButton actionIntent="create" onClick={requestFile} icon={<Plus size={14} />}>
            {tx("contactDetail.attachments.uploadBtn", "Tải tài liệu lên")}
          </DetailTabActionButton>
        )}
      </div>

      {!isArchived && (
        <div
          role="button"
          tabIndex={0}
          onClick={requestFile}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") requestFile(); }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); prepareFile(event.dataTransfer.files?.[0]); }}
          className="flex cursor-pointer select-none flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-violet-500 hover:bg-violet-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30"
        >
          <UploadCloud size={28} className="mb-2.5 text-slate-400" />
          <p className="text-xs font-bold text-slate-700">{tx("contactDetail.attachments.dragPrompt", "Kéo thả tệp vào đây hoặc chọn tệp từ thiết bị")}</p>
          <p className="mt-1 text-[10px] font-semibold text-slate-500">{tx("contactDetail.attachments.formatsSupport", "Hỗ trợ PDF, DOCX, XLSX, PNG và JPG; tối đa 25 MB.")}</p>
          {validationMessage && <p role="alert" className="mt-2 text-xs font-semibold text-rose-600">{validationMessage}</p>}
        </div>
      )}

      <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white text-left">
        {attachments.length > 0 ? attachments.map((attachment) => (
          <div key={attachment.id} className="group flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-50">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-100 bg-violet-50 text-violet-700"><Paperclip size={13} /></span>
              <div className="min-w-0">
                <p className="crm-text-wrap text-[11px] font-bold text-slate-800 group-hover:text-violet-700">{attachment.name}</p>
                <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
                  {attachment.category && <span className="mr-1.5 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">{categoryLabel(attachment.category)}</span>}
                  {attachment.size || "—"} · {attachment.date}
                </p>
                {attachment.description && <p className="mt-1 text-[10px] font-medium text-slate-500">{attachment.description}</p>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="ghost" size="xs" icon={<Download size={13} />} onClick={() => onDownloadAttachment(attachment.id)}>{tx("common.download", "Tải về")}</Button>
              <Button type="button" variant="ghost" size="xs" actionIntent="destructive" disabled={isArchived} aria-label={tx("contactDetail.attachments.delete", "Xóa tài liệu")} onClick={() => onDeleteAttachment(attachment.id)}><Trash2 size={13} /></Button>
            </div>
          </div>
        )) : (
          <div className="flex min-h-[160px] flex-col items-center justify-center px-4 py-8 text-center text-xs text-slate-500">
            <Paperclip size={24} className="mb-2 text-slate-300" />
            <span className="font-semibold">{tx("contactDetail.empty.noAttachments", "Chưa có tài liệu đính kèm.")}</span>
            {!isArchived && <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={requestFile}>{tx("contactDetail.attachments.emptyCTA", "Chọn tài liệu đầu tiên")}</Button>}
          </div>
        )}
      </div>

      <Modal
        id={`${idPrefix}-attachment-upload-modal`}
        isOpen={showModal}
        onClose={closeModal}
        title={tx("contactDetail.attachments.modalTitle", "Tải tài liệu đính kèm")}
        size="sm"
        variant="form"
        footer={(
          <>
            <Button type="button" variant="secondary" onClick={closeModal}>{tx("common.cancel", "Hủy")}</Button>
            <Button type="submit" form={`${idPrefix}-attachment-upload-form`} variant="primary" disabled={!selectedFile}>{tx("contactDetail.attachments.uploadAction", "Tải lên")}</Button>
          </>
        )}
      >
        <form id={`${idPrefix}-attachment-upload-form`} onSubmit={handleSubmit} className="crm-form-surface space-y-4">
          <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-3">
            <p className="text-xs font-bold text-slate-900">{selectedFile?.name}</p>
            <p className="mt-1 text-[11px] font-medium text-slate-600">{selectedFile ? formatFileSize(selectedFile.size) : ""}</p>
            <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={requestFile}>{tx("contactDetail.attachments.chooseAnother", "Chọn tệp khác")}</Button>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">{tx("contactDetail.attachments.categoryLabel", "Phân loại tài liệu")}</span>
            <select value={category} onChange={(event) => setCategory(event.target.value as RecordAttachmentUploadData["category"])} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20">
              <option value="proposal">{tx("contactDetail.attachments.category.proposal", "Đề xuất")}</option>
              <option value="contract">{tx("contactDetail.attachments.category.contract", "Hợp đồng")}</option>
              <option value="quotation">{tx("contactDetail.attachments.category.quotation", "Báo giá")}</option>
              <option value="identity">{tx("contactDetail.attachments.category.identity", "Hồ sơ pháp lý")}</option>
              <option value="requirement">{tx("contactDetail.attachments.category.requirement", "Yêu cầu")}</option>
              <option value="other">{tx("contactDetail.attachments.category.other", "Khác")}</option>
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">{tx("contactDetail.attachments.descriptionLabel", "Mô tả / Ghi chú")}</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={tx("contactDetail.attachments.descPlaceholder", "Thêm thông tin giúp đồng nghiệp nhận biết tài liệu này")} rows={3} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20" />
          </label>
          {validationMessage && <p role="alert" className="text-xs font-semibold text-rose-600">{validationMessage}</p>}
        </form>
      </Modal>
    </div>
  );
};
