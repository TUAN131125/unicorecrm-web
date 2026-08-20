import React, { useMemo, useState } from "react";
import { BookOpen, Search, Workflow, CircleHelp } from "lucide-react";
import { searchGuidance } from "@/guidance/application/guidanceSearch";
import { localize } from "@/guidance/domain/guidance.rules";
import { FIELD_GUIDANCE_BY_KEY, SCREEN_GUIDANCE_BY_ID, WORKFLOW_GUIDANCE_BY_ID } from "@/guidance/application/guidanceRegistry";
import { useGuidance } from "./GuidanceContext";

export const GuidanceSearch: React.FC = () => {
  const guidance = useGuidance();
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchGuidance(query, guidance.locale, guidance.productSpace, guidance.can), [query, guidance.locale, guidance.productSpace, guidance.can]);
  const vi = guidance.locale === "vi";

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus-within:border-violet-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-500/10">
        <Search size={16} className="shrink-0 text-slate-400" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={vi ? "Tìm màn hình, tác vụ, thuật ngữ hoặc lỗi…" : "Search screens, tasks, terms, or errors…"} className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400" />
      </label>
      {query.trim() && (
        <div className="space-y-1.5">
          {results.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-xs font-semibold text-slate-400">{vi ? "Không tìm thấy nội dung phù hợp." : "No matching guidance found."}</div>
          ) : results.map((result) => {
            const Icon = result.kind === "screen" ? BookOpen : result.kind === "workflow" ? Workflow : CircleHelp;
            return (
              <button
                key={`${result.kind}:${result.id}`}
                type="button"
                onClick={() => {
                  if (result.kind === "screen") {
                    const item = SCREEN_GUIDANCE_BY_ID.get(result.id);
                    if (item) guidance.setSelection({ kind: "screen", item });
                  } else if (result.kind === "workflow") {
                    const item = WORKFLOW_GUIDANCE_BY_ID.get(result.id);
                    if (item) guidance.setSelection({ kind: "workflow", item });
                  } else {
                    const item = FIELD_GUIDANCE_BY_KEY.get(result.id);
                    if (item) guidance.setSelection({ kind: "field", item });
                  }
                }}
                className="flex w-full items-start gap-3 rounded-xl border border-transparent px-3 py-3 text-left hover:border-violet-100 hover:bg-violet-50/70"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Icon size={15} /></span>
                <span className="min-w-0">
                  <span className="block text-xs font-extrabold text-slate-900">{localize(result.title, guidance.locale)}</span>
                  <span className="mt-1 crm-text-wrap block text-[11px] font-medium leading-4 text-slate-500">{localize(result.summary, guidance.locale)}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
