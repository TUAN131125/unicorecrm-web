import React, { useState } from "react";
import { ArrowUpRight, Check, Copy, HelpCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { parseCanonicalRoute, toWorkspacePath } from "@/platform/navigation";
import { useI18n } from "@/i18n";
import { AiSuggestedAction } from "../../ai/aiTypes";

interface AiSuggestedActionsProps {
  actions: AiSuggestedAction[];
  onTriggerToast?: (message: string) => void;
}

export const AiSuggestedActions: React.FC<AiSuggestedActionsProps> = ({ actions, onTriggerToast }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { locale } = useI18n();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const isVi = locale === "vi";

  const resolveNavigationRoute = (route: string) => {
    const canonical = parseCanonicalRoute(location.pathname);
    if (!canonical || !route.startsWith("/") || route.startsWith("/w/")) return route;
    return toWorkspacePath(canonical.workspaceKey, canonical.productSpace, route.replace(/^\//, ""));
  };

  const handleAction = async (action: AiSuggestedAction) => {
    if (action.actionType === "navigate" && action.route) {
      const route = resolveNavigationRoute(action.route);
      navigate(route);
      onTriggerToast?.(isVi ? "Đã mở hồ sơ liên quan." : "Related record opened.");
      return;
    }

    if (action.actionType === "copy" && action.payload) {
      await navigator.clipboard.writeText(action.payload);
      setCopiedId(action.id);
      window.setTimeout(() => setCopiedId(null), 2500);
      onTriggerToast?.(isVi ? "Đã sao chép bản nháp." : "Draft copied.");
    }
  };

  if (!actions.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {actions.map((action) => {
        const isCopy = action.actionType === "copy";
        const isNavigate = action.actionType === "navigate";
        const isCopied = copiedId === action.id;

        return (
          <button
            key={action.id}
            type="button"
            onClick={() => void handleAction(action)}
            id={`suggested-action-${action.id}`}
            className={`flex min-h-8 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[10px] font-extrabold transition-all hover:-translate-y-0.5 hover:shadow-sm ${
              isCopy
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : isNavigate
                  ? "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            {isCopy ? (
              isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />
            ) : isNavigate ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <HelpCircle className="h-3.5 w-3.5" />
            )}
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
};
