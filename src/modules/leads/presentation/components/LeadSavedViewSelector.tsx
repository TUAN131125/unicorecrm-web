import React from "react";
import { ChevronDown, X } from "lucide-react";
import { useI18n } from "@/i18n";

interface LeadSavedViewOption {
  key: string;
  labelKey: string;
  isShared: boolean;
  icon?: string;
}

interface LeadSavedViewSelectorProps {
  customViews: LeadSavedViewOption[];
  activeView: string;
  onSelectView: (view: string) => void;
  isViewDropdownOpen: boolean;
  setIsViewDropdownOpen: (open: boolean) => void;
  leadsCount: number;
  onDeleteCustomView: (key: string) => void;
  onAddViewClick?: () => void;
  isAddViewOpen?: boolean;
  setIsAddViewOpen?: (open: boolean) => void;
}

export const LeadSavedViewSelector: React.FC<LeadSavedViewSelectorProps> = ({
  customViews,
  activeView,
  onSelectView,
  isViewDropdownOpen,
  setIsViewDropdownOpen,
  leadsCount,
  onDeleteCustomView,
  onAddViewClick = () => {},
  isAddViewOpen: _isAddViewOpen,
  setIsAddViewOpen: _setIsAddViewOpen,
}) => {
  const { t } = useI18n();

  const translateOrFallback = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const normalizeViewLabelKey = (labelKey: string) => {
    return labelKey
      .replace(/^leads\.customViews\.views\./, "")
      .replace(/^leads\.customViews\./, "");
  };

  const getMisaViewLabel = (view: LeadSavedViewOption) => {
    if (view.key.startsWith("custom_")) {
      return view.labelKey;
    }

    const normalizedLabelKey = normalizeViewLabelKey(view.labelKey || view.key);
    return translateOrFallback(`leads.customViews.${normalizedLabelKey}`, normalizedLabelKey);
  };

  const activeViewObj = customViews.find(v => v.key === activeView) || customViews[0];

  return (
    <div className="relative min-w-0 max-w-full font-sans">
      <button
        id="misa-view-dropdown-trigger"
        type="button"
        onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
        className="inline-flex h-10 max-w-[220px] items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-bold text-slate-800 shadow-sm transition-all hover:bg-slate-100 sm:max-w-[260px]"
      >
        <span className="min-w-0 crm-text-wrap text-indigo-600">
          {getMisaViewLabel(activeViewObj)}
        </span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>

      {isViewDropdownOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsViewDropdownOpen(false)} />
          <div className="absolute left-0 z-[3300] mt-2 max-h-[min(460px,calc(100vh-8rem))] w-[min(18rem,calc(100vw-2rem))] divide-y divide-slate-100 overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-xl crm-scroll-y">
            
            {/* Category: Shared */}
            <div className="pb-3 text-left">
              <p className="text-[10px] font-extrabold text-slate-400 tracking-wider mb-2 uppercase">
                {translateOrFallback("leads.customViews.shareWithMe", "CHIA SẺ VỚI TÔI")}
              </p>
              <div className="space-y-1">
                {customViews.filter(v => v.isShared).map(v => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => onSelectView(v.key)}
                    className={`w-full flex items-center justify-between text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                      activeView === v.key ? "bg-indigo-50 text-indigo-700 font-bold" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span>{v.icon === "all" ? "📂" : v.icon === "my" ? "👤" : v.icon === "team" ? "👥" : "✅"}</span>
                      <span className="crm-text-wrap">{getMisaViewLabel(v)}</span>
                    </div>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold shrink-0">
                      {leadsCount}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Category: Created by Me */}
            <div className="pt-3 pb-3 text-left">
              <p className="text-[10px] font-extrabold text-slate-400 tracking-wider mb-2 uppercase">
                {translateOrFallback("leads.customViews.createdByMe", "TẠO BỞI TÔI")}
              </p>
              <div className="space-y-1">
                {customViews.filter(v => !v.isShared).map(v => (
                  <div
                    key={v.key}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold group ${
                      activeView === v.key ? "bg-indigo-50 text-indigo-700 font-bold" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectView(v.key)}
                      className="flex-1 text-left flex items-center gap-1.5 min-w-0"
                    >
                      <span className="shrink-0">💡</span>
                      <span className="crm-text-wrap">{getMisaViewLabel(v)}</span>
                    </button>
                    
                    {/* Allow delete if custom created */}
                    {v.key.startsWith("custom_") ? (
                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); onDeleteCustomView(v.key); }}
                        aria-label={translateOrFallback("leads.customViews.deleteView", "Delete saved view")}
                        className="text-slate-400 hover:text-red-500 rounded p-0.5 hidden group-hover:block transition-all shrink-0"
                      >
                        <X size={11} />
                      </button>
                    ) : (
                      <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold shrink-0">
                        •
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* bottom action additions */}
            <div className="pt-2 text-left">
              <button
                type="button"
                onClick={onAddViewClick}
                className="w-full text-indigo-600 hover:text-indigo-700 text-xs font-bold pl-2 py-1 flex items-center gap-1"
              >
                <span>{translateOrFallback("leads.customViews.addView", "+ Thêm giao diện")}</span>
              </button>
            </div>

          </div>
        </>
      )}
    </div>
  );
};
