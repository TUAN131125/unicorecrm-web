import type { ApplicationErrorFieldMap } from "@/shared/domain";
import type { ExecuteLeadOpportunityCommand } from "../../domain/leadQualification.types";
import type { LeadQualificationFieldErrors } from "../../domain/leadQualification.rules";

/** Stable field keys select safe copy; server diagnostics never become field labels. */
export function presentOpportunityFieldErrors(
  fields: ApplicationErrorFieldMap | undefined,
  submitted: ExecuteLeadOpportunityCommand["deal"] | undefined,
  vi: boolean,
): LeadQualificationFieldErrors {
  const errors: LeadQualificationFieldErrors = {};
  if (fields?.amount) {
    errors["deal.estimatedValue"] = vi ? "Giai đoạn hiện tại yêu cầu giá trị ước tính lớn hơn 0." : "The current stage requires an estimated value greater than zero.";
  } else if (fields?.["deal.estimatedValue.amount"] || fields?.["deal.estimatedValue"] || fields?.["amount.amount"]) {
    errors["deal.estimatedValue"] = vi ? "Nhập giá trị không âm với tối đa 6 chữ số thập phân, hoặc để trống." : "Enter a non-negative amount with at most 6 decimal places, or leave it blank.";
  }
  if (fields?.["deal.estimatedValue.currency"] || fields?.["amount.currency"]) {
    errors["deal.currency"] = vi ? "Kiểm tra mã tiền tệ gồm 3 chữ cái in hoa." : "Review the currency code; use 3 uppercase letters.";
  }
  if (fields?.["deal.expectedCloseDate"]) {
    errors["deal.expectedCloseDate"] = vi ? "Chọn ngày dự kiến chốt hợp lệ cho cơ hội." : "Choose a valid target close date for the opportunity.";
  }
  return errors;
}
