import React from "react";
import { UserRound, UsersRound, ShieldCheck } from "lucide-react";
import type { OwnershipScopeView, RecordOwnershipContext } from "@/platform/record-ownership";

interface OwnershipScopeSelectorProps {
  value: OwnershipScopeView;
  onChange: (value: OwnershipScopeView) => void;
  context: RecordOwnershipContext | null;
  locale: string;
  counts?: Partial<Record<OwnershipScopeView, number>>;
  guidancePrefix: string;
  compact?: boolean;
}

export const OwnershipScopeSelector: React.FC<OwnershipScopeSelectorProps> = ({
  value,
  onChange,
  context,
  locale,
  counts = {},
  guidancePrefix,
  compact = false,
}) => {
  if (!context) return null;
  const options: Array<{ value: OwnershipScopeView; vi: string; en: string; icon: React.ReactNode }> = [
    { value: "MINE", vi: "Của tôi", en: "Mine", icon: <UserRound size={13} /> },
    { value: "TEAM", vi: "Của đội", en: "My team", icon: <UsersRound size={13} /> },
    { value: "ALLOWED", vi: "Được phép xem", en: "Allowed", icon: <ShieldCheck size={13} /> },
  ];

  return (
    <div
      className={`inline-flex max-w-full items-center rounded-xl ${compact ? "gap-0.5 border border-transparent bg-transparent p-0" : "gap-1 overflow-x-auto border border-slate-200 bg-slate-50 p-1"}`}
      role="group"
      aria-label={locale === "vi" ? "Phạm vi bản ghi" : "Record scope"}
      data-guidance-id={`${guidancePrefix}.scope`}
      data-ownership-scope-density={compact ? "compact" : "comfortable"}
    >
      {options.map((option) => {
        const label = locale === "vi" ? option.vi : option.en;
        const count = counts[option.value];
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-label={typeof count === "number" ? `${label}: ${count}` : label}
            title={typeof count === "number" ? `${label}: ${count}` : label}
            aria-pressed={value === option.value}
            data-guidance-id={`${guidancePrefix}.scope.${option.value.toLowerCase()}`}
            className={`relative inline-flex h-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-medium transition ${compact ? "min-w-8 gap-1 px-2" : "gap-1.5 px-2.5"} ${
              value === option.value
                ? "bg-white text-violet-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-500 hover:bg-white/70 hover:text-slate-700"
            }`}
          >
            {option.icon}
            <span className={compact ? "sr-only" : undefined}>{label}</span>
            {typeof count === "number" ? (
              <span className={`${compact ? "min-w-4 px-1" : "px-1.5"} rounded-full bg-slate-100 py-0.5 text-[9px] leading-none text-slate-500`}>{count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
};
