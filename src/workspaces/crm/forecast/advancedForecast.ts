import type { Deal, DealForecastCategory } from "@/modules/deals";
import { loadFromStorage, saveToStorage } from "@/shared/lib/storage/localStorage";

export interface ForecastCategorySummary {
  category: DealForecastCategory;
  dealCount: number;
  amount: number;
  weightedAmount: number;
}

export interface ForecastOwnerSummary {
  ownerId: string;
  dealCount: number;
  amount: number;
  weightedAmount: number;
}

export interface AdvancedForecastSnapshot {
  snapshotId: string;
  workspaceId: string;
  capturedAt: string;
  periodStart: string;
  periodEnd: string;
  categories: ForecastCategorySummary[];
  owners: ForecastOwnerSummary[];
  totalAmount: number;
  weightedAmount: number;
  commitAmount: number;
  actualWonAmount?: number;
  accuracyPercent?: number;
}

const categoryOrder: DealForecastCategory[] = ["COMMIT", "BEST_CASE", "PIPELINE"];
const keyFor = (workspaceId: string) => `unicore_advanced_forecast_v1:${workspaceId}`;
const asTime = (value?: string) => value ? new Date(value).getTime() : Number.NaN;

export function buildAdvancedForecastSnapshot(input: { workspaceId: string; deals: Deal[]; periodStart: string; periodEnd: string; capturedAt?: string }): AdvancedForecastSnapshot {
  const start = new Date(input.periodStart).getTime();
  const end = new Date(input.periodEnd).getTime();
  const active = input.deals.filter((deal) => {
    const close = asTime(deal.expectedCloseDate);
    return Number.isFinite(close) && close >= start && close <= end && !["WON", "LOST"].includes(String(deal.stage).toUpperCase());
  });
  const categories = categoryOrder.map((category) => {
    const rows = active.filter((deal) => (deal.forecastCategory ?? "PIPELINE") === category);
    return { category, dealCount: rows.length, amount: rows.reduce((sum, deal) => sum + deal.amount, 0), weightedAmount: rows.reduce((sum, deal) => sum + deal.amount * Math.max(0, Math.min(100, deal.opportunityScore || 0)) / 100, 0) };
  });
  const ownerMap = new Map<string, Deal[]>();
  active.forEach((deal) => ownerMap.set(deal.ownerId, [...(ownerMap.get(deal.ownerId) ?? []), deal]));
  const owners = [...ownerMap.entries()].map(([ownerId, rows]) => ({ ownerId, dealCount: rows.length, amount: rows.reduce((sum, deal) => sum + deal.amount, 0), weightedAmount: rows.reduce((sum, deal) => sum + deal.amount * Math.max(0, Math.min(100, deal.opportunityScore || 0)) / 100, 0) })).sort((a, b) => b.weightedAmount - a.weightedAmount);
  return { snapshotId: `forecast_${Date.now()}`, workspaceId: input.workspaceId, capturedAt: input.capturedAt ?? new Date().toISOString(), periodStart: input.periodStart, periodEnd: input.periodEnd, categories, owners, totalAmount: categories.reduce((sum, item) => sum + item.amount, 0), weightedAmount: categories.reduce((sum, item) => sum + item.weightedAmount, 0), commitAmount: categories.find((item) => item.category === "COMMIT")?.amount ?? 0 };
}

export function reconcileForecastAccuracy(snapshot: AdvancedForecastSnapshot, deals: Deal[]): AdvancedForecastSnapshot {
  const start = new Date(snapshot.periodStart).getTime();
  const end = new Date(snapshot.periodEnd).getTime();
  const actualWonAmount = deals.filter((deal) => String(deal.stage).toUpperCase() === "WON" && Number.isFinite(asTime(deal.actualCloseDate ?? deal.wonAt)) && asTime(deal.actualCloseDate ?? deal.wonAt) >= start && asTime(deal.actualCloseDate ?? deal.wonAt) <= end).reduce((sum, deal) => sum + deal.amount, 0);
  const predicted = snapshot.commitAmount;
  const denominator = Math.max(predicted, actualWonAmount, 1);
  const accuracyPercent = Math.max(0, Math.round((1 - Math.abs(predicted - actualWonAmount) / denominator) * 1000) / 10);
  return { ...snapshot, actualWonAmount, accuracyPercent };
}

export function saveForecastSnapshot(snapshot: AdvancedForecastSnapshot): void {
  const existing = loadForecastSnapshots(snapshot.workspaceId);
  saveToStorage(keyFor(snapshot.workspaceId), [snapshot, ...existing.filter((item) => item.snapshotId !== snapshot.snapshotId)].slice(0, 24));
}

export function loadForecastSnapshots(workspaceId: string): AdvancedForecastSnapshot[] {
  return loadFromStorage<AdvancedForecastSnapshot[]>(keyFor(workspaceId), []);
}

export function buildForecastTrend(snapshots: AdvancedForecastSnapshot[]): Array<{ capturedAt: string; commit: number; bestCase: number; pipeline: number; weighted: number; accuracy?: number }> {
  return [...snapshots].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)).map((snapshot) => ({ capturedAt: snapshot.capturedAt, commit: snapshot.categories.find((item) => item.category === "COMMIT")?.amount ?? 0, bestCase: snapshot.categories.find((item) => item.category === "BEST_CASE")?.amount ?? 0, pipeline: snapshot.categories.find((item) => item.category === "PIPELINE")?.amount ?? 0, weighted: snapshot.weightedAmount, accuracy: snapshot.accuracyPercent }));
}
