import React, { useRef } from "react";
import {
  ChevronDown,
  Folder,
  User,
  Users,
  Clock,
  AlertTriangle,
  MessagesSquare,
  BriefcaseBusiness,
  CircleSlash,
  Target,
  CheckCircle2,
  Ban,
  Moon,
  Copy,
  Archive,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { RowActionPortal } from "@/shared/components/ui";

export interface ContactSavedView {
  key: string;
  labelKey: string;
  isShared: boolean;
  icon?: string;
}

interface ContactSavedViewSelectorProps {
  customViews: ContactSavedView[];
  activeView: string;
  setActiveView: (view: string) => void;
  isViewDropdownOpen: boolean;
  setIsViewDropdownOpen: (open: boolean) => void;
  contactsCount: number;
  onAddViewClick: () => void;
}

export const ContactSavedViewSelector: React.FC<ContactSavedViewSelectorProps> = ({
  customViews,
  activeView,
  setActiveView,
  isViewDropdownOpen,
  setIsViewDropdownOpen,
  contactsCount,
  onAddViewClick,
}) => {
  const { t } = useI18n();
  const triggerRef = useRef<HTMLButtonElement>(null);

  const translateOrFallback = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const getReadableFallback = (view: ContactSavedView) => view.labelKey?.split(".").pop() || view.key;

  const getContactViewLabel = (view: ContactSavedView) => {
    if (view.key.startsWith("custom_")) return view.labelKey;
    return translateOrFallback(view.labelKey, getReadableFallback(view));
  };

  const getContactViewIcon = (view: ContactSavedView) => {
    if (view.key.startsWith("custom_")) return <Folder size={14} className="text-slate-400 shrink-0" />;
    switch (view.key) {
      case "allContacts":
        return <Folder size={14} className="text-slate-400 shrink-0" />;
      case "myContacts":
        return <User size={14} className="text-slate-400 shrink-0" />;
      case "teamContacts":
        return <Users size={14} className="text-slate-400 shrink-0" />;
      case "needFollowUpToday":
        return <Clock size={14} className="text-amber-500 shrink-0" />;
      case "overdueFollowUp":
        return <AlertTriangle size={14} className="text-rose-500 shrink-0" />;
      case "inConsulting":
        return <MessagesSquare size={14} className="text-teal-500 shrink-0" />;
      case "hasOpenOpportunity":
        return <BriefcaseBusiness size={14} className="text-indigo-500 shrink-0" />;
      case "noOpportunityYet":
        return <CircleSlash size={14} className="text-slate-400 shrink-0" />;
      case "nearClosing":
        return <Target size={14} className="text-amber-500 shrink-0" />;
      case "becameCustomer":
        return <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />;
      case "doNotContact":
        return <Ban size={14} className="text-rose-500 shrink-0" />;
      case "inactiveLongTime":
        return <Moon size={14} className="text-slate-400 shrink-0" />;
      case "duplicates":
        return <Copy size={14} className="text-indigo-400 shrink-0" />;
      case "archived":
        return <Archive size={14} className="text-slate-400 shrink-0" />;
      default:
        return <Folder size={14} className="text-slate-400 shrink-0" />;
    }
  };

  const activeViewObj = customViews.find((view) => view.key === activeView) || customViews[0];

  return (
    <div className="relative shrink-0 font-sans">
      <button
        ref={triggerRef}
        id="contact-view-dropdown-trigger"
        type="button"
        onClick={() => setIsViewDropdownOpen(!isViewDropdownOpen)}
        className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs px-3.5 py-1.5 rounded-xl font-medium transition-all h-8 shrink-0 shadow-sm max-w-[160px] sm:max-w-[220px]"
      >
        <span key={activeView} className="text-indigo-600 crm-text-wrap flex-1 block text-left">
          {activeViewObj ? getContactViewLabel(activeViewObj) : t("contactViews.allContacts")}
        </span>
        <ChevronDown size={14} className="text-slate-400 shrink-0" />
      </button>

      <RowActionPortal
        open={isViewDropdownOpen}
        anchorEl={triggerRef.current}
        onClose={() => setIsViewDropdownOpen(false)}
        width={360}
        align="start"
        role="menu"
        className="divide-y divide-slate-100 p-4 crm-scroll-y"
      >
            <div className="pb-3 text-left">
              <p className="text-[10px] font-semibold text-slate-400 tracking-wider mb-2 uppercase">
                {translateOrFallback("contactViews.shareWithMe", "CHIA SE VOI TOI")}
              </p>
              <div className="space-y-1">
                {customViews.filter((view) => view.isShared).map((view) => (
                  <button
                    key={view.key}
                    type="button"
                    onClick={() => setActiveView(view.key)}
                    className={`w-full flex items-center justify-between text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                      activeView === view.key ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {getContactViewIcon(view)}
                      <span className="crm-text-wrap">{getContactViewLabel(view)}</span>
                    </div>
                    {activeView === view.key && (
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium shrink-0">
                        {contactsCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-3 pb-3 text-left">
              <p className="text-[10px] font-semibold text-slate-400 tracking-wider mb-2 uppercase">
                {translateOrFallback("contactViews.createdByMe", "TAO BOI TOI")}
              </p>
              <div className="space-y-1">
                {customViews.filter((view) => !view.isShared).map((view) => (
                  <button
                    key={view.key}
                    type="button"
                    onClick={() => setActiveView(view.key)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                      activeView === view.key ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex-1 text-left flex items-center gap-1.5 min-w-0">
                      {getContactViewIcon(view)}
                      <span className="crm-text-wrap">{getContactViewLabel(view)}</span>
                    </span>
                    {activeView === view.key && (
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium shrink-0">
                        {contactsCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 text-left">
              <button
                type="button"
                onClick={onAddViewClick}
                className="w-full text-indigo-600 hover:text-indigo-700 text-xs font-medium pl-2 py-1 flex items-center gap-1"
              >
                <span>{translateOrFallback("contactViews.addView", "+ Thêm giao diện")}</span>
              </button>
            </div>
      </RowActionPortal>
    </div>
  );
};
