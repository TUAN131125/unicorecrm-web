import type { MetricLocaleText, MetricPeriod, MetricPeriodKey } from "../domain/metric.types";

function localParts(date: Date, timezone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: "year" | "month" | "day") => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function dateKey(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const PERIOD_LABELS: Record<MetricPeriodKey, MetricLocaleText> = {
  current_month: { vi: "Tháng hiện tại", en: "Current month" },
  current_quarter: { vi: "Quý hiện tại", en: "Current quarter" },
  current_year: { vi: "Năm hiện tại", en: "Current year" },
  all_time: { vi: "Toàn bộ thời gian", en: "All time" },
  custom: { vi: "Khoảng tùy chọn", en: "Custom range" },
};

export function resolveMetricPeriod(
  key: MetricPeriodKey,
  now: Date,
  timezone: string,
  customRange?: { startDate?: string; endDate?: string },
): MetricPeriod {
  if (key === "all_time") return { key, label: PERIOD_LABELS[key] };
  if (key === "custom") {
    const startDate = customRange?.startDate;
    const endDate = customRange?.endDate;
    if (!startDate || !endDate || startDate > endDate) {
      return { key, label: PERIOD_LABELS[key] };
    }
    return { key, startDate, endDate, label: PERIOD_LABELS[key] };
  }
  const { year, month } = localParts(now, timezone);
  if (key === "current_month") {
    return { key, startDate: dateKey(year, month, 1), endDate: dateKey(year, month, lastDayOfMonth(year, month)), label: PERIOD_LABELS[key] };
  }
  if (key === "current_quarter") {
    const firstMonth = Math.floor((month - 1) / 3) * 3 + 1;
    const lastMonth = firstMonth + 2;
    return { key, startDate: dateKey(year, firstMonth, 1), endDate: dateKey(year, lastMonth, lastDayOfMonth(year, lastMonth)), label: PERIOD_LABELS[key] };
  }
  return { key, startDate: dateKey(year, 1, 1), endDate: dateKey(year, 12, 31), label: PERIOD_LABELS[key] };
}

export function resolvePreviousMetricPeriod(period: MetricPeriod): MetricPeriod | undefined {
  if (!period.startDate || !period.endDate || period.key === "all_time") return undefined;
  const start = new Date(`${period.startDate}T00:00:00.000Z`);
  const end = new Date(`${period.endDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return undefined;
  const durationDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
  const previousEnd = new Date(start.getTime() - 86_400_000);
  const previousStart = new Date(previousEnd.getTime() - (durationDays - 1) * 86_400_000);
  const toDateKey = (value: Date) => value.toISOString().slice(0, 10);
  return {
    key: "custom",
    startDate: toDateKey(previousStart),
    endDate: toDateKey(previousEnd),
    label: { vi: "Kỳ trước", en: "Previous period" },
  };
}

export function resolvePreviousMonthPeriod(now: Date, timezone: string): MetricPeriod {
  const { year, month } = localParts(now, timezone);
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  return {
    key: "current_month",
    startDate: dateKey(previousYear, previousMonth, 1),
    endDate: dateKey(previousYear, previousMonth, lastDayOfMonth(previousYear, previousMonth)),
    label: { vi: "Tháng trước", en: "Previous month" },
  };
}

export function toTimezoneDateKey(value: string | undefined, timezone: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const { year, month, day } = localParts(date, timezone);
  return dateKey(year, month, day);
}

export function isDateInMetricPeriod(value: string | undefined, period: MetricPeriod, timezone: string): boolean {
  if (period.key === "all_time") return Boolean(value);
  const key = toTimezoneDateKey(value, timezone);
  return Boolean(key && period.startDate && period.endDate && key >= period.startDate && key <= period.endDate);
}
