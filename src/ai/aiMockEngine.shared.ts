import type { AiSuggestedAction } from "./aiTypes";
import type { CustomerRecommendedAction } from "@/modules/customers";

export const makeAiId = (prefix: string): string =>
  `${prefix}_${Math.random().toString(36).substring(2, 11)}`;

export function actionToSuggestedActions(
  action: CustomerRecommendedAction | undefined,
  customerId: string,
  lang: "vi" | "en",
): AiSuggestedAction[] {
  if (!action) return [];
  let route = `/customers/${customerId}`;
  if (
    action.actionType === "OPEN_RECORD" &&
    action.targetModule &&
    action.targetRecordId
  ) {
    route = `/${action.targetModule}/${action.targetRecordId}`;
  } else if (action.actionType === "CREATE_OPPORTUNITY") {
    route = "/deals";
  } else if (action.actionType === "CREATE_TASK") {
    route = "/tasks";
  }
  return [
    {
      id: makeAiId("sa"),
      label: lang === "vi" ? action.labelVi : action.labelEn,
      actionType: "navigate",
      route,
    },
  ];
}

export function formatAiMoney(value: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value || 0)} ₫`;
}
