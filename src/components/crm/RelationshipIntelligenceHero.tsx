import React, { useState } from "react";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";

export interface RelationshipIntelligenceMetric {
  id: string;
  label: string;
  value: string;
  help?: string;
}

export interface RelationshipIntelligenceItem {
  id: string;
  label: string;
  detail?: string;
  value?: string;
  tone?: "positive" | "attention" | "risk" | "neutral";
}

export interface RelationshipIntelligenceSection {
  id: string;
  title: string;
  items: RelationshipIntelligenceItem[];
}

interface RelationshipIntelligenceHeroProps {
  eyebrow: string;
  title: string;
  summary: string;
  badgeLabel?: string;
  badgeTone?: "emerald" | "amber" | "rose" | "sky" | "violet";
  metrics?: RelationshipIntelligenceMetric[];
  highlights?: RelationshipIntelligenceItem[];
  detailSections?: RelationshipIntelligenceSection[];
  detailsLabel?: string;
}

export const RelationshipIntelligenceHero: React.FC<RelationshipIntelligenceHeroProps> = ({
  eyebrow,
  title,
  summary,
  badgeLabel,
  badgeTone = "violet",
  metrics = [],
  highlights = [],
  detailSections = [],
  detailsLabel = "Xem phân tích chi tiết",
}) => {
  const [expanded, setExpanded] = useState(false);
  const visibleMetrics = metrics.slice(0, 3);
  const visibleHighlights = highlights.slice(0, 2);
  const availableSections = detailSections.filter((section) => section.items.length > 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-sm font-black text-violet-700">
              <Sparkles size={16} className="text-violet-600" />
              <span>{eyebrow}</span>
              {badgeLabel ? <HeroBadge tone={badgeTone} label={badgeLabel} /> : null}
            </div>
            <h2 className="mt-2 text-lg font-black tracking-tight text-slate-950 sm:text-xl">{title}</h2>
            </div>

          {visibleMetrics.length > 0 ? (
            <div className="grid shrink-0 gap-2 sm:grid-cols-3 xl:min-w-[390px]">
              {visibleMetrics.map((metric) => (
                <div key={metric.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400">{metric.label}</div>
                  <div className="mt-1 text-base font-black text-slate-950">{metric.value}</div>
                  {metric.help ? <div className="mt-1 text-[9px] font-medium leading-4 text-slate-500">{metric.help}</div> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {visibleHighlights.length > 0 ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {visibleHighlights.map((item) => (
              <ReportItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : null}

        {availableSections.length > 0 ? (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-violet-700 hover:text-violet-800"
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {expanded ? "Thu gọn phân tích" : detailsLabel}
            </button>
          </div>
        ) : null}
      </div>

      {expanded && availableSections.length > 0 ? (
        <div className="grid gap-4 border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5 lg:grid-cols-2">
          {availableSections.map((section) => (
            <div key={section.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-[10px] font-black uppercase tracking-wide text-slate-700">{section.title}</div>
              <div className="mt-3 space-y-2">
                {section.items.map((item) => (
                  <ReportItemCard key={item.id} item={item} compact />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
};

const ReportItemCard: React.FC<{ item: RelationshipIntelligenceItem; compact?: boolean }> = ({ item, compact }) => (
  <div className={`flex min-w-0 gap-2.5 rounded-xl border border-slate-200 bg-white ${compact ? "p-2.5" : "p-3"}`}>
    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${toneDotClass(item.tone)}`} />
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 text-[11px] font-extrabold leading-4 text-slate-900">{item.label}</div>
        {item.value ? <div className="shrink-0 text-[11px] font-black text-slate-700">{item.value}</div> : null}
      </div>
      {item.detail ? <div className="mt-1 text-[10px] leading-4 text-slate-500">{item.detail}</div> : null}
    </div>
  </div>
);

const HeroBadge: React.FC<{ tone: NonNullable<RelationshipIntelligenceHeroProps["badgeTone"]>; label: string }> = ({ tone, label }) => (
  <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wide ${badgeClass(tone)}`}>{label}</span>
);

function badgeClass(tone: NonNullable<RelationshipIntelligenceHeroProps["badgeTone"]>): string {
  switch (tone) {
    case "emerald": return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "amber": return "border-amber-200 bg-amber-50 text-amber-700";
    case "rose": return "border-rose-200 bg-rose-50 text-rose-700";
    case "sky": return "border-sky-200 bg-sky-50 text-sky-700";
    default: return "border-violet-200 bg-violet-50 text-violet-700";
  }
}

function toneDotClass(tone: RelationshipIntelligenceItem["tone"]): string {
  switch (tone) {
    case "positive": return "bg-emerald-500";
    case "attention": return "bg-amber-400";
    case "risk": return "bg-rose-500";
    default: return "bg-sky-400";
  }
}
