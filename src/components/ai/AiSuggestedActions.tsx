import React, { useState } from "react";
import { ArrowUpRight, Check, Copy, HelpCircle, ListChecks } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { parseCanonicalRoute, toWorkspacePath } from "@/platform/navigation";
import { useI18n } from "@/i18n";
import { toAiActionIntent, type AiActionIntent } from "@/ai";
import { AiSuggestedAction } from "../../ai/aiTypes";

interface AiSuggestedActionsProps {
  actions: AiSuggestedAction[];
  onTriggerToast?: (message: string) => void;
  /**
   * Executes CRM-effecting intents through the AI action application service.
   * Client-only intents (navigate, copy, draft) never reach it.
   */
  onExecuteIntent?: (intent: AiActionIntent) => void | Promise<void>;
}

export const AiSuggestedActions: React.FC<AiSuggestedActionsProps> = ({ actions, onTriggerToast, onExecuteIntent }) => {
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

  const copyToClipboard = async (actionId: string, payload: string, toast: string) => {
    await navigator.clipboard.writeText(payload);
    setCopiedId(actionId);
    window.setTimeout(() => setCopiedId(null), 2500);
    onTriggerToast?.(toast);
  };

  const handleAction = async (action: AiSuggestedAction) => {
    const intent = toAiActionIntent(action);

    if (intent.type === "NAVIGATE") {
      navigate(resolveNavigationRoute(intent.route));
      onTriggerToast?.(isVi ? "Đã mở hồ sơ liên quan." : "Related record opened.");
      return;
    }

    if (intent.type === "COPY") {
      await copyToClipboard(action.id, intent.payload, isVi ? "Đã sao chép bản nháp." : "Draft copied.");
      return;
    }

    if (intent.type === "DRAFT_MESSAGE") {
      await copyToClipboard(action.id, intent.body, isVi ? "Đã sao chép bản nháp." : "Draft copied.");
      return;
    }

    if (intent.type === "NONE") return;

    // CREATE_TASK and every future CRM-effecting intent must pass through the
    // AI action application service; this component never mutates CRM state.
    await onExecuteIntent?.(intent);
  };

  if (!actions.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {actions.map((action) => {
        const intent = toAiActionIntent(action);
        const isCopy = intent.type === "COPY" || intent.type === "DRAFT_MESSAGE";
        const isNavigate = intent.type === "NAVIGATE";
        const isCommand = intent.type === "CREATE_TASK";
        const isCopied = copiedId === action.id;
        const isDisabled = isCommand && !onExecuteIntent;

        return (
          <button
            key={action.id}
            type="button"
            disabled={isDisabled}
            onClick={() => void handleAction(action)}
            id={`suggested-action-${action.id}`}
            data-ai-action-intent={intent.type}
            className={`flex min-h-8 items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[10px] font-extrabold transition-all hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40 ${
              isCopy
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : isNavigate
                  ? "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100"
                  : isCommand
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            }`}
          >
            {isCopy ? (
              isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />
            ) : isNavigate ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : isCommand ? (
              <ListChecks className="h-3.5 w-3.5" />
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
