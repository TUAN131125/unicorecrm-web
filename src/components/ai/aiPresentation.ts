import { parseCanonicalRoute, toWorkspacePath } from "@/platform/navigation";
import { useCallback, useSyncExternalStore } from "react";
import { resolveAiFocusedEntityRef, type AiFocusedEntityType } from "@/ai";
import type { AiContextWrapper } from "@/workspaces/crm/ai-context";

export const aiFocus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2";
/** Mount only the active layout's controls so hidden panel links cannot enter the modal focus cycle. */
export function useAiMediaQuery(query: string) {
  const subscribe = useCallback((notify: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", notify);
    return () => media.removeEventListener("change", notify);
  }, [query]);
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
export const aiEntityModules: Partial<Record<AiFocusedEntityType, string>> = { lead: "leads", contact: "contacts", organization: "organizations", customer: "customers", deal: "deals", task: "tasks" };
const names = { lead: ["Lead", "Lead"], contact: ["Liên hệ", "Contact"], organization: ["Tổ chức", "Organization"], customer: ["Khách hàng", "Customer"], deal: ["Cơ hội", "Deal"], task: ["Công việc", "Task"], quote: ["Báo giá", "Quote"], order: ["Đơn hàng", "Order"], case: ["Phiếu hỗ trợ", "Support case"], report: ["Báo cáo", "Report"] } as const;
export const aiEntityLabel = (type: AiFocusedEntityType, locale: "vi" | "en") => names[type][locale === "vi" ? 0 : 1];

export function aiSelectedRecord(context: AiContextWrapper, connected: boolean) {
  const focused = resolveAiFocusedEntityRef(context);
  return focused?.entityId && (!connected || aiEntityModules[focused.entityType]) ? focused : undefined;
}

export function aiRecordRoute(type: AiFocusedEntityType, id: string, workspaceKey: string) {
  const module = aiEntityModules[type];
  return module ? toWorkspacePath(workspaceKey, "crm", `${module}/${encodeURIComponent(id)}`) : undefined;
}

/** A navigation affordance is not a read grant; the destination still applies its owner guards. */
export function aiNavigationTarget(route: string, workspaceKey: string, canRead: (moduleKey: string) => boolean) {
  let decoded: string;
  try { decoded = decodeURIComponent(route.split(/[?#]/)[0]); }
  catch { return undefined; }
  if (decoded.includes("\\") || decoded.split("/").some(segment => segment === "." || segment === "..")) return undefined;
  const canonical = parseCanonicalRoute(route);
  if (canonical && (canonical.workspaceKey !== workspaceKey || canonical.productSpace !== "crm")) return undefined;
  if (!canonical && (!route.startsWith("/") || route.startsWith("//") || route.includes("://"))) return undefined;
  const relative = canonical?.relativePath ?? route.slice(1);
  const module = relative.split("/")[0];
  if (!module || !canRead(module)) return undefined;
  return toWorkspacePath(workspaceKey, "crm", relative);
}

export function aiRecordPrompts(type: AiFocusedEntityType, locale: "vi" | "en") {
  const label = aiEntityLabel(type, locale).toLocaleLowerCase(locale === "vi" ? "vi-VN" : "en-US");
  return locale === "vi" ? [`Tóm tắt ${label} này.`, "Những điểm nào cần chú ý?", "Tôi nên làm gì tiếp theo?", type === "task" ? "Cần làm rõ điều gì trước khi xử lý?" : "Gợi ý cách trao đổi với khách hàng."]
    : [`Summarize this ${label}.`, "What needs attention?", "What should I do next?", type === "task" ? "What should I clarify before proceeding?" : "Suggest how to follow up with the customer."];
}
