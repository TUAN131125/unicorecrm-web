export const getContactStatusBadgeStyle = (status?: string) => {
  switch (status?.toLowerCase()) {
    case "active": return "bg-blue-50 text-blue-700 border-blue-200";
    case "needs_follow_up": return "bg-amber-50 text-amber-700 border-amber-200";
    case "in_consulting": return "bg-sky-50 text-sky-700 border-sky-200";
    case "has_open_opportunity": return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "inactive": return "bg-slate-50 text-slate-500 border-slate-200";
    case "do_not_contact": return "bg-rose-50 text-rose-700 border-rose-200";
    case "archived": return "bg-zinc-100 text-zinc-600 border-zinc-200";
    default: return "bg-slate-50 text-slate-600 border-slate-200";
  }
};

export const getPriorityBadgeStyle = (priority?: string) => {
  switch (priority?.toUpperCase()) {
    case "LOW": return "bg-slate-100 text-slate-600 border-slate-200";
    case "MEDIUM": return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "HIGH": return "bg-amber-50 text-amber-700 border-amber-200";
    case "URGENT": return "bg-rose-50 text-rose-700 border-rose-200";
    default: return "bg-slate-100 text-slate-600 border-slate-200";
  }
};

export const getContactStatusTranslation = (status: string, t: (k: string) => string) => {
  const key = `contactStatus.${status?.toLowerCase()}`;
  const value = t(key);
  return value === key ? status : value;
};

export const getContactPriorityTranslation = (priority: string, t: (k: string) => string) => {
  switch (priority?.toUpperCase()) {
    case "LOW": return t("contactList.priority.low");
    case "MEDIUM": return t("contactList.priority.medium");
    case "HIGH": return t("contactList.priority.high");
    case "URGENT": return t("contactList.priority.urgent");
    default: return priority || "";
  }
};
