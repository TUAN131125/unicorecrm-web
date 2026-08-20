import React from "react";
import { ConfirmDialog } from "@/shared/components/ui";
import type { Quote } from "../../domain/model/quote.types";

interface QuoteDeleteConfirmDialogProps {
  quote: Quote | null;
  isOpen: boolean;
  onClose(): void;
  onConfirm(): void;
  locale: string;
}

export const QuoteDeleteConfirmDialog: React.FC<QuoteDeleteConfirmDialogProps> = ({
  quote,
  isOpen,
  onClose,
  onConfirm,
  locale,
}) => {
  const vi = locale === "vi";

  return (
    <ConfirmDialog
      id="quote-delete-confirmation"
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={vi ? "Lưu trữ báo giá" : "Archive quote"}
      description={quote
        ? (vi
          ? `Bạn sắp lưu trữ ${quote.quoteNumber} — ${quote.title}. Hồ sơ và lịch sử thương mại vẫn được giữ lại.`
          : `You are about to archive ${quote.quoteNumber} — ${quote.title}. The record and commercial history will be retained.`)
        : undefined}
      confirmText={vi ? "Lưu trữ báo giá" : "Archive quote"}
      cancelText={vi ? "Hủy" : "Cancel"}
      variant="danger"
    />
  );
};
