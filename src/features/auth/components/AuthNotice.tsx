import React from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";

type Tone = "info" | "success" | "warning" | "danger";

interface AuthNoticeProps {
  tone?: Tone;
  children: React.ReactNode;
}

const toneClass: Record<Tone, string> = {
  info: "border-sky-200 bg-sky-50/80 text-sky-800",
  success: "border-emerald-200 bg-emerald-50/80 text-emerald-800",
  warning: "border-amber-200 bg-amber-50/80 text-amber-900",
  danger: "border-rose-200 bg-rose-50/80 text-rose-800",
};

const icons: Record<Tone, React.ReactNode> = {
  info: <Info size={15} />,
  success: <CheckCircle2 size={15} />,
  warning: <TriangleAlert size={15} />,
  danger: <AlertCircle size={15} />,
};

export const AuthNotice: React.FC<AuthNoticeProps> = ({ tone = "info", children }) => (
  <div role={tone === "danger" ? "alert" : "status"} className={`flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 text-xs font-medium leading-5 ${toneClass[tone]}`}>
    <span className="mt-0.5 shrink-0">{icons[tone]}</span>
    <div>{children}</div>
  </div>
);
