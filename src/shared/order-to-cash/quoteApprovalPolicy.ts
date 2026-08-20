/** Cross-boundary commercial policy contract consumed by Workspace Config and Quote rules. */
export interface QuoteApprovalPolicyConfig {
  policyVersion: string;
  alwaysRequireApproval?: boolean;
  maxLineDiscountPercentWithoutApproval: number;
  maxTotalDiscountPercentWithoutApproval: number;
  maxGrandTotalWithoutApproval: number;
  maxPostpaidDaysWithoutApproval: number;
  requireApprovalForCustomPaymentTerms: boolean;
  approverRoleLabel?: string;
}
