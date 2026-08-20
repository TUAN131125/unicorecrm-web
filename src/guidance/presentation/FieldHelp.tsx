import React from "react";
import { CircleHelp } from "lucide-react";
import { FIELD_GUIDANCE_BY_KEY } from "@/guidance/application/guidanceRegistry";
import { localize } from "@/guidance/domain/guidance.rules";
import { useGuidance } from "./GuidanceContext";

export const FieldHelp: React.FC<{ helpKey: string; className?: string }> = ({ helpKey, className }) => {
  const guidance = useGuidance();
  const field = FIELD_GUIDANCE_BY_KEY.get(helpKey);
  if (!field) return null;
  const label = guidance.locale === "vi" ? `Giải thích: ${localize(field.title, guidance.locale)}` : `Help: ${localize(field.title, guidance.locale)}`;
  return (
    <button type="button" onClick={() => guidance.openFieldHelp(helpKey)} className={className || "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"} aria-label={label} title={label}>
      <CircleHelp size={15} />
    </button>
  );
};
