export type CustomerAssessmentLevel = "HEALTHY" | "WATCH" | "RISK" | "CRITICAL";
export type CustomerAssessmentTrend = "IMPROVING" | "STABLE" | "DECLINING";
export type CustomerAssessmentSignalKind = "POSITIVE" | "ATTENTION" | "RISK";
export type CustomerAssessmentSignalCategory =
  "RELATIONSHIP" | "SUPPORT" | "WORK" | "COMMERCIAL" | "PURCHASE" | "RETURN";
export type CustomerAssessmentSignalSeverity =
  "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type CustomerAssessmentSignalStatus = "ACTIVE";

export interface CustomerSignalEvidence {
  sourceType: string;
  recordId: string;
  factVi: string;
  factEn: string;
  occurredAt?: string;
}

export interface CustomerRecommendedAction {
  actionType:
    | "OPEN_RECORD"
    | "OPEN_CUSTOMER_TAB"
    | "CREATE_TASK"
    | "CREATE_CARE"
    | "CREATE_OPPORTUNITY";
  labelVi: string;
  labelEn: string;
  targetModule?: string;
  targetRecordId?: string;
  customerTab?: string;
}

export interface CustomerAssessmentSignal {
  id: string;
  category: CustomerAssessmentSignalCategory;
  kind: CustomerAssessmentSignalKind;
  severity: CustomerAssessmentSignalSeverity;
  status: CustomerAssessmentSignalStatus;
  labelVi: string;
  labelEn: string;
  detailVi: string;
  detailEn: string;
  impact: number;
  detectedAt: string;
  lastChangedAt: string;
  evidence: CustomerSignalEvidence[];
  recommendedAction?: CustomerRecommendedAction;
}

export interface CustomerRelationshipAssessment {
  score: number;
  confidence: number;
  level: CustomerAssessmentLevel;
  trend: CustomerAssessmentTrend;
  summaryVi: string;
  summaryEn: string;
  nextActionVi: string;
  nextActionEn: string;
  primaryAction?: CustomerRecommendedAction;
  signals: CustomerAssessmentSignal[];
}

export type SignalDraft = Omit<
  CustomerAssessmentSignal,
  "status" | "detectedAt" | "lastChangedAt"
>;
