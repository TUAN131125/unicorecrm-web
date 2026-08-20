export const recordDetailHeaderShellClassName = "bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm text-left";
export const recordDetailHeaderMainRowClassName = {
  inline: "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between",
  responsive: "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between",
  stacked: "flex flex-col gap-4",
} as const;
export const recordDetailHeaderIdentityClassName = "min-w-0 flex-1";
export const recordDetailHeaderActionsClassName = {
  inline: "flex w-full flex-wrap items-center gap-2 justify-start lg:w-auto lg:justify-end",
  responsive: "flex w-full flex-wrap items-center gap-2 justify-start lg:w-auto lg:justify-end",
  stacked: "flex w-full flex-wrap items-center gap-2 justify-start",
} as const;
export const recordDetailHeaderAvatarClassName = "w-12 h-12 rounded-xl border font-extrabold text-base flex items-center justify-center shrink-0 uppercase shadow-inner";
export const recordDetailHeaderTitleClassName = "text-sm font-black text-slate-800 tracking-tight sm:text-lg";
export const recordDetailHeaderMetadataClassName = "flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium text-slate-500 sm:text-xs";

export const recordDetailHeaderActionButtonClassName = "h-9 whitespace-nowrap rounded-xl";
export const recordDetailHeaderActionIconButtonClassName = "h-9 w-9 rounded-xl";
