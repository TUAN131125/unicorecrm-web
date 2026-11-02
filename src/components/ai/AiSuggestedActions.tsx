import React, { useState } from "react";
import { ArrowUpRight, Check, Copy, HelpCircle, ListChecks } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { parseCanonicalRoute } from "@/platform/navigation";
import { useEffectiveAccess } from "@/platform/access-control";
import { useI18n } from "@/i18n";
import { toAiActionIntent, type AiActionIntent } from "@/ai";
import { AiSuggestedAction } from "../../ai/aiTypes";
import { aiFocus, aiNavigationTarget } from "./aiPresentation";

interface AiSuggestedActionsProps {
  actions: AiSuggestedAction[];
  onTriggerToast?: (message: string) => void;
  evidence?: boolean;
  onNavigate?: () => void;
  /**
   * Executes CRM-effecting intents through the AI action application service.
   * Client-only intents (navigate, copy, draft) never reach it.
   */
  onExecuteIntent?: (intent: AiActionIntent) => void | Promise<void>;
}

export const AiSuggestedActions: React.FC<AiSuggestedActionsProps> = ({ actions, evidence, onNavigate, onTriggerToast, onExecuteIntent }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { locale } = useI18n();
  const access = useEffectiveAccess();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const isVi = locale === "vi";

  const resolveNavigationRoute = (route: string) => {
    const canonical = parseCanonicalRoute(location.pathname);
    return canonical ? aiNavigationTarget(route, canonical.workspaceKey, access.canAccessModule) : undefined;
  };

  const copyToClipboard = async (actionId: string, payload: string, toast: string) => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopiedId(actionId);
      window.setTimeout(() => setCopiedId(null), 2500);
      onTriggerToast?.(toast);
    } catch {
      onTriggerToast?.(isVi ? "Không thể sao chép. Bạn có thể chọn và sao chép nội dung trực tiếp." : "Could not copy. Select and copy the text directly.");
    }
  };

  const handleAction = async (action: AiSuggestedAction) => {
    const intent = toAiActionIntent(action);

    if (intent.type === "NAVIGATE") {
      const target = resolveNavigationRoute(intent.route);
      if (!target) return;
      navigate(target);
      onNavigate?.();
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
    <div className="mt-4">
      {evidence && <h3 className="mb-2 text-xs font-medium text-slate-500">{isVi ? "Nguồn dữ liệu CRM" : "CRM sources"}</h3>}
      <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const intent = toAiActionIntent(action);
        const isCopy = intent.type === "COPY" || intent.type === "DRAFT_MESSAGE";
        const isNavigate = intent.type === "NAVIGATE";
        const isCommand = intent.type === "CREATE_TASK";
        const isCopied = copiedId === action.id;
        if ((isCommand && !onExecuteIntent) || (intent.type === "NAVIGATE" && !resolveNavigationRoute(intent.route)) || intent.type === "NONE") return null;

        return (
          <button
            key={action.id}
            type="button"
            onClick={() => void handleAction(action)}
            id={`suggested-action-${action.id}`}
            data-ai-action-intent={intent.type}
            title={action.description}
            className={`flex min-h-10 max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[13px] font-medium text-slate-700 hover:border-violet-300 hover:bg-violet-50/40 ${aiFocus}`}
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
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">{action.label}</span>
          </button>
        );
      })}
      </div>
    </div>
  );
};
