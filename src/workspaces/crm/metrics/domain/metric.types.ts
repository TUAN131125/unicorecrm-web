import type { Capability } from "@/platform/access-control";

export type MetricLocaleText = { vi: string; en: string };

export type MetricPeriodKey = "current_month" | "current_quarter" | "current_year" | "all_time" | "custom";

export type MetricValueKind = "currency" | "count" | "percentage";

export type MetricStatus = "READY" | "NO_DATA" | "PARTIAL";

export type MetricSourceModule = "leads" | "deals" | "quotes" | "orders" | "customers" | "support";

export interface MetricPeriod {
  key: MetricPeriodKey;
  startDate?: string;
  endDate?: string;
  label: MetricLocaleText;
}

export interface MetricDefinition {
  id: string;
  title: MetricLocaleText;
  description: MetricLocaleText;
  formula: MetricLocaleText;
  sourceModules: MetricSourceModule[];
  includedStates: MetricLocaleText[];
  dateField: MetricLocaleText;
  valueKind: MetricValueKind;
  requiredCapabilities: Capability[];
  periodMode: "PERIOD" | "SNAPSHOT";
  owner: string;
  version: number;
}

export interface MetricSourceRecord {
  id: string;
  module: MetricSourceModule;
  primaryText: string;
  secondaryText?: string;
  status?: string;
  occurredAt?: string;
  amount?: number;
  route: string;
}

export interface MetricComparison {
  previousValue: number;
  delta: number;
  deltaPercent?: number;
  status: "AVAILABLE" | "UNAVAILABLE";
  reason?: MetricLocaleText;
}

export interface MetricResult {
  definition: MetricDefinition;
  value: number;
  numerator?: number;
  denominator?: number;
  status: MetricStatus;
  period: MetricPeriod;
  timezone: string;
  lastUpdatedAt?: string;
  records: MetricSourceRecord[];
  comparison?: MetricComparison;
}

export interface CohortFunnelStage {
  id: "leads" | "qualified" | "deals" | "quotes" | "accepted_quotes" | "orders" | "completed_orders";
  label: MetricLocaleText;
  count: number;
  percentageOfCohort: number;
  sourceRecordIds: string[];
}

export interface CohortFunnelResult {
  mode: "COHORT";
  definition: MetricLocaleText;
  period: MetricPeriod;
  timezone: string;
  lastUpdatedAt?: string;
  stages: CohortFunnelStage[];
}
