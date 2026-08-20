import React from "react";
import { createPortal } from "react-dom";
import { Bot, Sparkles } from "lucide-react";
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
      whileHover={reduceMotion ? undefined : { y: -3, scale: 1.02 }}
      whileTap={reduceMotion ? undefined : { scale: 0.94, rotate: -2 }}
      className="group fixed z-[5000] inline-flex h-12 items-center gap-2 rounded-full border border-white/70 bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-500 px-2.5 text-white shadow-[0_16px_40px_-14px_rgba(79,70,229,0.75)] outline-none transition focus-visible:ring-4 focus-visible:ring-violet-500/25 sm:h-13 sm:px-3.5"
      title={label}
      aria-label={label}
      data-ai-floating-utility="enterprise"
      data-ai-viewport-anchor="fixed"
      style={{
        ...viewportSafeAreaStyle,
        right: "var(--crm-floating-utility-right)",
        bottom: "calc(var(--crm-floating-utility-bottom) + var(--crm-mobile-action-height) + var(--crm-floating-utility-gap))",
        zIndex: 5000,
      }}
    >
      <motion.span
        className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white text-violet-700 shadow-sm"
        aria-hidden="true"
        animate={reduceMotion ? undefined : { rotate: [0, -4, 4, 0] }}
        transition={reduceMotion ? undefined : { duration: 2.8, repeat: Infinity, repeatDelay: 2.4 }}
      >
        <Bot className="h-[18px] w-[18px]" strokeWidth={2.1} />
        <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-amber-200 p-0.5 text-amber-700 shadow-sm" />
      </motion.span>
      <span className="hidden pr-0.5 text-xs font-semibold sm:inline">{locale === "vi" ? "Trợ lý AI" : "AI assistant"}</span>
    </motion.button>,
    document.body,
  );
};
