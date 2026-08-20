import React from "react";
import { Badge, getQuoteStatusBadgeVariant } from "@/shared/components/ui";
import { QuoteStatus } from "../../domain/model/quote.types";
import { useI18n } from "@/i18n";

const STATUS_LABEL_KEYS: Record<QuoteStatus, string> = {
  [QuoteStatus.DRAFT]: "quote.status.draft",
  [QuoteStatus.REVIEW]: "quote.status.review",
  [QuoteStatus.SENT]: "quote.status.sent",
  [QuoteStatus.ACCEPTED]: "quote.status.accepted",
  [QuoteStatus.REJECTED]: "quote.status.rejected",
  [QuoteStatus.EXPIRED]: "quote.status.expired",
};

interface QuoteStatusBadgeProps {
  status: QuoteStatus;
  className?: string;
}

export const QuoteStatusBadge: React.FC<QuoteStatusBadgeProps> = ({ status, className = "" }) => {
  const { t } = useI18n();

  return (
    <Badge
      variant={getQuoteStatusBadgeVariant(status)}
      size="xs"
      className={`whitespace-nowrap font-black tracking-wide ${className}`}
    >
      {t(STATUS_LABEL_KEYS[status])}
    </Badge>
  );
};
