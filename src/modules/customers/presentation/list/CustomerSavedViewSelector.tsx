import React from "react";
import {
  AlertTriangle,
  Archive,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  Clock,
  Folder,
  HeartPulse,
  LifeBuoy,
  User,
  Users,
} from "lucide-react";
import { OVERLAY_Z } from "@/components/overlay/overlayLayers";
import { useI18n } from "@/i18n";
import type { CustomerSavedViewItem } from "./customerList.types";

interface CustomerSavedViewSelectorProps {
  views: CustomerSavedViewItem[];
  activeView: string;
  onSelectView(view: string): void;
  isOpen: boolean;
  onOpenChange(open: boolean): void;
  customerCount: number;
  onAddViewClick(): void;
}

export const CustomerSavedViewSelector: React.FC<CustomerSavedViewSelectorProps> = ({
  views,
  activeView,
  onSelectView,
  isOpen,
  onOpenChange,
  customerCount,
  onAddViewClick,
}) => {
  const { locale } = useI18n();
  const isVi = locale === "vi";
  const active = views.find((view) => view.key === activeView) || views[0];
  const label = (view: CustomerSavedViewItem) => isVi ? view.labelVi : view.labelEn;

  return (
    <div className="relative shrink-0 font-sans">
      <button
        id="customer-view-dropdown-trigger"
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs px-3.5 py-1.5 rounded-xl font-medium transition-all h-8 shrink-0 shadow-sm max-w-[160px] sm:max-w-[220px]"
      >
        <span className="text-indigo-600 crm-text-wrap flex-1 block text-left">
          {active ? label(active) : isVi ? "Tất cả khách hàng" : "All customers"}
        </span>
        <ChevronDown size={14} className="text-slate-400 shrink-0" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[2999]" onClick={() => onOpenChange(false)} />
          <div className={`absolute left-0 mt-2 w-[min(92vw,360px)] max-w-[calc(100vw-24px)] bg-white border border-slate-200 rounded-2xl shadow-xl p-4 ${OVERLAY_Z.dropdown} divide-y divide-slate-100 max-h-[460px] overflow-y-auto overflow-x-hidden crm-scroll-y`}>
            <ViewGroup
              title={isVi ? "CHIA SẺ VỚI TÔI" : "SHARED WITH ME"}
              views={views.filter((view) => view.isShared)}
              activeView={activeView}
              customerCount={customerCount}
              label={label}
              onSelectView={onSelectView}
            />
            <ViewGroup
              title={isVi ? "TẠO BỞI TÔI" : "CREATED BY ME"}
              views={views.filter((view) => !view.isShared)}
              activeView={activeView}
              customerCount={customerCount}
              label={label}
              onSelectView={onSelectView}
              className="pt-3 pb-3"
            />
            <div className="pt-2 text-left">
              <button
                type="button"
                onClick={onAddViewClick}
                className="w-full text-indigo-600 hover:text-indigo-700 text-xs font-medium pl-2 py-1 flex items-center gap-1"
              >
                <span>{isVi ? "+ Thêm giao diện" : "+ Add view"}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

interface ViewGroupProps {
  title: string;
  views: CustomerSavedViewItem[];
  activeView: string;
  customerCount: number;
  label(view: CustomerSavedViewItem): string;
  onSelectView(view: string): void;
  className?: string;
}

const ViewGroup: React.FC<ViewGroupProps> = ({
  title,
  views,
  activeView,
  customerCount,
  label,
  onSelectView,
  className = "pb-3",
}) => (
  <div className={`${className} text-left`}>
    <p className="text-[10px] font-semibold text-slate-400 tracking-wider mb-2 uppercase">{title}</p>
    <div className="space-y-1">
      {views.map((view) => (
        <button
          key={view.key}
          type="button"
          onClick={() => onSelectView(view.key)}
          className={`w-full flex items-center justify-between text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
            activeView === view.key ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {viewIcon(view.key)}
            <span className="crm-text-wrap">{label(view)}</span>
          </div>
          {activeView === view.key && (
            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium shrink-0">
              {customerCount}
            </span>
          )}
        </button>
      ))}
      {views.length === 0 && <p className="px-2.5 py-1.5 text-[10px] font-semibold text-slate-400">—</p>}
    </div>
  </div>
);

function viewIcon(key: string): React.ReactNode {
  if (key.startsWith("custom_")) return <Folder size={14} className="text-slate-400 shrink-0" />;
  switch (key) {
    case "myCustomers": return <User size={14} className="text-slate-400 shrink-0" />;
    case "b2b": return <Building2 size={14} className="text-indigo-500 shrink-0" />;
    case "b2c": return <Users size={14} className="text-cyan-500 shrink-0" />;
    case "active": return <HeartPulse size={14} className="text-emerald-500 shrink-0" />;
    case "atRisk": return <AlertTriangle size={14} className="text-rose-500 shrink-0" />;
    case "needCareToday": return <Clock size={14} className="text-amber-500 shrink-0" />;
    case "overdueCare": return <AlertTriangle size={14} className="text-orange-500 shrink-0" />;
    case "openOpportunity": return <BriefcaseBusiness size={14} className="text-indigo-500 shrink-0" />;
    case "openSupport": return <LifeBuoy size={14} className="text-sky-500 shrink-0" />;
    case "archived": return <Archive size={14} className="text-slate-400 shrink-0" />;
    default: return <Folder size={14} className="text-slate-400 shrink-0" />;
  }
}
