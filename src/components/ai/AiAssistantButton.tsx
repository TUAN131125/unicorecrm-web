import React from "react";
import { createPortal } from "react-dom";
import { Bot } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useI18n } from "../../i18n";

interface AiAssistantButtonProps {
  onClick: () => void;
}

export const AiAssistantButton: React.FC<AiAssistantButtonProps> = ({ onClick }) => {
  const { locale } = useI18n();
  const reduceMotion = useReducedMotion();
  const label = locale === "vi" ? "Mở trợ lý AI" : "Open AI assistant";
  const viewportSafeAreaStyle: React.CSSProperties = {
    position: "fixed",
    right: "max(1rem, env(safe-area-inset-right))",
    bottom: "max(1rem, env(safe-area-inset-bottom))",
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <motion.button
      id="floating-ai-assistant-btn"
      type="button"
      onClick={onClick}
      whileHover={reduceMotion ? undefined : { y: -1 }}
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      className="group fixed z-[5000] inline-flex h-11 items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 text-violet-800 shadow-sm outline-none hover:bg-violet-50 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
      title={label}
      aria-label={label}
      data-ai-floating-utility="enterprise"
      data-i18n-skip="true"
      data-ai-viewport-anchor="fixed"
      style={{
        ...viewportSafeAreaStyle,
        right: "var(--crm-floating-utility-right)",
        bottom: "calc(var(--crm-floating-utility-bottom) + var(--crm-mobile-action-height) + var(--crm-floating-utility-gap))",
        zIndex: 5000,
      }}
    >
      <span className="flex h-5 w-5 items-center justify-center" aria-hidden="true">
        <Bot className="h-[18px] w-[18px]" strokeWidth={2.1} />
      </span>
      <span className="hidden pr-0.5 text-xs font-semibold sm:inline">{locale === "vi" ? "Trợ lý AI" : "AI assistant"}</span>
    </motion.button>,
    document.body,
  );
};
